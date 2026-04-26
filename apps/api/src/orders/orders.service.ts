import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FulfillmentStatus,
  OrderStatus,
  OrderStatusDimension,
  PaymentStatus,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  type CreateOrderDto,
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

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.$transaction(async (tx) => {
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
  }

  async cancel(orderId: string, dto: ManualOrderLifecycleTransitionDto = {}) {
    return this.transitionLifecycle(orderId, {
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
    });
  }

  async markInvoiceSent(
    orderId: string,
    dto: ManualOrderLifecycleTransitionDto = {},
  ) {
    return this.transitionLifecycle(orderId, {
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
    });
  }

  async confirmPayment(
    orderId: string,
    dto: ManualOrderLifecycleTransitionDto = {},
  ) {
    return this.transitionLifecycle(orderId, {
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
    });
  }

  async handOffToDelivery(
    orderId: string,
    dto: ManualOrderLifecycleTransitionDto = {},
  ) {
    return this.transitionLifecycle(orderId, {
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
    });
  }

  async confirmDelivered(
    orderId: string,
    dto: ManualOrderLifecycleTransitionDto = {},
  ) {
    return this.transitionLifecycle(orderId, {
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
    });
  }

  async updateStatus(orderId: string, dto: UpdateOrderStatusDto) {
    this.ensureUpdateStatusPayload(dto);
    return this.transitionStatus(orderId, dto);
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
      },
    });

    if (!order) {
      throw new NotFoundException(`Заказ orderId=${orderId} не найден.`);
    }

    return order;
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
            create: this.buildLifecycleHistoryEntries(order, transition, nextState),
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
  ): Prisma.OrderStatusHistoryCreateWithoutOrderInput[] {
    const entries: Prisma.OrderStatusHistoryCreateWithoutOrderInput[] = [];

    if (order.status !== nextState.status) {
      entries.push({
        statusDimension: OrderStatusDimension.ORDER,
        fromStatus: order.status,
        toStatus: nextState.status,
        comment: transition.comment,
      });
    }

    if (order.paymentStatus !== nextState.paymentStatus) {
      entries.push({
        statusDimension: OrderStatusDimension.PAYMENT,
        fromPaymentStatus: order.paymentStatus,
        toPaymentStatus: nextState.paymentStatus,
        comment: transition.comment,
      });
    }

    if (order.fulfillmentStatus !== nextState.fulfillmentStatus) {
      entries.push({
        statusDimension: OrderStatusDimension.FULFILLMENT,
        fromFulfillmentStatus: order.fulfillmentStatus,
        toFulfillmentStatus: nextState.fulfillmentStatus,
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
