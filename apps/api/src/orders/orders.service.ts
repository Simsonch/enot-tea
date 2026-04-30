import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  FulfillmentStatus,
  OrderStatus,
  OrderStatusDimension,
  PaymentStatus,
  type Prisma,
} from '@prisma/client';
import { OrderNotificationsService } from '../notifications/order-notifications.service.js';
import type {
  NotificationAttemptResult,
  OrderEmailEvent,
} from '../notifications/notifications.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  type CreateOrderDto,
  type GetOrdersQueryDto,
  type ManualOrderLifecycleTransitionDto,
  type UpdateOrderStatusDto,
} from './orders.dto.js';

type OrderLifecycleState = {
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
};

type OrderLifecycleTransition = {
  operation: string;
  expected: OrderLifecycleState | OrderLifecycleState[];
  next: OrderLifecycleState | ((current: OrderLifecycleState) => OrderLifecycleState);
  comment: string;
  shipInventory?: boolean;
  releaseReserved?: boolean;
};

type ActorId = string | undefined;

type NotificationAttemptSummary = {
  event: string;
  status: string;
  errorMessage: string | null;
  createdAt: Date;
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly orderNotifications?: OrderNotificationsService,
  ) {}

  private readonly allowedTransitions = new Map<OrderStatus, Set<OrderStatus>>([
    [OrderStatus.NEW, new Set([OrderStatus.CONFIRMED, OrderStatus.CANCELLED])],
    [OrderStatus.CONFIRMED, new Set([OrderStatus.PACKED, OrderStatus.CANCELLED])],
    [OrderStatus.PACKED, new Set([OrderStatus.SHIPPED, OrderStatus.CANCELLED])],
    [OrderStatus.SHIPPED, new Set([OrderStatus.DELIVERED])],
    [OrderStatus.DELIVERED, new Set()],
    [OrderStatus.CANCELLED, new Set()],
  ]);
  private readonly statusEndpointAllowedTargets = new Set<OrderStatus>([
    OrderStatus.CONFIRMED,
    OrderStatus.PACKED,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
  ]);

  async create(dto: CreateOrderDto) {
    const order = await this.prisma.$transaction(async (tx) => {
      if (dto.customerId) {
        await this.ensureLinkedCustomerExists(tx, dto.customerId);
      }

      const requestedItems = this.aggregateItems(dto.items);
      const productIds = requestedItems.map((item) => item.productId);

      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, priceMinor: true, isActive: true },
      });
      if (products.length !== productIds.length) {
        throw new NotFoundException('Один или несколько товаров не найдены.');
      }

      const inactiveProduct = products.find((product) => !product.isActive);
      if (inactiveProduct) {
        throw new ConflictException({
          statusCode: HttpStatus.CONFLICT,
          code: 'PRODUCT_INACTIVE',
          message: 'Нельзя оформить заказ на неактивный товар.',
          details: {
            productId: inactiveProduct.id,
          },
        });
      }

      const inventory = await tx.inventoryItem.findMany({
        where: { productId: { in: productIds } },
        select: { id: true, productId: true },
      });
      if (inventory.length !== productIds.length) {
        throw new NotFoundException('Остатки для одного или нескольких товаров не найдены.');
      }

      const productsById = new Map(products.map((product) => [product.id, product]));
      const inventoryByProductId = new Map(
        inventory.map((item) => [item.productId, item]),
      );

      let totalMinor = 0;
      for (const requested of requestedItems) {
        const product = productsById.get(requested.productId);
        const stock = inventoryByProductId.get(requested.productId);

        if (!product || !stock) {
          throw new NotFoundException(
            `Товар или остаток не найден для productId=${requested.productId}.`,
          );
        }

        totalMinor += product.priceMinor * requested.quantity;
      }

      const orderData: Prisma.OrderCreateInput = {
        customerFullName: dto.customerFullName,
        customerEmail: dto.customerEmail,
        shippingAddress: dto.shippingAddress,
        status: OrderStatus.NEW,
        paymentStatus: PaymentStatus.PENDING,
        fulfillmentStatus: FulfillmentStatus.RESERVED,
        totalMinor,
        ...(dto.customerId ? { customer: { connect: { id: dto.customerId } } } : {}),
        ...(dto.customerPhone ? { customerPhone: dto.customerPhone } : {}),
        items: {
          create: requestedItems.map((requested) => {
            const product = productsById.get(requested.productId);
            if (!product) {
              throw new NotFoundException(
                `Товар productId=${requested.productId} не найден.`,
              );
            }
            return {
              productId: requested.productId,
              quantity: requested.quantity,
              priceMinor: product.priceMinor,
              totalMinor: product.priceMinor * requested.quantity,
            };
          }),
        },
        statusHistory: {
          create: {
            statusDimension: OrderStatusDimension.ORDER,
            fromStatus: null,
            toStatus: OrderStatus.NEW,
            comment: 'Создание заказа',
          },
        },
      };

      const order = await tx.order.create({
        data: orderData,
        include: {
          items: {
            select: {
              id: true,
              productId: true,
              quantity: true,
              priceMinor: true,
              totalMinor: true,
            },
          },
          statusHistory: {
            select: {
              id: true,
              statusDimension: true,
              fromStatus: true,
              toStatus: true,
              fromPaymentStatus: true,
              toPaymentStatus: true,
              fromFulfillmentStatus: true,
              toFulfillmentStatus: true,
              changedById: true,
              comment: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      const orderItemsByProductId = new Map(
        order.items.map((item) => [item.productId, item]),
      );
      for (const requested of requestedItems) {
        const stock = inventoryByProductId.get(requested.productId);
        const orderItem = orderItemsByProductId.get(requested.productId);
        if (!stock || !orderItem) {
          throw new NotFoundException(
            `Товар или остаток не найден для productId=${requested.productId}.`,
          );
        }

        await this.reserveInventoryForOrder(tx, {
          inventoryItemId: stock.id,
          orderId: order.id,
          orderItemId: orderItem.id,
          productId: requested.productId,
          quantity: requested.quantity,
        });
      }

      return order;
    });

    const notification = await this.sendOrderNotification('order-created', order);

    return this.withNotificationSummary(order, notification);
  }

  async cancel(orderId: string, dto: ManualOrderLifecycleTransitionDto = {}, actorId?: ActorId) {
    const order = await this.transitionLifecycle(orderId, {
      operation: 'cancel',
      expected: [OrderStatus.NEW, OrderStatus.CONFIRMED, OrderStatus.PACKED].flatMap(
        (status) =>
          [PaymentStatus.PENDING, PaymentStatus.INVOICE_SENT, PaymentStatus.PAID].map(
            (paymentStatus) => ({
              status,
              paymentStatus,
              fulfillmentStatus: FulfillmentStatus.RESERVED,
            }),
          ),
      ),
      next: (current) => ({
        ...current,
        status: OrderStatus.CANCELLED,
      }),
      comment: dto.comment ?? 'Отмена заказа',
      releaseReserved: true,
    }, actorId);

    const notification = await this.sendOrderNotification('cancelled', order);

    return this.withNotificationSummary(order, notification);
  }

  async markInvoiceSent(
    orderId: string,
    dto: ManualOrderLifecycleTransitionDto = {},
    actorId?: ActorId,
  ) {
    const order = await this.transitionLifecycle(orderId, {
      operation: 'invoice-sent',
      expected: {
        status: OrderStatus.NEW,
        paymentStatus: PaymentStatus.PENDING,
        fulfillmentStatus: FulfillmentStatus.RESERVED,
      },
      next: {
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.INVOICE_SENT,
        fulfillmentStatus: FulfillmentStatus.RESERVED,
      },
      comment: dto.comment ?? 'Счет выставлен',
    }, actorId);

    const notification = await this.sendOrderNotification('invoice-issued', order);

    return this.withNotificationSummary(order, notification);
  }

  async confirmPayment(
    orderId: string,
    dto: ManualOrderLifecycleTransitionDto = {},
    actorId?: ActorId,
  ) {
    const order = await this.transitionLifecycle(orderId, {
      operation: 'payment-confirmed',
      expected: {
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.INVOICE_SENT,
        fulfillmentStatus: FulfillmentStatus.RESERVED,
      },
      next: {
        status: OrderStatus.PACKED,
        paymentStatus: PaymentStatus.PAID,
        fulfillmentStatus: FulfillmentStatus.RESERVED,
      },
      comment: dto.comment ?? 'Оплата подтверждена',
    }, actorId);

    const notification = await this.sendOrderNotification('payment-confirmed', order);

    return this.withNotificationSummary(order, notification);
  }

  async handOffToDelivery(
    orderId: string,
    dto: ManualOrderLifecycleTransitionDto = {},
    actorId?: ActorId,
  ) {
    const order = await this.transitionLifecycle(orderId, {
      operation: 'handoff-to-delivery',
      expected: {
        status: OrderStatus.PACKED,
        paymentStatus: PaymentStatus.PAID,
        fulfillmentStatus: FulfillmentStatus.RESERVED,
      },
      next: {
        status: OrderStatus.SHIPPED,
        paymentStatus: PaymentStatus.PAID,
        fulfillmentStatus: FulfillmentStatus.HANDED_TO_CARRIER,
      },
      comment: dto.comment ?? 'Передано в доставку',
      shipInventory: true,
    }, actorId);

    const notification = await this.sendOrderNotification('in-delivery', order);

    return this.withNotificationSummary(order, notification);
  }

  async confirmDelivered(
    orderId: string,
    dto: ManualOrderLifecycleTransitionDto = {},
    actorId?: ActorId,
  ) {
    const order = await this.transitionLifecycle(orderId, {
      operation: 'delivered',
      expected: {
        status: OrderStatus.SHIPPED,
        paymentStatus: PaymentStatus.PAID,
        fulfillmentStatus: FulfillmentStatus.HANDED_TO_CARRIER,
      },
      next: {
        status: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.PAID,
        fulfillmentStatus: FulfillmentStatus.DELIVERED,
      },
      comment: dto.comment ?? 'Получение подтверждено',
    }, actorId);

    const notification = await this.sendOrderNotification('completed', order);

    return this.withNotificationSummary(order, notification);
  }

  async updateStatus(orderId: string, dto: UpdateOrderStatusDto, actorId?: ActorId) {
    this.ensureUpdateStatusPayload(dto);
    return this.transitionStatus(orderId, dto, actorId);
  }

  async list(query: GetOrdersQueryDto) {
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...((query.from || query.to)
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.offset,
        take: query.limit,
        select: {
          id: true,
          customerId: true,
          customerFullName: true,
          customerEmail: true,
          customerPhone: true,
          shippingAddress: true,
          status: true,
          paymentStatus: true,
          fulfillmentStatus: true,
          totalMinor: true,
          createdAt: true,
          updatedAt: true,
          notifications: {
            select: {
              event: true,
              status: true,
              errorMessage: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: items.map((order) => ({
        id: order.id,
        customerId: order.customerId,
        customerFullName: order.customerFullName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        shippingAddress: order.shippingAddress,
        status: order.status,
        paymentStatus: order.paymentStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        totalMinor: order.totalMinor,
        itemsCount: order._count.items,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        notification: this.getNotificationSummary(order.notifications?.[0]),
      })),
      pagination: {
        limit: query.limit,
        offset: query.offset,
        total,
      },
    };
  }

  async getById(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          select: {
            id: true,
            productId: true,
            quantity: true,
            priceMinor: true,
            totalMinor: true,
          },
        },
        statusHistory: {
          select: {
            id: true,
            statusDimension: true,
            fromStatus: true,
            toStatus: true,
            fromPaymentStatus: true,
            toPaymentStatus: true,
            fromFulfillmentStatus: true,
            toFulfillmentStatus: true,
            changedById: true,
            comment: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        notifications: {
          select: {
            event: true,
            status: true,
            errorMessage: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Заказ orderId=${orderId} не найден.`);
    }

    return this.withNotificationSummary(order, order.notifications?.[0]);
  }

  async resendNotification(orderId: string) {
    const order = await this.getById(orderId);
    const event = this.getCurrentNotificationEvent(order);
    const notification = await this.sendOrderNotification(event, order);

    return this.withNotificationSummary(order, notification);
  }

  private async sendOrderNotification(
    event: OrderEmailEvent,
    order: {
      id: string;
      customerEmail: string;
      customerFullName: string;
      totalMinor: number;
    },
  ): Promise<NotificationAttemptResult | undefined> {
    if (!this.orderNotifications) {
      return undefined;
    }

    try {
      return await this.orderNotifications.sendOrderEvent(event, {
        id: order.id,
        customerEmail: order.customerEmail,
        customerFullName: order.customerFullName,
        totalMinor: order.totalMinor,
      });
    } catch (error) {
      this.logger.error(
        `Email notification failed orderId=${order.id} event=${event}: ${this.getErrorMessage(error)}`,
      );
      return {
        event,
        status: 'FAILED',
        errorMessage: this.getErrorMessage(error),
      };
    }
  }

  private withNotificationSummary<T extends object>(
    order: T,
    attempt: NotificationAttemptSummary | NotificationAttemptResult | undefined,
  ) {
    const { notifications: _notifications, ...orderWithoutAttempts } = order as T & {
      notifications?: unknown;
    };

    return {
      ...orderWithoutAttempts,
      notification: this.getNotificationSummary(attempt),
    };
  }

  private getNotificationSummary(
    attempt: NotificationAttemptSummary | NotificationAttemptResult | undefined,
  ) {
    if (!attempt) {
      return {
        status: 'NOT_SENT',
        event: null,
        errorMessage: null,
        createdAt: null,
      };
    }

    return {
      status: attempt.status,
      event: attempt.event,
      errorMessage: attempt.errorMessage ?? null,
      createdAt: attempt.createdAt ?? null,
    };
  }

  private getCurrentNotificationEvent(order: OrderLifecycleState): OrderEmailEvent {
    if (order.status === OrderStatus.CANCELLED) {
      return 'cancelled';
    }
    if (
      order.status === OrderStatus.DELIVERED ||
      order.fulfillmentStatus === FulfillmentStatus.DELIVERED
    ) {
      return 'completed';
    }
    if (order.fulfillmentStatus === FulfillmentStatus.HANDED_TO_CARRIER) {
      return 'in-delivery';
    }
    if (order.paymentStatus === PaymentStatus.PAID) {
      return 'payment-confirmed';
    }
    if (order.paymentStatus === PaymentStatus.INVOICE_SENT) {
      return 'invoice-issued';
    }

    return 'order-created';
  }

  private async ensureLinkedCustomerExists(
    tx: Prisma.TransactionClient,
    customerId: NonNullable<CreateOrderDto['customerId']>,
  ) {
    const customer = await tx.user.findUnique({
      where: { id: customerId },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException(`Покупатель customerId=${customerId} не найден.`);
    }
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unknown email notification error';
  }

  private aggregateItems(items: CreateOrderDto['items']) {
    const quantities = new Map<string, number>();

    for (const item of items) {
      quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
    }

    return [...quantities.entries()].map(([productId, quantity]) => ({
      productId,
      quantity,
    }));
  }

  private async transitionStatus(
    orderId: string,
    dto: Pick<UpdateOrderStatusDto, 'toStatus' | 'comment'>,
    actorId?: ActorId,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            select: {
              id: true,
              productId: true,
              quantity: true,
            },
          },
        },
      });

      if (!order) {
        throw new NotFoundException(`Заказ orderId=${orderId} не найден.`);
      }

      this.ensureTransitionAllowed(order.status, dto.toStatus, order.id);
      await this.applyInventoryChangesForTransition(
        tx,
        order.id,
        order.items,
        dto.toStatus,
      );

      return tx.order.update({
        where: { id: order.id },
        data: {
          status: dto.toStatus,
          statusHistory: {
            create: {
              fromStatus: order.status,
              toStatus: dto.toStatus,
              ...(actorId ? { changedById: actorId } : {}),
              comment:
                dto.comment ??
                this.getDefaultTransitionComment(order.status, dto.toStatus),
            },
          },
        },
        include: {
          items: {
            select: {
              id: true,
              productId: true,
              quantity: true,
              priceMinor: true,
              totalMinor: true,
            },
          },
          statusHistory: {
            select: {
              id: true,
              statusDimension: true,
              fromStatus: true,
              toStatus: true,
              fromPaymentStatus: true,
              toPaymentStatus: true,
              fromFulfillmentStatus: true,
              toFulfillmentStatus: true,
              changedById: true,
              comment: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    });
  }

  private async transitionLifecycle(
    orderId: string,
    transition: OrderLifecycleTransition,
    actorId?: ActorId,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            select: {
              id: true,
              productId: true,
              quantity: true,
            },
          },
        },
      });

      if (!order) {
        throw new NotFoundException(`Заказ orderId=${orderId} не найден.`);
      }

      this.ensureLifecycleTransitionAllowed(order, transition);
      const nextState = this.getLifecycleNextState(order, transition);

      if (transition.shipInventory) {
        await this.shipItems(tx, order.id, order.items);
      }

      if (transition.releaseReserved) {
        await this.decrementReserved(tx, order.id, order.items);
      }

      return tx.order.update({
        where: { id: order.id },
        data: {
          status: nextState.status,
          paymentStatus: nextState.paymentStatus,
          fulfillmentStatus: nextState.fulfillmentStatus,
          statusHistory: {
            create: this.buildLifecycleHistoryEntries(order, transition, nextState, actorId),
          },
        },
        include: {
          items: {
            select: {
              id: true,
              productId: true,
              quantity: true,
              priceMinor: true,
              totalMinor: true,
            },
          },
          statusHistory: {
            select: {
              id: true,
              statusDimension: true,
              fromStatus: true,
              toStatus: true,
              fromPaymentStatus: true,
              toPaymentStatus: true,
              fromFulfillmentStatus: true,
              toFulfillmentStatus: true,
              changedById: true,
              comment: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    });
  }

  private ensureLifecycleTransitionAllowed(
    order: OrderLifecycleState & { id: string },
    transition: OrderLifecycleTransition,
  ) {
    const expectedStates = Array.isArray(transition.expected)
      ? transition.expected
      : [transition.expected];
    const isAllowed = expectedStates.some((expected) =>
      this.isLifecycleState(order, expected),
    );

    if (!isAllowed) {
      throw new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        code: 'INVALID_ORDER_STATUS_TRANSITION',
        message: `Недопустимый переход lifecycle для заказа orderId=${order.id}: ${transition.operation}.`,
        details: {
          orderId: order.id,
          operation: transition.operation,
          current: {
            status: order.status,
            paymentStatus: order.paymentStatus,
            fulfillmentStatus: order.fulfillmentStatus,
          },
          expected: transition.expected,
          next: this.getLifecycleNextState(order, transition),
        },
      });
    }
  }

  private isLifecycleState(
    current: OrderLifecycleState,
    expected: OrderLifecycleState,
  ) {
    return (
      current.status === expected.status &&
      current.paymentStatus === expected.paymentStatus &&
      current.fulfillmentStatus === expected.fulfillmentStatus
    );
  }

  private getLifecycleNextState(
    order: OrderLifecycleState,
    transition: OrderLifecycleTransition,
  ) {
    return typeof transition.next === 'function'
      ? transition.next(order)
      : transition.next;
  }

  private buildLifecycleHistoryEntries(
    order: OrderLifecycleState,
    transition: OrderLifecycleTransition,
    nextState: OrderLifecycleState,
    actorId?: ActorId,
  ): Prisma.OrderStatusHistoryCreateWithoutOrderInput[] {
    const entries: Prisma.OrderStatusHistoryCreateWithoutOrderInput[] = [];

    if (order.status !== nextState.status) {
      entries.push({
        statusDimension: OrderStatusDimension.ORDER,
        fromStatus: order.status,
        toStatus: nextState.status,
        ...(actorId ? { changedById: actorId } : {}),
        comment: transition.comment,
      });
    }

    if (order.paymentStatus !== nextState.paymentStatus) {
      entries.push({
        statusDimension: OrderStatusDimension.PAYMENT,
        fromPaymentStatus: order.paymentStatus,
        toPaymentStatus: nextState.paymentStatus,
        ...(actorId ? { changedById: actorId } : {}),
        comment: transition.comment,
      });
    }

    if (order.fulfillmentStatus !== nextState.fulfillmentStatus) {
      entries.push({
        statusDimension: OrderStatusDimension.FULFILLMENT,
        fromFulfillmentStatus: order.fulfillmentStatus,
        toFulfillmentStatus: nextState.fulfillmentStatus,
        ...(actorId ? { changedById: actorId } : {}),
        comment: transition.comment,
      });
    }

    return entries;
  }

  private ensureTransitionAllowed(
    fromStatus: OrderStatus,
    toStatus: OrderStatus,
    orderId: string,
  ) {
    const allowed = this.allowedTransitions.get(fromStatus) ?? new Set<OrderStatus>();
    if (!allowed.has(toStatus)) {
      throw new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        code: 'INVALID_ORDER_STATUS_TRANSITION',
        message: `Недопустимый переход статуса заказа orderId=${orderId}: ${fromStatus} -> ${toStatus}.`,
        details: {
          orderId,
          fromStatus,
          toStatus,
        },
      });
    }
  }

  private async applyInventoryChangesForTransition(
    tx: Prisma.TransactionClient,
    orderId: string,
    items: Array<{ id: string; productId: string; quantity: number }>,
    toStatus: OrderStatus,
  ) {
    if (toStatus === OrderStatus.CANCELLED) {
      await this.decrementReserved(tx, orderId, items);
      return;
    }

    if (toStatus === OrderStatus.SHIPPED) {
      await this.shipItems(tx, orderId, items);
    }
  }

  private async reserveInventoryForOrder(
    tx: Prisma.TransactionClient,
    item: {
      inventoryItemId: string;
      orderId: string;
      orderItemId: string;
      productId: string;
      quantity: number;
    },
  ) {
    const affected = await tx.$executeRaw`
      UPDATE "InventoryItem"
      SET "reserved" = "reserved" + ${item.quantity},
          "updatedAt" = NOW()
      WHERE "id" = ${item.inventoryItemId}
        AND ("onHand" - "reserved") >= ${item.quantity}
    `;

    if (Number(affected) !== 1) {
      await this.throwInsufficientStock(tx, item.productId, item.quantity);
    }

    await tx.stockMovement.create({
      data: {
        inventoryItemId: item.inventoryItemId,
        orderId: item.orderId,
        orderItemId: item.orderItemId,
        deltaReserved: item.quantity,
        reason: 'ORDER_RESERVE',
      },
    });
  }

  private async decrementReserved(
    tx: Prisma.TransactionClient,
    orderId: string,
    items: Array<{ id: string; productId: string; quantity: number }>,
  ) {
    for (const item of items) {
      const inventory = await tx.inventoryItem.findUnique({
        where: { productId: item.productId },
        select: { id: true, productId: true, reserved: true },
      });

      if (!inventory) {
        throw new NotFoundException(
          `Остаток для productId=${item.productId} не найден.`,
        );
      }

      if (inventory.reserved < item.quantity) {
        throw new ConflictException({
          statusCode: HttpStatus.CONFLICT,
          code: 'INVENTORY_INVARIANT_VIOLATION',
          message: `Недопустимое состояние резерва для productId=${item.productId}.`,
          details: {
            productId: item.productId,
            reserved: inventory.reserved,
            requiredToDecrement: item.quantity,
          },
        });
      }

      const updated = await tx.inventoryItem.updateMany({
        where: {
          id: inventory.id,
          reserved: { gte: item.quantity },
        },
        data: {
          reserved: {
            decrement: item.quantity,
          },
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException({
          statusCode: HttpStatus.CONFLICT,
          code: 'INVENTORY_INVARIANT_VIOLATION',
          message: `Недопустимое состояние резерва для productId=${item.productId}.`,
          details: {
            productId: item.productId,
            reserved: inventory.reserved,
            requiredToDecrement: item.quantity,
          },
        });
      }

      await tx.stockMovement.create({
        data: {
          inventoryItemId: inventory.id,
          orderId,
          orderItemId: item.id,
          deltaReserved: -item.quantity,
          reason: 'ORDER_CANCEL_RELEASE',
        },
      });
    }
  }

  private async shipItems(
    tx: Prisma.TransactionClient,
    orderId: string,
    items: Array<{ id: string; productId: string; quantity: number }>,
  ) {
    for (const item of items) {
      const inventory = await tx.inventoryItem.findUnique({
        where: { productId: item.productId },
        select: { id: true, productId: true, onHand: true, reserved: true },
      });

      if (!inventory) {
        throw new NotFoundException(
          `Остаток для productId=${item.productId} не найден.`,
        );
      }

      if (
        inventory.onHand < item.quantity ||
        inventory.reserved < item.quantity
      ) {
        throw new ConflictException({
          statusCode: HttpStatus.CONFLICT,
          code: 'INVENTORY_INVARIANT_VIOLATION',
          message: `Недопустимое состояние склада для отгрузки productId=${item.productId}.`,
          details: {
            productId: item.productId,
            onHand: inventory.onHand,
            reserved: inventory.reserved,
            requiredToShip: item.quantity,
          },
        });
      }

      const updated = await tx.inventoryItem.updateMany({
        where: {
          id: inventory.id,
          onHand: { gte: item.quantity },
          reserved: { gte: item.quantity },
        },
        data: {
          onHand: { decrement: item.quantity },
          reserved: { decrement: item.quantity },
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException({
          statusCode: HttpStatus.CONFLICT,
          code: 'INVENTORY_INVARIANT_VIOLATION',
          message: `Недопустимое состояние склада для отгрузки productId=${item.productId}.`,
          details: {
            productId: item.productId,
            onHand: inventory.onHand,
            reserved: inventory.reserved,
            requiredToShip: item.quantity,
          },
        });
      }

      await tx.stockMovement.create({
        data: {
          inventoryItemId: inventory.id,
          orderId,
          orderItemId: item.id,
          deltaOnHand: -item.quantity,
          deltaReserved: -item.quantity,
          reason: 'ORDER_SHIP',
        },
      });
    }
  }

  private async throwInsufficientStock(
    tx: Prisma.TransactionClient,
    productId: string,
    requested: number,
  ): Promise<never> {
    const inventory = await tx.inventoryItem.findUnique({
      where: { productId },
      select: { onHand: true, reserved: true },
    });

    if (!inventory) {
      throw new NotFoundException(`Остаток для productId=${productId} не найден.`);
    }

    throw new ConflictException({
      statusCode: HttpStatus.CONFLICT,
      code: 'INSUFFICIENT_STOCK',
      message: 'Недостаточно товара на складе для выбранного количества.',
      details: {
        productId,
        requested,
        available: inventory.onHand - inventory.reserved,
      },
    });
  }

  private getDefaultTransitionComment(
    fromStatus: OrderStatus,
    toStatus: OrderStatus,
  ) {
    return `Смена статуса заказа: ${fromStatus} -> ${toStatus}`;
  }

  private ensureUpdateStatusPayload(dto: UpdateOrderStatusDto) {
    if (!dto?.toStatus || !this.statusEndpointAllowedTargets.has(dto.toStatus)) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'VALIDATION_ERROR',
        message: 'Входные данные не прошли проверку.',
        errors: [
          {
            field: 'toStatus',
            messages: [
              'toStatus должен быть одним из значений: CONFIRMED, PACKED, SHIPPED, DELIVERED.',
            ],
          },
        ],
      });
    }
  }
}
