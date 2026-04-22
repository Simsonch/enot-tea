import test from 'node:test';
import assert from 'node:assert/strict';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { OrdersService } from './orders.service.js';

test('OrdersService.cancel снимает резерв и переводит заказ в CANCELLED', async () => {
  const updates: Array<{ where: { productId: string }; data: { reserved: { decrement: number } } }> = [];

  const tx = {
    order: {
      findUnique: async () => ({
        id: 'order-1',
        status: OrderStatus.NEW,
        items: [{ productId: 'product-1', quantity: 2 }],
      }),
      update: async (args: unknown) => args,
    },
    inventoryItem: {
      update: async (args: { where: { productId: string }; data: { reserved: { decrement: number } } }) => {
        updates.push(args);
        return {};
      },
    },
  };

  const prisma = {
    $transaction: async (fn: (innerTx: typeof tx) => Promise<unknown>) => fn(tx),
  } as any;

  const service = new OrdersService(prisma);
  const result = (await service.cancel('order-1')) as any;

  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0], {
    where: { productId: 'product-1' },
    data: { reserved: { decrement: 2 } },
  });
  assert.equal(result.data.status, OrderStatus.CANCELLED);
});

test('OrdersService.cancel возвращает конфликт для неотменяемого статуса', async () => {
  const tx = {
    order: {
      findUnique: async () => ({
        id: 'order-2',
        status: OrderStatus.SHIPPED,
        items: [{ productId: 'product-1', quantity: 1 }],
      }),
    },
    inventoryItem: {
      update: async () => ({}),
    },
  };

  const prisma = {
    $transaction: async (fn: (innerTx: typeof tx) => Promise<unknown>) => fn(tx),
  } as any;

  const service = new OrdersService(prisma);

  await assert.rejects(() => service.cancel('order-2'), (error: unknown) => {
    return error instanceof ConflictException;
  });
});

test('OrdersService.cancel возвращает NotFound, если заказ не существует', async () => {
  const tx = {
    order: {
      findUnique: async () => null,
    },
    inventoryItem: {
      update: async () => ({}),
    },
  };

  const prisma = {
    $transaction: async (fn: (innerTx: typeof tx) => Promise<unknown>) => fn(tx),
  } as any;

  const service = new OrdersService(prisma);

  await assert.rejects(() => service.cancel('missing-order'), (error: unknown) => {
    return error instanceof NotFoundException;
  });
});

test('OrdersService.getById возвращает заказ с позициями и историей', async () => {
  const tx = {
    order: {
      findUnique: async () => ({
        id: 'order-3',
        status: OrderStatus.CONFIRMED,
        items: [{ id: 'item-1', productId: 'product-1', quantity: 1, priceMinor: 100, totalMinor: 100 }],
        statusHistory: [{ id: 'history-1', fromStatus: OrderStatus.NEW, toStatus: OrderStatus.CONFIRMED }],
      }),
    },
  };

  const prisma = {
    order: tx.order,
  } as any;

  const service = new OrdersService(prisma);
  const result = await service.getById('order-3');

  assert.equal(result.id, 'order-3');
  assert.equal(result.items.length, 1);
  assert.equal(result.statusHistory.length, 1);
});

test('OrdersService.getById возвращает NotFound, если заказ не найден', async () => {
  const prisma = {
    order: {
      findUnique: async () => null,
    },
  } as any;

  const service = new OrdersService(prisma);

  await assert.rejects(() => service.getById('missing-order'), (error: unknown) => {
    return error instanceof NotFoundException;
  });
});

test('OrdersService.create: ConflictException с кодом и деталями при нехватке остатка', async () => {
  const productId = 'product-1';
  const customerId = 'customer-1';

  const tx = {
    user: {
      findUnique: async () => ({ id: customerId }),
    },
    product: {
      findMany: async () => [{ id: productId, priceMinor: 100 }],
    },
    inventoryItem: {
      findMany: async () => [
        { productId, onHand: 3, reserved: 2 },
      ],
      update: async () => ({}),
    },
    order: {
      create: async () => {
        throw new Error('create не должен вызываться при нехватке остатка');
      },
    },
  };

  const prisma = {
    $transaction: async (fn: (innerTx: typeof tx) => Promise<unknown>) => fn(tx),
  } as any;

  const service = new OrdersService(prisma);

  await assert.rejects(
    () =>
      service.create({
        customerId,
        items: [{ productId, quantity: 2 }],
      }),
    (error: unknown) => {
      assert.ok(error instanceof ConflictException);
      const body = (error as ConflictException).getResponse() as {
        code?: string;
        message?: string;
        details?: { productId: string; requested: number; available: number };
      };
      assert.equal(body.code, 'INSUFFICIENT_STOCK');
      assert.equal(typeof body.message, 'string');
      assert.equal(body.details?.productId, productId);
      assert.equal(body.details?.requested, 2);
      assert.equal(body.details?.available, 1);
      return true;
    },
  );
});
