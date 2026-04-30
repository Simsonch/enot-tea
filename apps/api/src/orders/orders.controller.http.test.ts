import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { FulfillmentStatus, OrderStatus, PaymentStatus } from '@prisma/client';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { OrderNotificationsService } from '../notifications/order-notifications.service.js';
import type { EmailMessage } from '../notifications/notifications.types.js';
import {
  CreateOrderDto,
  GetOrdersQueryDto,
  ManualOrderLifecycleTransitionDto,
  UpdateOrderStatusDto,
} from './orders.dto.js';
import { formatValidationFieldErrors } from '../common/validation-error-format.js';
import { OwnerAuthGuard } from '../auth/owner-auth.guard.js';

// `tsx` test runtime may miss design-time metadata for decorated parameters.
// Define it explicitly so ValidationPipe can validate DTO on the API boundary.
Reflect.defineMetadata(
  'design:paramtypes',
  [String, ManualOrderLifecycleTransitionDto, Object],
  OrdersController.prototype,
  'cancel',
);
Reflect.defineMetadata(
  'design:paramtypes',
  [GetOrdersQueryDto],
  OrdersController.prototype,
  'list',
);
Reflect.defineMetadata(
  'design:paramtypes',
  [CreateOrderDto],
  OrdersController.prototype,
  'create',
);
for (const methodName of [
  'markInvoiceSent',
  'confirmPayment',
  'handOffToDelivery',
  'confirmDelivered',
]) {
  Reflect.defineMetadata(
    'design:paramtypes',
    [String, ManualOrderLifecycleTransitionDto, Object],
    OrdersController.prototype,
    methodName,
  );
}
Reflect.defineMetadata(
  'design:paramtypes',
  [String, UpdateOrderStatusDto, Object],
  OrdersController.prototype,
  'updateStatus',
);

async function createApp(overrides?: {
  guardCanActivate?: (context: unknown) => boolean | Promise<boolean>;
  list?: (query: GetOrdersQueryDto) => Promise<unknown>;
  create?: (dto: CreateOrderDto) => Promise<unknown>;
  updateStatus?: (id: string, dto: { toStatus: OrderStatus; comment?: string }, actorId?: string) => Promise<unknown>;
  cancel?: (id: string, dto?: ManualOrderLifecycleTransitionDto, actorId?: string) => Promise<unknown>;
  markInvoiceSent?: (id: string, dto?: ManualOrderLifecycleTransitionDto, actorId?: string) => Promise<unknown>;
  confirmPayment?: (id: string, dto?: ManualOrderLifecycleTransitionDto, actorId?: string) => Promise<unknown>;
  handOffToDelivery?: (id: string, dto?: ManualOrderLifecycleTransitionDto, actorId?: string) => Promise<unknown>;
  confirmDelivered?: (id: string, dto?: ManualOrderLifecycleTransitionDto, actorId?: string) => Promise<unknown>;
  resendNotification?: (id: string) => Promise<unknown>;
}) {
  let createCalls = 0;
  let updateStatusCalls = 0;
  let cancelCalls = 0;

  const ordersServiceMock = {
    list:
      overrides?.list ??
      (async (query: GetOrdersQueryDto) => ({
        items: [],
        pagination: { limit: query.limit, offset: query.offset, total: 0 },
      })),
    getById: async () => ({}),
    create:
      overrides?.create ??
      (async (dto: CreateOrderDto) => {
        createCalls += 1;

        return {
          id: 'order-created',
          customerId: dto.customerId ?? null,
          customerFullName: dto.customerFullName,
          customerEmail: dto.customerEmail,
          customerPhone: dto.customerPhone ?? null,
          shippingAddress: dto.shippingAddress,
          status: OrderStatus.NEW,
          paymentStatus: 'PENDING',
          fulfillmentStatus: 'RESERVED',
          totalMinor: 100,
          items: [
            {
              id: 'item-created',
              productId: dto.items[0]?.productId,
              quantity: dto.items[0]?.quantity,
              priceMinor: 100,
              totalMinor: 100,
            },
          ],
          statusHistory: [],
        };
      }),
    cancel:
      overrides?.cancel ??
      (async (id: string) => {
        cancelCalls += 1;
        return { id, status: OrderStatus.CANCELLED, items: [], statusHistory: [] };
      }),
    markInvoiceSent:
      overrides?.markInvoiceSent ??
      (async (id: string) => ({
        id,
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.INVOICE_SENT,
        fulfillmentStatus: FulfillmentStatus.RESERVED,
        items: [],
        statusHistory: [],
      })),
    confirmPayment:
      overrides?.confirmPayment ??
      (async (id: string) => ({
        id,
        status: OrderStatus.PACKED,
        paymentStatus: PaymentStatus.PAID,
        fulfillmentStatus: FulfillmentStatus.RESERVED,
        items: [],
        statusHistory: [],
      })),
    handOffToDelivery:
      overrides?.handOffToDelivery ??
      (async (id: string) => ({
        id,
        status: OrderStatus.SHIPPED,
        paymentStatus: PaymentStatus.PAID,
        fulfillmentStatus: FulfillmentStatus.HANDED_TO_CARRIER,
        items: [],
        statusHistory: [],
      })),
    confirmDelivered:
      overrides?.confirmDelivered ??
      (async (id: string) => ({
        id,
        status: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.PAID,
        fulfillmentStatus: FulfillmentStatus.DELIVERED,
        items: [],
        statusHistory: [],
      })),
    updateStatus:
      overrides?.updateStatus ??
      (async (id: string, dto: { toStatus: OrderStatus; comment?: string }) => {
        updateStatusCalls += 1;

        return {
          id,
          status: dto.toStatus ?? OrderStatus.CONFIRMED,
          items: [],
          statusHistory: [],
        };
      }),
    resendNotification:
      overrides?.resendNotification ??
      (async (id: string) => ({
        id,
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.INVOICE_SENT,
        fulfillmentStatus: FulfillmentStatus.RESERVED,
        notification: {
          status: 'SUCCESS',
          event: 'invoice-issued',
          errorMessage: null,
          createdAt: new Date('2026-04-29T00:00:00.000Z').toISOString(),
        },
        items: [],
        statusHistory: [],
      })),
  };
  const guardMock = {
    canActivate:
      overrides?.guardCanActivate ??
      ((context: any) => {
        context.switchToHttp().getRequest().owner = {
          id: 'owner-1',
          email: 'owner@example.com',
        };
        return true;
      }),
  };

  const moduleBuilder = Test.createTestingModule({
    controllers: [OrdersController],
    providers: [{ provide: OrdersService, useValue: ordersServiceMock }],
  }).overrideGuard(OwnerAuthGuard).useValue(guardMock);
  const moduleRef = await moduleBuilder.compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) =>
        new BadRequestException({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Входные данные не прошли проверку.',
          errors: formatValidationFieldErrors(errors),
        }),
    }),
  );
  await app.init();

  return {
    app,
    getCreateCalls: () => createCalls,
    getUpdateStatusCalls: () => updateStatusCalls,
    getCancelCalls: () => cancelCalls,
  };
}

async function createOrderFlowAppWithMockProvider() {
  const sentMessages: EmailMessage[] = [];
  const attempts: Array<Record<string, unknown>> = [];
  const productId = 'product-1';
  const tx = {
    user: {
      findUnique: async () => {
        throw new Error('guest order не должен читать User');
      },
    },
    product: {
      findMany: async () => [{ id: productId, priceMinor: 100, isActive: true }],
    },
    inventoryItem: {
      findMany: async () => [{ id: 'inventory-1', productId }],
      findUnique: async () => ({ onHand: 5, reserved: 0 }),
    },
    order: {
      create: async () => ({
        id: 'order-email-smoke',
        customerId: null,
        customerFullName: guestOrderPayload.customerFullName,
        customerEmail: guestOrderPayload.customerEmail,
        customerPhone: guestOrderPayload.customerPhone,
        shippingAddress: guestOrderPayload.shippingAddress,
        status: OrderStatus.NEW,
        paymentStatus: PaymentStatus.PENDING,
        fulfillmentStatus: FulfillmentStatus.RESERVED,
        totalMinor: 100,
        items: [
          { id: 'item-1', productId, quantity: 1, priceMinor: 100, totalMinor: 100 },
        ],
        statusHistory: [],
      }),
    },
    stockMovement: {
      create: async (args: unknown) => args,
    },
    $executeRaw: async () => 1,
  };
  const prisma = {
    $transaction: async (fn: (innerTx: typeof tx) => Promise<unknown>) => fn(tx),
    notificationAttempt: {
      create: async (args: { data: Record<string, unknown> }) => {
        attempts.push(args.data);
        return {
          event: args.data.event,
          status: args.data.status,
          errorMessage: args.data.errorMessage ?? null,
          createdAt: new Date('2026-04-29T00:00:00.000Z'),
        };
      },
    },
  };

  const ordersService = new OrdersService(
    prisma as any,
    new OrderNotificationsService(
      {
        send: async (message: EmailMessage) => {
          sentMessages.push(message);
        },
      } as any,
      prisma as any,
    ),
  );

  const moduleBuilder = Test.createTestingModule({
    controllers: [OrdersController],
    providers: [
      { provide: OrdersService, useValue: ordersService },
    ],
  }).overrideGuard(OwnerAuthGuard).useValue({ canActivate: () => true });
  const moduleRef = await moduleBuilder.compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) =>
        new BadRequestException({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Входные данные не прошли проверку.',
          errors: formatValidationFieldErrors(errors),
        }),
    }),
  );
  await app.init();

  return { app, sentMessages, attempts };
}

const guestOrderPayload = {
  customerFullName: 'Иван Иванов',
  customerEmail: 'ivan@example.com',
  customerPhone: '+995 555 010 010',
  shippingAddress: 'Тбилиси, ул. Руставели, 1',
  items: [{ productId: 'product-1', quantity: 1 }],
};

test('POST /orders: guest payload without customerId returns created order snapshot', async () => {
  const { app, getCreateCalls } = await createApp();

  try {
    const response = await request(app.getHttpServer())
      .post('/orders')
      .send(guestOrderPayload)
      .expect(201);

    assert.equal(response.body.id, 'order-created');
    assert.equal(response.body.customerId, null);
    assert.equal(response.body.customerFullName, guestOrderPayload.customerFullName);
    assert.equal(response.body.customerEmail, guestOrderPayload.customerEmail);
    assert.equal(response.body.customerPhone, guestOrderPayload.customerPhone);
    assert.equal(response.body.shippingAddress, guestOrderPayload.shippingAddress);
    assert.equal(response.body.status, 'NEW');
    assert.equal(response.body.paymentStatus, 'PENDING');
    assert.equal(response.body.fulfillmentStatus, 'RESERVED');
    assert.equal(response.body.totalMinor, 100);
    assert.deepEqual(response.body.items, [
      {
        id: 'item-created',
        productId: 'product-1',
        quantity: 1,
        priceMinor: 100,
        totalMinor: 100,
      },
    ]);
    assert.equal(getCreateCalls(), 1);
  } finally {
    await app.close();
  }
});

test('POST /orders: mock email provider records NotificationAttempt end-to-end', async () => {
  const { app, sentMessages, attempts } = await createOrderFlowAppWithMockProvider();

  try {
    const response = await request(app.getHttpServer())
      .post('/orders')
      .send(guestOrderPayload)
      .expect(201);

    assert.equal(response.body.id, 'order-email-smoke');
    assert.equal(response.body.notification.status, 'SUCCESS');
    assert.equal(response.body.notification.event, 'order-created');
    assert.equal(sentMessages[0]?.tags.orderId, 'order-email-smoke');
    assert.deepEqual(attempts[0], {
      orderId: 'order-email-smoke',
      event: 'order-created',
      status: 'SUCCESS',
    });
  } finally {
    await app.close();
  }
});

test('POST /orders: payload with customerId passes linked customer id to service', async () => {
  const { app } = await createApp({
    create: async (dto) => ({
      id: 'order-linked',
      customerId: dto.customerId,
      customerFullName: dto.customerFullName,
      customerEmail: dto.customerEmail,
      shippingAddress: dto.shippingAddress,
      status: OrderStatus.NEW,
      paymentStatus: 'PENDING',
      fulfillmentStatus: 'RESERVED',
      totalMinor: 100,
      items: [],
      statusHistory: [],
    }),
  });

  try {
    const response = await request(app.getHttpServer())
      .post('/orders')
      .send({ ...guestOrderPayload, customerId: 'customer-1' })
      .expect(201);

    assert.equal(response.body.customerId, 'customer-1');
  } finally {
    await app.close();
  }
});

test('POST /orders: missing snapshot fields returns 400 VALIDATION_ERROR', async () => {
  const { app, getCreateCalls } = await createApp();

  try {
    const response = await request(app.getHttpServer())
      .post('/orders')
      .send({ items: [{ productId: 'product-1', quantity: 1 }] })
      .expect(400);

    assert.equal(response.body.code, 'VALIDATION_ERROR');
    assert.equal(response.body.statusCode, 400);
    assert.ok(
      response.body.errors.some((error: { field?: string }) => error.field === 'customerFullName'),
    );
    assert.ok(
      response.body.errors.some((error: { field?: string }) => error.field === 'customerEmail'),
    );
    assert.ok(
      response.body.errors.some((error: { field?: string }) => error.field === 'shippingAddress'),
    );
    assert.equal(getCreateCalls(), 0);
  } finally {
    await app.close();
  }
});

test('POST /orders: invalid email returns 400 VALIDATION_ERROR', async () => {
  const { app, getCreateCalls } = await createApp();

  try {
    const response = await request(app.getHttpServer())
      .post('/orders')
      .send({ ...guestOrderPayload, customerEmail: 'not-an-email' })
      .expect(400);

    assert.equal(response.body.code, 'VALIDATION_ERROR');
    assert.equal(response.body.errors[0].field, 'customerEmail');
    assert.ok(Array.isArray(response.body.errors[0].messages));
    assert.equal(getCreateCalls(), 0);
  } finally {
    await app.close();
  }
});

test('GET /orders: owner-only list passes filters and pagination to service', async () => {
  let receivedQuery: GetOrdersQueryDto | undefined;
  const { app } = await createApp({
    list: async (query) => {
      receivedQuery = query;
      return {
        items: [
          {
            id: 'order-1',
            customerFullName: 'Иван Иванов',
            customerEmail: 'ivan@example.com',
            customerPhone: null,
            shippingAddress: 'Тбилиси',
            status: OrderStatus.NEW,
            paymentStatus: PaymentStatus.PENDING,
            fulfillmentStatus: FulfillmentStatus.RESERVED,
            totalMinor: 100,
            itemsCount: 1,
            createdAt: new Date('2026-04-29T00:00:00.000Z').toISOString(),
            updatedAt: new Date('2026-04-29T00:00:00.000Z').toISOString(),
          },
        ],
        pagination: { limit: query.limit, offset: query.offset, total: 1 },
      };
    },
  });

  try {
    const response = await request(app.getHttpServer())
      .get('/orders?limit=10&offset=5&status=NEW&from=2026-04-01T00:00:00.000Z')
      .expect(200);

    assert.equal(receivedQuery?.limit, 10);
    assert.equal(receivedQuery?.offset, 5);
    assert.equal(receivedQuery?.status, OrderStatus.NEW);
    assert.equal(receivedQuery?.from, '2026-04-01T00:00:00.000Z');
    assert.equal(response.body.items[0].id, 'order-1');
    assert.deepEqual(response.body.pagination, { limit: 10, offset: 5, total: 1 });
  } finally {
    await app.close();
  }
});

test('GET /orders: invalid status query returns 400 VALIDATION_ERROR', async () => {
  const { app } = await createApp();

  try {
    const response = await request(app.getHttpServer())
      .get('/orders?status=UNKNOWN')
      .expect(400);

    assert.equal(response.body.code, 'VALIDATION_ERROR');
    assert.equal(response.body.errors[0].field, 'status');
  } finally {
    await app.close();
  }
});

test('GET /orders/:id: missing Bearer token returns 401', async () => {
  const { app } = await createApp({
    guardCanActivate: () => {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'AUTH_REQUIRED',
        message: 'Требуется Bearer token владельца.',
      });
    },
  });

  try {
    const response = await request(app.getHttpServer()).get('/orders/order-1').expect(401);

    assert.equal(response.body.code, 'AUTH_REQUIRED');
  } finally {
    await app.close();
  }
});

test('PATCH /orders/:id/status: happy path CONFIRMED -> PACKED', async () => {
  const { app } = await createApp({
    updateStatus: async (id, dto) => ({
      id,
      status: dto.toStatus,
      items: [],
      statusHistory: [
        { id: 'h1', fromStatus: OrderStatus.CONFIRMED, toStatus: OrderStatus.PACKED },
      ],
    }),
  });

  try {
    const response = await request(app.getHttpServer())
      .patch('/orders/order-1/status')
      .send({ toStatus: 'PACKED' })
      .expect(200);

    assert.equal(response.body.id, 'order-1');
    assert.equal(response.body.status, 'PACKED');
  } finally {
    await app.close();
  }
});

test('PATCH /orders/:id/status: invalid payload without toStatus returns 400 VALIDATION_ERROR', async () => {
  const { app, getUpdateStatusCalls } = await createApp();

  try {
    const response = await request(app.getHttpServer())
      .patch('/orders/order-1/status')
      .send({})
      .expect(400);

    assert.equal(response.body.code, 'VALIDATION_ERROR');
    assert.equal(response.body.statusCode, 400);
    assert.equal(typeof response.body.message, 'string');
    assert.equal(getUpdateStatusCalls(), 0);
  } finally {
    await app.close();
  }
});

test('PATCH /orders/:id/status: invalid enum toStatus returns 400 VALIDATION_ERROR', async () => {
  const { app, getUpdateStatusCalls } = await createApp();

  try {
    const response = await request(app.getHttpServer())
      .patch('/orders/order-1/status')
      .send({ toStatus: 'CANCELLED' })
      .expect(400);

    assert.equal(response.body.code, 'VALIDATION_ERROR');
    assert.equal(response.body.errors[0].field, 'toStatus');
    assert.ok(Array.isArray(response.body.errors[0].messages));
    assert.equal(response.body.errors[0].errors, undefined);
    assert.equal(getUpdateStatusCalls(), 0);
  } finally {
    await app.close();
  }
});

test('PATCH /orders/:id/status: invalid transition returns 409 INVALID_ORDER_STATUS_TRANSITION', async () => {
  const { app } = await createApp({
    updateStatus: async () => {
      throw new ConflictException({
        statusCode: 409,
        code: 'INVALID_ORDER_STATUS_TRANSITION',
        message: 'Недопустимый переход.',
      });
    },
  });

  try {
    const response = await request(app.getHttpServer())
      .patch('/orders/order-1/status')
      .send({ toStatus: 'SHIPPED' })
      .expect(409);

    assert.equal(response.body.code, 'INVALID_ORDER_STATUS_TRANSITION');
    assert.equal(response.body.statusCode, 409);
  } finally {
    await app.close();
  }
});

test('PATCH /orders/:id/status: inventory invariant violation returns 409 INVENTORY_INVARIANT_VIOLATION', async () => {
  const { app } = await createApp({
    updateStatus: async () => {
      throw new ConflictException({
        statusCode: 409,
        code: 'INVENTORY_INVARIANT_VIOLATION',
        message: 'Недопустимое состояние склада для отгрузки.',
      });
    },
  });

  try {
    const response = await request(app.getHttpServer())
      .patch('/orders/order-1/status')
      .send({ toStatus: 'SHIPPED' })
      .expect(409);

    assert.equal(response.body.code, 'INVENTORY_INVARIANT_VIOLATION');
    assert.equal(response.body.statusCode, 409);
  } finally {
    await app.close();
  }
});

test('PATCH /orders/:id/status: order not found returns 404', async () => {
  const { app } = await createApp({
    updateStatus: async (id: string) => {
      throw new NotFoundException(`Заказ orderId=${id} не найден.`);
    },
  });

  try {
    const response = await request(app.getHttpServer())
      .patch('/orders/missing-order/status')
      .send({ toStatus: 'PACKED' })
      .expect(404);

    assert.equal(response.body.statusCode, 404);
  } finally {
    await app.close();
  }
});

test('PATCH /orders/:id/cancel: happy path returns CANCELLED', async () => {
  const { app } = await createApp({
    cancel: async (id: string) => ({
      id,
      status: OrderStatus.CANCELLED,
      items: [],
      statusHistory: [
        { id: 'h-cancel', fromStatus: OrderStatus.NEW, toStatus: OrderStatus.CANCELLED },
      ],
    }),
  });

  try {
    const response = await request(app.getHttpServer())
      .patch('/orders/order-2/cancel')
      .send()
      .expect(200);

    assert.equal(response.body.id, 'order-2');
    assert.equal(response.body.status, 'CANCELLED');
  } finally {
    await app.close();
  }
});

test('PATCH /orders/:id/invoice-sent: returns CONFIRMED and INVOICE_SENT', async () => {
  const { app } = await createApp();

  try {
    const response = await request(app.getHttpServer())
      .patch('/orders/order-3/invoice-sent')
      .send({ comment: 'invoice #100' })
      .expect(200);

    assert.equal(response.body.id, 'order-3');
    assert.equal(response.body.status, 'CONFIRMED');
    assert.equal(response.body.paymentStatus, 'INVOICE_SENT');
    assert.equal(response.body.fulfillmentStatus, 'RESERVED');
  } finally {
    await app.close();
  }
});

test('PATCH /orders/:id/payment-confirmed: returns PACKED and PAID', async () => {
  const { app } = await createApp();

  try {
    const response = await request(app.getHttpServer())
      .patch('/orders/order-3/payment-confirmed')
      .send()
      .expect(200);

    assert.equal(response.body.status, 'PACKED');
    assert.equal(response.body.paymentStatus, 'PAID');
  } finally {
    await app.close();
  }
});

test('PATCH /orders/:id/handoff-to-delivery: returns SHIPPED and HANDED_TO_CARRIER', async () => {
  const { app } = await createApp();

  try {
    const response = await request(app.getHttpServer())
      .patch('/orders/order-3/handoff-to-delivery')
      .send()
      .expect(200);

    assert.equal(response.body.status, 'SHIPPED');
    assert.equal(response.body.fulfillmentStatus, 'HANDED_TO_CARRIER');
  } finally {
    await app.close();
  }
});

test('PATCH /orders/:id/delivered: returns DELIVERED statuses', async () => {
  const { app } = await createApp();

  try {
    const response = await request(app.getHttpServer())
      .patch('/orders/order-3/delivered')
      .send()
      .expect(200);

    assert.equal(response.body.status, 'DELIVERED');
    assert.equal(response.body.fulfillmentStatus, 'DELIVERED');
  } finally {
    await app.close();
  }
});

test('POST /orders/:id/notifications/resend: owner can manually resend notification', async () => {
  const { app } = await createApp();

  try {
    const response = await request(app.getHttpServer())
      .post('/orders/order-3/notifications/resend')
      .send()
      .expect(200);

    assert.equal(response.body.id, 'order-3');
    assert.equal(response.body.notification.status, 'SUCCESS');
    assert.equal(response.body.notification.event, 'invoice-issued');
  } finally {
    await app.close();
  }
});

test('manual lifecycle endpoints pass optional comment payload to service', async () => {
  const receivedComments: Record<string, string | undefined> = {};
  const receivedActors: Record<string, string | undefined> = {};
  const { app } = await createApp({
    cancel: async (id, dto, actorId) => {
      receivedComments.cancel = dto?.comment;
      receivedActors.cancel = actorId;
      return { id, status: OrderStatus.CANCELLED, items: [], statusHistory: [] };
    },
    markInvoiceSent: async (id, dto, actorId) => {
      receivedComments.invoiceSent = dto?.comment;
      receivedActors.invoiceSent = actorId;
      return {
        id,
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.INVOICE_SENT,
        fulfillmentStatus: FulfillmentStatus.RESERVED,
        items: [],
        statusHistory: [],
      };
    },
    confirmPayment: async (id, dto, actorId) => {
      receivedComments.paymentConfirmed = dto?.comment;
      receivedActors.paymentConfirmed = actorId;
      return {
        id,
        status: OrderStatus.PACKED,
        paymentStatus: PaymentStatus.PAID,
        fulfillmentStatus: FulfillmentStatus.RESERVED,
        items: [],
        statusHistory: [],
      };
    },
    handOffToDelivery: async (id, dto, actorId) => {
      receivedComments.handoffToDelivery = dto?.comment;
      receivedActors.handoffToDelivery = actorId;
      return {
        id,
        status: OrderStatus.SHIPPED,
        paymentStatus: PaymentStatus.PAID,
        fulfillmentStatus: FulfillmentStatus.HANDED_TO_CARRIER,
        items: [],
        statusHistory: [],
      };
    },
    confirmDelivered: async (id, dto, actorId) => {
      receivedComments.delivered = dto?.comment;
      receivedActors.delivered = actorId;
      return {
        id,
        status: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.PAID,
        fulfillmentStatus: FulfillmentStatus.DELIVERED,
        items: [],
        statusHistory: [],
      };
    },
  });

  try {
    await request(app.getHttpServer())
      .patch('/orders/order-4/cancel')
      .send({ comment: 'cancel reason' })
      .expect(200);
    await request(app.getHttpServer())
      .patch('/orders/order-4/invoice-sent')
      .send({ comment: 'invoice #100' })
      .expect(200);
    await request(app.getHttpServer())
      .patch('/orders/order-4/payment-confirmed')
      .send({ comment: 'bank transfer received' })
      .expect(200);
    await request(app.getHttpServer())
      .patch('/orders/order-4/handoff-to-delivery')
      .send({ comment: 'carrier pickup' })
      .expect(200);
    await request(app.getHttpServer())
      .patch('/orders/order-4/delivered')
      .send({ comment: 'customer confirmed' })
      .expect(200);

    assert.deepEqual(receivedComments, {
      cancel: 'cancel reason',
      invoiceSent: 'invoice #100',
      paymentConfirmed: 'bank transfer received',
      handoffToDelivery: 'carrier pickup',
      delivered: 'customer confirmed',
    });
    assert.deepEqual(receivedActors, {
      cancel: 'owner-1',
      invoiceSent: 'owner-1',
      paymentConfirmed: 'owner-1',
      handoffToDelivery: 'owner-1',
      delivered: 'owner-1',
    });
  } finally {
    await app.close();
  }
});

const manualLifecycleEndpointCases = [
  {
    path: '/orders/order-5/invoice-sent',
    overrideName: 'markInvoiceSent',
  },
  {
    path: '/orders/order-5/payment-confirmed',
    overrideName: 'confirmPayment',
  },
  {
    path: '/orders/order-5/handoff-to-delivery',
    overrideName: 'handOffToDelivery',
  },
  {
    path: '/orders/order-5/delivered',
    overrideName: 'confirmDelivered',
  },
] as const;

for (const { path, overrideName } of manualLifecycleEndpointCases) {
  test(`PATCH ${path}: invalid comment payload returns 400 VALIDATION_ERROR`, async () => {
    let serviceCalls = 0;
    const overrides = {
      [overrideName]: async () => {
        serviceCalls += 1;
        return {};
      },
    } as NonNullable<Parameters<typeof createApp>[0]>;
    const { app } = await createApp(overrides);

    try {
      const response = await request(app.getHttpServer())
        .patch(path)
        .send({ comment: '' })
        .expect(400);

      assert.equal(response.body.code, 'VALIDATION_ERROR');
      assert.equal(response.body.statusCode, 400);
      assert.equal(response.body.errors[0].field, 'comment');
      assert.equal(serviceCalls, 0);
    } finally {
      await app.close();
    }
  });

  test(`PATCH ${path}: order not found returns 404`, async () => {
    const overrides = {
      [overrideName]: async () => {
        throw new NotFoundException('Заказ orderId=order-5 не найден.');
      },
    } as NonNullable<Parameters<typeof createApp>[0]>;
    const { app } = await createApp(overrides);

    try {
      const response = await request(app.getHttpServer())
        .patch(path)
        .send()
        .expect(404);

      assert.equal(response.body.statusCode, 404);
    } finally {
      await app.close();
    }
  });

  test(`PATCH ${path}: invalid lifecycle transition returns 409`, async () => {
    const overrides = {
      [overrideName]: async () => {
        throw new ConflictException({
          statusCode: 409,
          code: 'INVALID_ORDER_STATUS_TRANSITION',
          message: 'Недопустимый переход.',
        });
      },
    } as NonNullable<Parameters<typeof createApp>[0]>;
    const { app } = await createApp(overrides);

    try {
      const response = await request(app.getHttpServer())
        .patch(path)
        .send()
        .expect(409);

      assert.equal(response.body.code, 'INVALID_ORDER_STATUS_TRANSITION');
      assert.equal(response.body.statusCode, 409);
    } finally {
      await app.close();
    }
  });
}

test('PATCH /orders/:id/handoff-to-delivery: invalid lifecycle transition returns 409', async () => {
  const { app } = await createApp({
    handOffToDelivery: async () => {
      throw new ConflictException({
        statusCode: 409,
        code: 'INVALID_ORDER_STATUS_TRANSITION',
        message: 'Недопустимый переход.',
      });
    },
  });

  try {
    const response = await request(app.getHttpServer())
      .patch('/orders/order-3/handoff-to-delivery')
      .send()
      .expect(409);

    assert.equal(response.body.code, 'INVALID_ORDER_STATUS_TRANSITION');
  } finally {
    await app.close();
  }
});

test('PATCH /orders/:id/cancel: invalid transition returns 409 INVALID_ORDER_STATUS_TRANSITION', async () => {
  const { app } = await createApp({
    cancel: async () => {
      throw new ConflictException({
        statusCode: 409,
        code: 'INVALID_ORDER_STATUS_TRANSITION',
        message: 'Недопустимый переход.',
      });
    },
  });

  try {
    const response = await request(app.getHttpServer())
      .patch('/orders/order-2/cancel')
      .send()
      .expect(409);

    assert.equal(response.body.code, 'INVALID_ORDER_STATUS_TRANSITION');
    assert.equal(response.body.statusCode, 409);
  } finally {
    await app.close();
  }
});

test('PATCH /orders/:id/cancel: reserved invariant violation returns 409 INVENTORY_INVARIANT_VIOLATION', async () => {
  const { app } = await createApp({
    cancel: async () => {
      throw new ConflictException({
        statusCode: 409,
        code: 'INVENTORY_INVARIANT_VIOLATION',
        message: 'Недопустимое состояние резерва.',
      });
    },
  });

  try {
    const response = await request(app.getHttpServer())
      .patch('/orders/order-2/cancel')
      .send()
      .expect(409);

    assert.equal(response.body.code, 'INVENTORY_INVARIANT_VIOLATION');
    assert.equal(response.body.statusCode, 409);
  } finally {
    await app.close();
  }
});

test('PATCH /orders/:id/cancel: order not found returns 404', async () => {
  const { app, getCancelCalls } = await createApp({
    cancel: async (id: string) => {
      throw new NotFoundException(`Заказ orderId=${id} не найден.`);
    },
  });

  try {
    const response = await request(app.getHttpServer())
      .patch('/orders/missing-order/cancel')
      .send()
      .expect(404);

    assert.equal(response.body.statusCode, 404);
    assert.equal(getCancelCalls(), 0);
  } finally {
    await app.close();
  }
});
