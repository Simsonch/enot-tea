import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ConflictException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { OrderStatus } from '@prisma/client';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { CreateOrderDto, UpdateOrderStatusDto } from './orders.dto.js';
import { formatValidationFieldErrors } from '../common/validation-error-format.js';

// `tsx` test runtime may miss design-time metadata for decorated parameters.
// Define it explicitly so ValidationPipe can validate DTO on the API boundary.
Reflect.defineMetadata(
  'design:paramtypes',
  [String, UpdateOrderStatusDto],
  OrdersController.prototype,
  'updateStatus',
);
Reflect.defineMetadata(
  'design:paramtypes',
  [CreateOrderDto],
  OrdersController.prototype,
  'create',
);

async function createApp(overrides?: {
  create?: (dto: CreateOrderDto) => Promise<unknown>;
  updateStatus?: (id: string, dto: { toStatus: OrderStatus; comment?: string }) => Promise<unknown>;
  cancel?: (id: string) => Promise<unknown>;
}) {
  let createCalls = 0;
  let updateStatusCalls = 0;
  let cancelCalls = 0;

  const ordersServiceMock = {
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
          items: [],
          statusHistory: [],
        };
      }),
    cancel:
      overrides?.cancel ??
      (async (id: string) => {
        cancelCalls += 1;
        return { id, status: OrderStatus.CANCELLED, items: [], statusHistory: [] };
      }),
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
  };

  const moduleRef = await Test.createTestingModule({
    controllers: [OrdersController],
    providers: [{ provide: OrdersService, useValue: ordersServiceMock }],
  }).compile();

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
    assert.equal(response.body.shippingAddress, guestOrderPayload.shippingAddress);
    assert.equal(getCreateCalls(), 1);
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
