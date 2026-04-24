import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { OrdersService } from './orders.service.js';

test('OrdersService.cancel снимает резерв и переводит заказ в CANCELLED', async () => {
  const updates: Array<{
    where: { productId: string };
    data: { reserved?: { decrement: number }; onHand?: { decrement: number } };
  }> = [];

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
      findUnique: async () => ({ productId: 'product-1', reserved: 2 }),
      update: async (args: {
        where: { productId: string };
        data: { reserved?: { decrement: number }; onHand?: { decrement: number } };
      }) => {
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
  assert.equal(result.data.statusHistory.create.toStatus, OrderStatus.CANCELLED);
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
      findUnique: async () => ({ productId: 'product-1', reserved: 1 }),
      update: async () => ({}),
    },
  };

  const prisma = {
    $transaction: async (fn: (innerTx: typeof tx) => Promise<unknown>) => fn(tx),
  } as any;

  const service = new OrdersService(prisma);

  await assert.rejects(() => service.cancel('order-2'), (error: unknown) => {
    if (!(error instanceof ConflictException)) {
      return false;
    }
    const body = error.getResponse() as { code?: string };
    return body.code === 'INVALID_ORDER_STATUS_TRANSITION';
  });
});

test('OrdersService.cancel возвращает NotFound, если заказ не существует', async () => {
  const tx = {
    order: {
      findUnique: async () => null,
    },
    inventoryItem: {
      findUnique: async () => ({ productId: 'product-1', reserved: 1 }),
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

test('OrdersService.updateStatus выполняет переход PACKED -> SHIPPED и обновляет склад', async () => {
  const inventoryUpdates: Array<{
    where: { productId: string };
    data: { reserved?: { decrement: number }; onHand?: { decrement: number } };
  }> = [];

  const tx = {
    order: {
      findUnique: async () => ({
        id: 'order-10',
        status: OrderStatus.PACKED,
        items: [{ productId: 'product-1', quantity: 2 }],
      }),
      update: async (args: unknown) => args,
    },
    inventoryItem: {
      findUnique: async () => ({ productId: 'product-1', onHand: 5, reserved: 2 }),
      update: async (args: {
        where: { productId: string };
        data: { reserved?: { decrement: number }; onHand?: { decrement: number } };
      }) => {
        inventoryUpdates.push(args);
        return {};
      },
    },
  };

  const prisma = {
    $transaction: async (fn: (innerTx: typeof tx) => Promise<unknown>) => fn(tx),
  } as any;

  const service = new OrdersService(prisma);
  const result = (await service.updateStatus('order-10', {
    toStatus: OrderStatus.SHIPPED,
  })) as any;

  assert.equal(inventoryUpdates.length, 1);
  assert.deepEqual(inventoryUpdates[0], {
    where: { productId: 'product-1' },
    data: {
      onHand: { decrement: 2 },
      reserved: { decrement: 2 },
    },
  });
  assert.equal(result.data.status, OrderStatus.SHIPPED);
  assert.equal(result.data.statusHistory.create.fromStatus, OrderStatus.PACKED);
  assert.equal(result.data.statusHistory.create.toStatus, OrderStatus.SHIPPED);
});

test('OrdersService.updateStatus возвращает 400 VALIDATION_ERROR для toStatus=CANCELLED', async () => {
  const prisma = {
    $transaction: async () => {
      throw new Error('$transaction не должен вызываться при невалидном payload');
    },
  } as any;

  const service = new OrdersService(prisma);

  await assert.rejects(
    () =>
      service.updateStatus('order-11', {
        toStatus: OrderStatus.CANCELLED,
      }),
    (error: unknown) => {
      if (!(error instanceof BadRequestException)) {
        return false;
      }
      const body = error.getResponse() as { code?: string; statusCode?: number };
      return body.code === 'VALIDATION_ERROR' && body.statusCode === 400;
    },
  );
});

test('OrdersService.updateStatus возвращает конфликт при недопустимом переходе', async () => {
  const tx = {
    order: {
      findUnique: async () => ({
        id: 'order-11',
        status: OrderStatus.CONFIRMED,
        items: [{ productId: 'product-1', quantity: 1 }],
      }),
    },
    inventoryItem: {
      findUnique: async () => ({ productId: 'product-1', onHand: 5, reserved: 5 }),
      update: async () => ({}),
    },
  };

  const prisma = {
    $transaction: async (fn: (innerTx: typeof tx) => Promise<unknown>) => fn(tx),
  } as any;

  const service = new OrdersService(prisma);

  await assert.rejects(
    () =>
      service.updateStatus('order-11', {
        toStatus: OrderStatus.SHIPPED,
      }),
    (error: unknown) => {
      if (!(error instanceof ConflictException)) {
        return false;
      }
      const body = error.getResponse() as { code?: string };
      return body.code === 'INVALID_ORDER_STATUS_TRANSITION';
    },
  );
});

test('OrdersService.cancel возвращает конфликт при нарушении инварианта reserved', async () => {
  const tx = {
    order: {
      findUnique: async () => ({
        id: 'order-13',
        status: OrderStatus.NEW,
        items: [{ productId: 'product-1', quantity: 2 }],
      }),
    },
    inventoryItem: {
      findUnique: async () => ({ productId: 'product-1', reserved: 1 }),
      update: async () => ({}),
    },
  };

  const prisma = {
    $transaction: async (fn: (innerTx: typeof tx) => Promise<unknown>) => fn(tx),
  } as any;

  const service = new OrdersService(prisma);

  await assert.rejects(() => service.cancel('order-13'), (error: unknown) => {
    if (!(error instanceof ConflictException)) {
      return false;
    }
    const body = error.getResponse() as { code?: string };
    return body.code === 'INVENTORY_INVARIANT_VIOLATION';
  });
});

test('OrdersService.updateStatus возвращает конфликт при нарушении инварианта склада на SHIPPED', async () => {
  const tx = {
    order: {
      findUnique: async () => ({
        id: 'order-12',
        status: OrderStatus.PACKED,
        items: [{ productId: 'product-1', quantity: 3 }],
      }),
    },
    inventoryItem: {
      findUnique: async () => ({ productId: 'product-1', onHand: 2, reserved: 3 }),
      update: async () => ({}),
    },
  };

  const prisma = {
    $transaction: async (fn: (innerTx: typeof tx) => Promise<unknown>) => fn(tx),
  } as any;

  const service = new OrdersService(prisma);

  await assert.rejects(
    () =>
      service.updateStatus('order-12', {
        toStatus: OrderStatus.SHIPPED,
      }),
    (error: unknown) => {
      if (!(error instanceof ConflictException)) {
        return false;
      }
      const body = error.getResponse() as { code?: string };
      return body.code === 'INVENTORY_INVARIANT_VIOLATION';
    },
  );
});

test('OrdersService.updateStatus возвращает NotFound для несуществующего заказа', async () => {
  const tx = {
    order: {
      findUnique: async () => null,
    },
    inventoryItem: {
      findUnique: async () => ({ productId: 'product-1', onHand: 5, reserved: 5 }),
      update: async () => ({}),
    },
  };

  const prisma = {
    $transaction: async (fn: (innerTx: typeof tx) => Promise<unknown>) => fn(tx),
  } as any;

  const service = new OrdersService(prisma);

  await assert.rejects(
    () =>
      service.updateStatus('missing-order', {
        toStatus: OrderStatus.PACKED,
      }),
    (error: unknown) => error instanceof NotFoundException,
  );
});
