import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  FulfillmentStatus,
  OrderStatus,
  OrderStatusDimension,
  PaymentStatus,
} from '@prisma/client';
import { OrdersService } from './orders.service.js';

type StockMovementCreate = {
  data: {
    inventoryItemId: string;
    orderId?: string;
    orderItemId?: string;
    deltaOnHand?: number;
    deltaReserved?: number;
    reason: string;
  };
};

const guestSnapshot = {
  customerFullName: 'Иван Иванов',
  customerEmail: 'ivan@example.com',
  customerPhone: '+995555010010',
  shippingAddress: 'Тбилиси, ул. Руставели, 1',
};

test('OrdersService.create атомарно резервирует последний остаток без oversell', async () => {
  const productId = 'product-1';
  const inventory = { id: 'inventory-1', productId, onHand: 1, reserved: 0 };
  const movements: StockMovementCreate[] = [];
  let orderSequence = 0;

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
      findMany: async () => [{ id: inventory.id, productId }],
      findUnique: async () => ({
        onHand: inventory.onHand,
        reserved: inventory.reserved,
      }),
    },
    order: {
      create: async () => {
        orderSequence += 1;
        return {
          id: `order-${orderSequence}`,
          customerId: null,
          ...guestSnapshot,
          status: OrderStatus.NEW,
          paymentStatus: PaymentStatus.PENDING,
          fulfillmentStatus: FulfillmentStatus.RESERVED,
          totalMinor: 100,
          items: [
            {
              id: `item-${orderSequence}`,
              productId,
              quantity: 1,
              priceMinor: 100,
              totalMinor: 100,
            },
          ],
          statusHistory: [
            {
              id: `history-${orderSequence}`,
              statusDimension: OrderStatusDimension.ORDER,
              fromStatus: null,
              toStatus: OrderStatus.NEW,
              comment: 'Создание заказа',
            },
          ],
        };
      },
    },
    stockMovement: {
      create: async (args: StockMovementCreate) => {
        movements.push(args);
        return args;
      },
    },
    $executeRaw: async (_strings: TemplateStringsArray, quantity: number) => {
      if (inventory.onHand - inventory.reserved < quantity) {
        return 0;
      }
      inventory.reserved += quantity;
      return 1;
    },
  };

  const prisma = {
    $transaction: async (fn: (innerTx: typeof tx) => Promise<unknown>) => fn(tx),
  } as any;

  const service = new OrdersService(prisma);
  const results = await Promise.allSettled([
    service.create({ ...guestSnapshot, items: [{ productId, quantity: 1 }] }),
    service.create({ ...guestSnapshot, items: [{ productId, quantity: 1 }] }),
  ]);

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const rejected = results.find((result) => result.status === 'rejected');
  assert.ok(rejected?.status === 'rejected');
  assert.ok(rejected.reason instanceof ConflictException);
  const body = rejected.reason.getResponse() as { code?: string };
  assert.equal(body.code, 'INSUFFICIENT_STOCK');
  assert.equal(inventory.reserved, 1);
  assert.equal(movements.length, 1);
  assert.equal(movements[0]?.data.reason, 'ORDER_RESERVE');
});

test('OrdersService.create пишет стартовую историю статуса и StockMovement резерва', async () => {
  const productId = 'product-1';
  const movements: StockMovementCreate[] = [];
  let rawUpdateCalls = 0;

  const tx = {
    user: {
      findUnique: async () => {
        throw new Error('guest order не должен читать User');
      },
    },
    product: {
      findMany: async () => [{ id: productId, priceMinor: 250, isActive: true }],
    },
    inventoryItem: {
      findMany: async () => [{ id: 'inventory-1', productId }],
      findUnique: async () => ({ onHand: 5, reserved: 0 }),
    },
    order: {
      create: async (args: any) => {
        assert.equal(args.data.customer, undefined);
        assert.equal(args.data.customerFullName, guestSnapshot.customerFullName);
        assert.equal(args.data.customerEmail, guestSnapshot.customerEmail);
        assert.equal(args.data.customerPhone, guestSnapshot.customerPhone);
        assert.equal(args.data.shippingAddress, guestSnapshot.shippingAddress);
        assert.equal(args.data.status, OrderStatus.NEW);
        assert.equal(args.data.paymentStatus, PaymentStatus.PENDING);
        assert.equal(args.data.fulfillmentStatus, FulfillmentStatus.RESERVED);
        assert.deepEqual(args.data.statusHistory.create, {
          statusDimension: OrderStatusDimension.ORDER,
          fromStatus: null,
          toStatus: OrderStatus.NEW,
          comment: 'Создание заказа',
        });
        return {
          id: 'order-1',
          customerId: null,
          ...guestSnapshot,
          status: OrderStatus.NEW,
          paymentStatus: PaymentStatus.PENDING,
          fulfillmentStatus: FulfillmentStatus.RESERVED,
          totalMinor: 500,
          items: [
            { id: 'item-1', productId, quantity: 2, priceMinor: 250, totalMinor: 500 },
          ],
          statusHistory: [
            {
              id: 'history-1',
              statusDimension: OrderStatusDimension.ORDER,
              fromStatus: null,
              toStatus: OrderStatus.NEW,
            },
          ],
        };
      },
    },
    stockMovement: {
      create: async (args: StockMovementCreate) => {
        movements.push(args);
        return args;
      },
    },
    $executeRaw: async () => {
      rawUpdateCalls += 1;
      return 1;
    },
  };

  const prisma = {
    $transaction: async (fn: (innerTx: typeof tx) => Promise<unknown>) => fn(tx),
  } as any;

  const service = new OrdersService(prisma);
  const result = (await service.create({
    ...guestSnapshot,
    items: [{ productId, quantity: 2 }],
  })) as any;

  assert.deepEqual(
    {
      customerId: result.customerId,
      customerFullName: result.customerFullName,
      customerEmail: result.customerEmail,
      customerPhone: result.customerPhone,
      shippingAddress: result.shippingAddress,
    },
    {
      customerId: null,
      ...guestSnapshot,
    },
  );
  assert.equal(result.status, OrderStatus.NEW);
  assert.equal(result.paymentStatus, PaymentStatus.PENDING);
  assert.equal(result.fulfillmentStatus, FulfillmentStatus.RESERVED);
  assert.equal(result.customerId, null);
  assert.equal(rawUpdateCalls, 1);
  assert.deepEqual(movements[0], {
    data: {
      inventoryItemId: 'inventory-1',
      orderId: 'order-1',
      orderItemId: 'item-1',
      deltaReserved: 2,
      reason: 'ORDER_RESERVE',
    },
  });
});

test('OrdersService.create возвращает 409 PRODUCT_INACTIVE для неактивного товара', async () => {
  const productId = 'product-1';
  const tx = {
    user: {
      findUnique: async () => {
        throw new Error('guest order не должен читать User');
      },
    },
    product: {
      findMany: async () => [{ id: productId, priceMinor: 100, isActive: false }],
    },
    inventoryItem: {
      findMany: async () => {
        throw new Error('inventory не должен читаться для неактивного товара');
      },
    },
    order: {
      create: async () => {
        throw new Error('order не должен создаваться для неактивного товара');
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
        ...guestSnapshot,
        items: [{ productId, quantity: 1 }],
      }),
    (error: unknown) => {
      assert.ok(error instanceof ConflictException);
      const body = (error as ConflictException).getResponse() as {
        code?: string;
        details?: { productId?: string };
      };
      assert.equal(body.code, 'PRODUCT_INACTIVE');
      assert.equal(body.details?.productId, productId);
      return true;
    },
  );
});

test('OrdersService.create возвращает NotFound, если товар не найден', async () => {
  const tx = {
    user: {
      findUnique: async () => {
        throw new Error('guest order не должен читать User');
      },
    },
    product: {
      findMany: async () => [],
    },
    inventoryItem: {
      findMany: async () => {
        throw new Error('inventory не должен читаться без найденного товара');
      },
    },
    order: {
      create: async () => {
        throw new Error('order не должен создаваться без найденного товара');
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
        ...guestSnapshot,
        items: [{ productId: 'missing-product', quantity: 1 }],
      }),
    (error: unknown) => error instanceof NotFoundException,
  );
});

test('OrdersService.create возвращает NotFound, если inventory row не найден', async () => {
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
      findMany: async () => [],
    },
    order: {
      create: async () => {
        throw new Error('order не должен создаваться без inventory row');
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
        ...guestSnapshot,
        items: [{ productId, quantity: 1 }],
      }),
    (error: unknown) => error instanceof NotFoundException,
  );
});

test('OrdersService.create возвращает 409 INSUFFICIENT_STOCK и не пишет движение', async () => {
  const productId = 'product-1';
  const movements: StockMovementCreate[] = [];
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
      findUnique: async () => ({ onHand: 1, reserved: 1 }),
    },
    order: {
      create: async () => ({
        id: 'order-insufficient-stock',
        customerId: null,
        ...guestSnapshot,
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
      create: async (args: StockMovementCreate) => {
        movements.push(args);
        return args;
      },
    },
    $executeRaw: async () => 0,
  };

  const prisma = {
    $transaction: async (fn: (innerTx: typeof tx) => Promise<unknown>) => fn(tx),
  } as any;

  const service = new OrdersService(prisma);

  await assert.rejects(
    () =>
      service.create({
        ...guestSnapshot,
        items: [{ productId, quantity: 1 }],
      }),
    (error: unknown) => {
      assert.ok(error instanceof ConflictException);
      const body = (error as ConflictException).getResponse() as {
        code?: string;
        details?: { productId?: string; requested?: number; available?: number };
      };
      assert.equal(body.code, 'INSUFFICIENT_STOCK');
      assert.deepEqual(body.details, { productId, requested: 1, available: 0 });
      return true;
    },
  );
  assert.equal(movements.length, 0);
});

test('OrdersService.create возвращает NotFound, если заказчик не существует', async () => {
  const tx = {
    user: {
      findUnique: async () => null,
    },
  };

  const prisma = {
    $transaction: async (fn: (innerTx: typeof tx) => Promise<unknown>) => fn(tx),
  } as any;

  const service = new OrdersService(prisma);

  await assert.rejects(
    () =>
      service.create({
        customerId: 'missing',
        ...guestSnapshot,
        items: [{ productId: 'product-1', quantity: 1 }],
      }),
    (error: unknown) => error instanceof NotFoundException,
  );
});

test('OrdersService.cancel снимает резерв и пишет StockMovement', async () => {
  const inventoryUpdates: unknown[] = [];
  const movements: StockMovementCreate[] = [];

  const tx = {
    order: {
      findUnique: async () => ({
        id: 'order-1',
        status: OrderStatus.NEW,
        paymentStatus: PaymentStatus.PENDING,
        fulfillmentStatus: FulfillmentStatus.RESERVED,
        items: [{ id: 'item-1', productId: 'product-1', quantity: 2 }],
      }),
      update: async (args: unknown) => args,
    },
    inventoryItem: {
      findUnique: async () => ({ id: 'inventory-1', productId: 'product-1', reserved: 2 }),
      updateMany: async (args: unknown) => {
        inventoryUpdates.push(args);
        return { count: 1 };
      },
    },
    stockMovement: {
      create: async (args: StockMovementCreate) => {
        movements.push(args);
        return args;
      },
    },
  };

  const prisma = {
    $transaction: async (fn: (innerTx: typeof tx) => Promise<unknown>) => fn(tx),
  } as any;

  const service = new OrdersService(prisma);
  const result = (await service.cancel('order-1')) as any;

  assert.equal(inventoryUpdates.length, 1);
  assert.deepEqual(inventoryUpdates[0], {
    where: {
      id: 'inventory-1',
      reserved: { gte: 2 },
    },
    data: { reserved: { decrement: 2 } },
  });
  assert.deepEqual(movements[0], {
    data: {
      inventoryItemId: 'inventory-1',
      orderId: 'order-1',
      orderItemId: 'item-1',
      deltaReserved: -2,
      reason: 'ORDER_CANCEL_RELEASE',
    },
  });
  assert.equal(result.data.status, OrderStatus.CANCELLED);
  assert.equal(result.data.paymentStatus, PaymentStatus.PENDING);
  assert.equal(result.data.fulfillmentStatus, FulfillmentStatus.RESERVED);
  assert.deepEqual(result.data.statusHistory.create, [
    {
      statusDimension: OrderStatusDimension.ORDER,
      fromStatus: OrderStatus.NEW,
      toStatus: OrderStatus.CANCELLED,
      comment: 'Отмена заказа',
    },
  ]);
});

test('OrdersService.cancel допускает legacy not-shipped комбинацию и сохраняет paymentStatus', async () => {
  const tx = {
    order: {
      findUnique: async () => ({
        id: 'order-legacy-cancel',
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PENDING,
        fulfillmentStatus: FulfillmentStatus.RESERVED,
        items: [{ id: 'item-1', productId: 'product-1', quantity: 1 }],
      }),
      update: async (args: unknown) => args,
    },
    inventoryItem: {
      findUnique: async () => ({ id: 'inventory-1', productId: 'product-1', reserved: 1 }),
      updateMany: async () => ({ count: 1 }),
    },
    stockMovement: {
      create: async (args: StockMovementCreate) => args,
    },
  };

  const prisma = {
    $transaction: async (fn: (innerTx: typeof tx) => Promise<unknown>) => fn(tx),
  } as any;

  const service = new OrdersService(prisma);
  const result = (await service.cancel('order-legacy-cancel')) as any;

  assert.equal(result.data.status, OrderStatus.CANCELLED);
  assert.equal(result.data.paymentStatus, PaymentStatus.PENDING);
});

test('OrdersService.markInvoiceSent обновляет order/payment статусы и пишет историю', async () => {
  const tx = {
    order: {
      findUnique: async () => ({
        id: 'order-invoice',
        status: OrderStatus.NEW,
        paymentStatus: PaymentStatus.PENDING,
        fulfillmentStatus: FulfillmentStatus.RESERVED,
        items: [{ id: 'item-1', productId: 'product-1', quantity: 1 }],
      }),
      update: async (args: unknown) => args,
    },
  };

  const prisma = {
    $transaction: async (fn: (innerTx: typeof tx) => Promise<unknown>) => fn(tx),
  } as any;

  const service = new OrdersService(prisma);
  const result = (await service.markInvoiceSent('order-invoice')) as any;

  assert.equal(result.data.status, OrderStatus.CONFIRMED);
  assert.equal(result.data.paymentStatus, PaymentStatus.INVOICE_SENT);
  assert.equal(result.data.fulfillmentStatus, FulfillmentStatus.RESERVED);
  assert.deepEqual(result.data.statusHistory.create, [
    {
      statusDimension: OrderStatusDimension.ORDER,
      fromStatus: OrderStatus.NEW,
      toStatus: OrderStatus.CONFIRMED,
      comment: 'Счет выставлен',
    },
    {
      statusDimension: OrderStatusDimension.PAYMENT,
      fromPaymentStatus: PaymentStatus.PENDING,
      toPaymentStatus: PaymentStatus.INVOICE_SENT,
      comment: 'Счет выставлен',
    },
  ]);
});

test('OrdersService.markInvoiceSent пишет changedById для owner action', async () => {
  const tx = {
    order: {
      findUnique: async () => ({
        id: 'order-invoice-owner',
        status: OrderStatus.NEW,
        paymentStatus: PaymentStatus.PENDING,
        fulfillmentStatus: FulfillmentStatus.RESERVED,
        items: [{ id: 'item-1', productId: 'product-1', quantity: 1 }],
      }),
      update: async (args: unknown) => args,
    },
  };

  const prisma = {
    $transaction: async (fn: (innerTx: typeof tx) => Promise<unknown>) => fn(tx),
  } as any;

  const service = new OrdersService(prisma);
  const result = (await service.markInvoiceSent(
    'order-invoice-owner',
    {},
    'owner-1',
  )) as any;

  assert.deepEqual(result.data.statusHistory.create, [
    {
      statusDimension: OrderStatusDimension.ORDER,
      fromStatus: OrderStatus.NEW,
      toStatus: OrderStatus.CONFIRMED,
      changedById: 'owner-1',
      comment: 'Счет выставлен',
    },
    {
      statusDimension: OrderStatusDimension.PAYMENT,
      fromPaymentStatus: PaymentStatus.PENDING,
      toPaymentStatus: PaymentStatus.INVOICE_SENT,
      changedById: 'owner-1',
      comment: 'Счет выставлен',
    },
  ]);
});

test('OrdersService.confirmPayment переводит заказ в PAID/PACKED без изменений склада', async () => {
  let inventoryUpdateCalls = 0;
  const tx = {
    order: {
      findUnique: async () => ({
        id: 'order-paid',
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.INVOICE_SENT,
        fulfillmentStatus: FulfillmentStatus.RESERVED,
        items: [{ id: 'item-1', productId: 'product-1', quantity: 1 }],
      }),
      update: async (args: unknown) => args,
    },
    inventoryItem: {
      updateMany: async () => {
        inventoryUpdateCalls += 1;
        return { count: 1 };
      },
    },
  };

  const prisma = {
    $transaction: async (fn: (innerTx: typeof tx) => Promise<unknown>) => fn(tx),
  } as any;

  const service = new OrdersService(prisma);
  const result = (await service.confirmPayment('order-paid')) as any;

  assert.equal(inventoryUpdateCalls, 0);
  assert.equal(result.data.status, OrderStatus.PACKED);
  assert.equal(result.data.paymentStatus, PaymentStatus.PAID);
});

test('OrdersService.handOffToDelivery списывает склад и пишет fulfillment историю', async () => {
  const inventoryUpdates: unknown[] = [];
  const movements: StockMovementCreate[] = [];

  const tx = {
    order: {
      findUnique: async () => ({
        id: 'order-handoff',
        status: OrderStatus.PACKED,
        paymentStatus: PaymentStatus.PAID,
        fulfillmentStatus: FulfillmentStatus.RESERVED,
        items: [{ id: 'item-1', productId: 'product-1', quantity: 2 }],
      }),
      update: async (args: unknown) => args,
    },
    inventoryItem: {
      findUnique: async () => ({
        id: 'inventory-1',
        productId: 'product-1',
        onHand: 5,
        reserved: 2,
      }),
      updateMany: async (args: unknown) => {
        inventoryUpdates.push(args);
        return { count: 1 };
      },
    },
    stockMovement: {
      create: async (args: StockMovementCreate) => {
        movements.push(args);
        return args;
      },
    },
  };

  const prisma = {
    $transaction: async (fn: (innerTx: typeof tx) => Promise<unknown>) => fn(tx),
  } as any;

  const service = new OrdersService(prisma);
  const result = (await service.handOffToDelivery('order-handoff')) as any;

  assert.deepEqual(inventoryUpdates[0], {
    where: {
      id: 'inventory-1',
      onHand: { gte: 2 },
      reserved: { gte: 2 },
    },
    data: {
      onHand: { decrement: 2 },
      reserved: { decrement: 2 },
    },
  });
  assert.equal(movements[0]?.data.reason, 'ORDER_SHIP');
  assert.equal(result.data.status, OrderStatus.SHIPPED);
  assert.equal(result.data.fulfillmentStatus, FulfillmentStatus.HANDED_TO_CARRIER);
  assert.deepEqual(result.data.statusHistory.create, [
    {
      statusDimension: OrderStatusDimension.ORDER,
      fromStatus: OrderStatus.PACKED,
      toStatus: OrderStatus.SHIPPED,
      comment: 'Передано в доставку',
    },
    {
      statusDimension: OrderStatusDimension.FULFILLMENT,
      fromFulfillmentStatus: FulfillmentStatus.RESERVED,
      toFulfillmentStatus: FulfillmentStatus.HANDED_TO_CARRIER,
      comment: 'Передано в доставку',
    },
  ]);
});

test('OrdersService.confirmDelivered подтверждает получение без изменений склада', async () => {
  let inventoryUpdateCalls = 0;
  const tx = {
    order: {
      findUnique: async () => ({
        id: 'order-delivered',
        status: OrderStatus.SHIPPED,
        paymentStatus: PaymentStatus.PAID,
        fulfillmentStatus: FulfillmentStatus.HANDED_TO_CARRIER,
        items: [{ id: 'item-1', productId: 'product-1', quantity: 1 }],
      }),
      update: async (args: unknown) => args,
    },
    inventoryItem: {
      updateMany: async () => {
        inventoryUpdateCalls += 1;
        return { count: 1 };
      },
    },
  };

  const prisma = {
    $transaction: async (fn: (innerTx: typeof tx) => Promise<unknown>) => fn(tx),
  } as any;

  const service = new OrdersService(prisma);
  const result = (await service.confirmDelivered('order-delivered')) as any;

  assert.equal(inventoryUpdateCalls, 0);
  assert.equal(result.data.status, OrderStatus.DELIVERED);
  assert.equal(result.data.fulfillmentStatus, FulfillmentStatus.DELIVERED);
});

test('OrdersService.handOffToDelivery возвращает 409 для неоплаченного заказа', async () => {
  const tx = {
    order: {
      findUnique: async () => ({
        id: 'order-unpaid',
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.INVOICE_SENT,
        fulfillmentStatus: FulfillmentStatus.RESERVED,
        items: [{ id: 'item-1', productId: 'product-1', quantity: 1 }],
      }),
    },
  };

  const prisma = {
    $transaction: async (fn: (innerTx: typeof tx) => Promise<unknown>) => fn(tx),
  } as any;

  const service = new OrdersService(prisma);

  await assert.rejects(() => service.handOffToDelivery('order-unpaid'), (error: unknown) => {
    assert.ok(error instanceof ConflictException);
    const body = (error as ConflictException).getResponse() as { code?: string };
    assert.equal(body.code, 'INVALID_ORDER_STATUS_TRANSITION');
    return true;
  });
});

test('OrdersService.updateStatus выполняет PACKED -> SHIPPED и пишет StockMovement', async () => {
  const inventoryUpdates: unknown[] = [];
  const movements: StockMovementCreate[] = [];

  const tx = {
    order: {
      findUnique: async () => ({
        id: 'order-10',
        status: OrderStatus.PACKED,
        items: [{ id: 'item-1', productId: 'product-1', quantity: 2 }],
      }),
      update: async (args: unknown) => args,
    },
    inventoryItem: {
      findUnique: async () => ({
        id: 'inventory-1',
        productId: 'product-1',
        onHand: 5,
        reserved: 2,
      }),
      updateMany: async (args: unknown) => {
        inventoryUpdates.push(args);
        return { count: 1 };
      },
    },
    stockMovement: {
      create: async (args: StockMovementCreate) => {
        movements.push(args);
        return args;
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

  assert.deepEqual(inventoryUpdates[0], {
    where: {
      id: 'inventory-1',
      onHand: { gte: 2 },
      reserved: { gte: 2 },
    },
    data: {
      onHand: { decrement: 2 },
      reserved: { decrement: 2 },
    },
  });
  assert.deepEqual(movements[0], {
    data: {
      inventoryItemId: 'inventory-1',
      orderId: 'order-10',
      orderItemId: 'item-1',
      deltaOnHand: -2,
      deltaReserved: -2,
      reason: 'ORDER_SHIP',
    },
  });
  assert.equal(result.data.status, OrderStatus.SHIPPED);
});

test('OrdersService.updateStatus выполняет CONFIRMED -> PACKED без изменений склада', async () => {
  let inventoryUpdateCalls = 0;

  const tx = {
    order: {
      findUnique: async () => ({
        id: 'order-14',
        status: OrderStatus.CONFIRMED,
        items: [{ id: 'item-1', productId: 'product-1', quantity: 2 }],
      }),
      update: async (args: unknown) => args,
    },
    inventoryItem: {
      updateMany: async () => {
        inventoryUpdateCalls += 1;
        return { count: 1 };
      },
    },
  };

  const prisma = {
    $transaction: async (fn: (innerTx: typeof tx) => Promise<unknown>) => fn(tx),
  } as any;

  const service = new OrdersService(prisma);
  const result = (await service.updateStatus('order-14', {
    toStatus: OrderStatus.PACKED,
  })) as any;

  assert.equal(inventoryUpdateCalls, 0);
  assert.equal(result.data.status, OrderStatus.PACKED);
  assert.equal(result.data.statusHistory.create.fromStatus, OrderStatus.CONFIRMED);
});

test('OrdersService.updateStatus возвращает 400 VALIDATION_ERROR с messages для toStatus=CANCELLED', async () => {
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
      assert.ok(error instanceof BadRequestException);
      const body = (error as BadRequestException).getResponse() as {
        code?: string;
        statusCode?: number;
        errors?: Array<{ field?: string; messages?: string[]; errors?: string[] }>;
      };
      assert.equal(body.code, 'VALIDATION_ERROR');
      assert.equal(body.statusCode, 400);
      assert.equal(body.errors?.[0]?.field, 'toStatus');
      assert.ok(body.errors?.[0]?.messages?.[0]?.includes('CONFIRMED'));
      assert.equal(body.errors?.[0]?.errors, undefined);
      return true;
    },
  );
});

test('OrdersService.updateStatus возвращает конфликт при недопустимом переходе', async () => {
  const tx = {
    order: {
      findUnique: async () => ({
        id: 'order-11',
        status: OrderStatus.CONFIRMED,
        items: [{ id: 'item-1', productId: 'product-1', quantity: 1 }],
      }),
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
      assert.ok(error instanceof ConflictException);
      const body = (error as ConflictException).getResponse() as { code?: string };
      assert.equal(body.code, 'INVALID_ORDER_STATUS_TRANSITION');
      return true;
    },
  );
});

test('OrdersService.cancel возвращает конфликт при нарушении инварианта reserved', async () => {
  const tx = {
    order: {
      findUnique: async () => ({
        id: 'order-13',
        status: OrderStatus.NEW,
        paymentStatus: PaymentStatus.PENDING,
        fulfillmentStatus: FulfillmentStatus.RESERVED,
        items: [{ id: 'item-1', productId: 'product-1', quantity: 2 }],
      }),
    },
    inventoryItem: {
      findUnique: async () => ({ id: 'inventory-1', productId: 'product-1', reserved: 1 }),
      updateMany: async () => ({ count: 0 }),
    },
    stockMovement: {
      create: async () => {
        throw new Error('movement не должен писаться при конфликте');
      },
    },
  };

  const prisma = {
    $transaction: async (fn: (innerTx: typeof tx) => Promise<unknown>) => fn(tx),
  } as any;

  const service = new OrdersService(prisma);

  await assert.rejects(() => service.cancel('order-13'), (error: unknown) => {
    assert.ok(error instanceof ConflictException);
    const body = (error as ConflictException).getResponse() as { code?: string };
    assert.equal(body.code, 'INVENTORY_INVARIANT_VIOLATION');
    return true;
  });
});

test('OrdersService.updateStatus возвращает конфликт при нарушении инварианта склада на SHIPPED', async () => {
  const tx = {
    order: {
      findUnique: async () => ({
        id: 'order-12',
        status: OrderStatus.PACKED,
        items: [{ id: 'item-1', productId: 'product-1', quantity: 3 }],
      }),
    },
    inventoryItem: {
      findUnique: async () => ({
        id: 'inventory-1',
        productId: 'product-1',
        onHand: 2,
        reserved: 3,
      }),
      updateMany: async () => ({ count: 0 }),
    },
    stockMovement: {
      create: async () => {
        throw new Error('movement не должен писаться при конфликте');
      },
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
      assert.ok(error instanceof ConflictException);
      const body = (error as ConflictException).getResponse() as { code?: string };
      assert.equal(body.code, 'INVENTORY_INVARIANT_VIOLATION');
      return true;
    },
  );
});

test('OrdersService.getById возвращает заказ с позициями и историей', async () => {
  const prisma = {
    order: {
      findUnique: async () => ({
        id: 'order-3',
        status: OrderStatus.CONFIRMED,
        items: [
          { id: 'item-1', productId: 'product-1', quantity: 1, priceMinor: 100, totalMinor: 100 },
        ],
        statusHistory: [
          { id: 'history-1', fromStatus: OrderStatus.NEW, toStatus: OrderStatus.CONFIRMED },
        ],
      }),
    },
  } as any;

  const service = new OrdersService(prisma);
  const result = await service.getById('order-3');

  assert.equal(result.id, 'order-3');
  assert.equal(result.items.length, 1);
  assert.equal(result.statusHistory.length, 1);
});

test('OrdersService.list возвращает заказы с pagination и фильтрами', async () => {
  const calls: unknown[] = [];
  const prisma = {
    $transaction: async (operations: unknown[]) => Promise.all(operations),
    order: {
      findMany: (args: unknown) => {
        calls.push(args);
        return Promise.resolve([
          {
            id: 'order-1',
            customerId: null,
            customerFullName: 'Иван Иванов',
            customerEmail: 'ivan@example.com',
            customerPhone: null,
            shippingAddress: 'Тбилиси',
            status: OrderStatus.NEW,
            paymentStatus: PaymentStatus.PENDING,
            fulfillmentStatus: FulfillmentStatus.RESERVED,
            totalMinor: 100,
            createdAt: new Date('2026-04-29T00:00:00.000Z'),
            updatedAt: new Date('2026-04-29T00:00:00.000Z'),
            _count: { items: 2 },
          },
        ]);
      },
      count: (args: unknown) => {
        calls.push(args);
        return Promise.resolve(1);
      },
    },
  } as any;

  const service = new OrdersService(prisma);
  const result = await service.list({
    limit: 10,
    offset: 5,
    status: OrderStatus.NEW,
    from: '2026-04-01T00:00:00.000Z',
    to: '2026-04-30T00:00:00.000Z',
  });

  assert.deepEqual(result.pagination, { limit: 10, offset: 5, total: 1 });
  assert.equal(result.items[0]?.itemsCount, 2);
  assert.equal(result.items[0]?.customerEmail, 'ivan@example.com');
  assert.equal((calls[0] as any).skip, 5);
  assert.equal((calls[0] as any).take, 10);
  assert.equal((calls[0] as any).where.status, OrderStatus.NEW);
  assert.ok((calls[0] as any).where.createdAt.gte instanceof Date);
  assert.deepEqual((calls[1] as any).where, (calls[0] as any).where);
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

test('OrdersService отправляет email-события для P0 lifecycle transitions', async () => {
  const events: string[] = [];
  const notifications = {
    sendOrderEvent: async (event: string, order: { id: string; customerEmail: string }) => {
      events.push(event);
      assert.equal(order.customerEmail, guestSnapshot.customerEmail);
    },
  };

  const createService = (prisma: unknown) =>
    new OrdersService(prisma as any, notifications as any);

  await createService(createOrderPrisma('order-created')).create({
    ...guestSnapshot,
    items: [{ productId: 'product-1', quantity: 1 }],
  });
  await createService(lifecyclePrisma({
    id: 'order-invoice',
    status: OrderStatus.NEW,
    paymentStatus: PaymentStatus.PENDING,
    fulfillmentStatus: FulfillmentStatus.RESERVED,
  })).markInvoiceSent('order-invoice');
  await createService(lifecyclePrisma({
    id: 'order-paid',
    status: OrderStatus.CONFIRMED,
    paymentStatus: PaymentStatus.INVOICE_SENT,
    fulfillmentStatus: FulfillmentStatus.RESERVED,
  })).confirmPayment('order-paid');
  await createService(lifecyclePrisma({
    id: 'order-shipped',
    status: OrderStatus.PACKED,
    paymentStatus: PaymentStatus.PAID,
    fulfillmentStatus: FulfillmentStatus.RESERVED,
    withShippingInventory: true,
  })).handOffToDelivery('order-shipped');
  await createService(lifecyclePrisma({
    id: 'order-delivered',
    status: OrderStatus.SHIPPED,
    paymentStatus: PaymentStatus.PAID,
    fulfillmentStatus: FulfillmentStatus.HANDED_TO_CARRIER,
  })).confirmDelivered('order-delivered');
  await createService(lifecyclePrisma({
    id: 'order-cancelled',
    status: OrderStatus.NEW,
    paymentStatus: PaymentStatus.PENDING,
    fulfillmentStatus: FulfillmentStatus.RESERVED,
    withCancelInventory: true,
  })).cancel('order-cancelled');

  assert.deepEqual(events, [
    'order-created',
    'invoice-issued',
    'payment-confirmed',
    'in-delivery',
    'completed',
    'cancelled',
  ]);
});

test('OrdersService не откатывает transition при сбое email provider', async () => {
  let updateCalls = 0;
  const notifications = {
    sendOrderEvent: async () => {
      throw new Error('provider unavailable');
    },
  };
  const prisma = lifecyclePrisma({
    id: 'order-provider-failure',
    status: OrderStatus.NEW,
    paymentStatus: PaymentStatus.PENDING,
    fulfillmentStatus: FulfillmentStatus.RESERVED,
    onUpdate: () => {
      updateCalls += 1;
    },
  });

  const service = new OrdersService(prisma as any, notifications as any);
  const result = await service.markInvoiceSent('order-provider-failure');

  assert.equal(updateCalls, 1);
  assert.equal(result.status, OrderStatus.CONFIRMED);
  assert.equal(result.paymentStatus, PaymentStatus.INVOICE_SENT);
});

function createOrderPrisma(orderId: string) {
  const tx = {
    user: {
      findUnique: async () => {
        throw new Error('guest order не должен читать User');
      },
    },
    product: {
      findMany: async () => [{ id: 'product-1', priceMinor: 100, isActive: true }],
    },
    inventoryItem: {
      findMany: async () => [{ id: 'inventory-1', productId: 'product-1' }],
      findUnique: async () => ({ onHand: 5, reserved: 0 }),
    },
    order: {
      create: async () => ({
        ...emailOrder(orderId, OrderStatus.NEW, PaymentStatus.PENDING, FulfillmentStatus.RESERVED),
        items: [
          { id: 'item-1', productId: 'product-1', quantity: 1, priceMinor: 100, totalMinor: 100 },
        ],
        statusHistory: [],
      }),
    },
    stockMovement: {
      create: async (args: StockMovementCreate) => args,
    },
    $executeRaw: async () => 1,
  };

  return {
    $transaction: async (fn: (innerTx: typeof tx) => Promise<unknown>) => fn(tx),
  };
}

function lifecyclePrisma(options: {
  id: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  withShippingInventory?: boolean;
  withCancelInventory?: boolean;
  onUpdate?: () => void;
}) {
  const tx = {
    order: {
      findUnique: async () => ({
        id: options.id,
        status: options.status,
        paymentStatus: options.paymentStatus,
        fulfillmentStatus: options.fulfillmentStatus,
        items: [{ id: 'item-1', productId: 'product-1', quantity: 1 }],
      }),
      update: async (args: any) => {
        options.onUpdate?.();
        return emailOrder(
          options.id,
          args.data.status,
          args.data.paymentStatus,
          args.data.fulfillmentStatus,
        );
      },
    },
    inventoryItem: {
      findUnique: async () => ({ id: 'inventory-1', productId: 'product-1', onHand: 5, reserved: 1 }),
      updateMany: async () => ({ count: 1 }),
    },
    stockMovement: {
      create: async (args: StockMovementCreate) => args,
    },
  };

  if (!options.withShippingInventory && !options.withCancelInventory) {
    delete (tx as any).inventoryItem;
    delete (tx as any).stockMovement;
  }

  return {
    $transaction: async (fn: (innerTx: typeof tx) => Promise<unknown>) => fn(tx),
  };
}

function emailOrder(
  id: string,
  status: OrderStatus,
  paymentStatus: PaymentStatus,
  fulfillmentStatus: FulfillmentStatus,
) {
  return {
    id,
    customerId: null,
    ...guestSnapshot,
    status,
    paymentStatus,
    fulfillmentStatus,
    totalMinor: 100,
  };
}
