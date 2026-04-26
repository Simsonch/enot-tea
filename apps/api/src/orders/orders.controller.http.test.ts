import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ConflictException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { OrderStatus } from '@prisma/client';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { UpdateOrderStatusDto } from './orders.dto.js';
import { formatValidationFieldErrors } from '../common/validation-error-format.js';

// `tsx` test runtime may miss design-time metadata for decorated parameters.
// Define it explicitly so ValidationPipe can validate DTO on the API boundary.
Reflect.defineMetadata(
  'design:paramtypes',
  [String, UpdateOrderStatusDto],
  OrdersController.prototype,
  'updateStatus',
);

async function createApp(overrides?: {
  updateStatus?: (id: string, dto: { toStatus: OrderStatus; comment?: string }) => Promise<unknown>;
  cancel?: (id: string) => Promise<unknown>;
}) {
  let updateStatusCalls = 0;
  let cancelCalls = 0;

  const ordersServiceMock = {
    getById: async () => ({}),
    create: async () => ({}),
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
    getUpdateStatusCalls: () => updateStatusCalls,
    getCancelCalls: () => cancelCalls,
  };
}

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
