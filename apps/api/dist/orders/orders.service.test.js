import test from 'node:test';
import assert from 'node:assert/strict';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { OrdersService } from './orders.service.js';
test('OrdersService.cancel снимает резерв и переводит заказ в CANCELLED', async () => {
    const updates = [];
    const tx = {
        order: {
            findUnique: async () => ({
                id: 'order-1',
                status: OrderStatus.NEW,
                items: [{ productId: 'product-1', quantity: 2 }],
            }),
            update: async (args) => args,
        },
        inventoryItem: {
            findUnique: async () => ({ productId: 'product-1', reserved: 2 }),
            update: async (args) => {
                updates.push(args);
                return {};
            },
        },
    };
    const prisma = {
        $transaction: async (fn) => fn(tx),
    };
    const service = new OrdersService(prisma);
    const result = (await service.cancel('order-1'));
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
        $transaction: async (fn) => fn(tx),
    };
    const service = new OrdersService(prisma);
    await assert.rejects(() => service.cancel('order-2'), (error) => {
        if (!(error instanceof ConflictException)) {
            return false;
        }
        const body = error.getResponse();
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
        $transaction: async (fn) => fn(tx),
    };
    const service = new OrdersService(prisma);
    await assert.rejects(() => service.cancel('missing-order'), (error) => {
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
    };
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
    };
    const service = new OrdersService(prisma);
    await assert.rejects(() => service.getById('missing-order'), (error) => {
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
        $transaction: async (fn) => fn(tx),
    };
    const service = new OrdersService(prisma);
    await assert.rejects(() => service.create({
        customerId,
        items: [{ productId, quantity: 2 }],
    }), (error) => {
        assert.ok(error instanceof ConflictException);
        const body = error.getResponse();
        assert.equal(body.code, 'INSUFFICIENT_STOCK');
        assert.equal(typeof body.message, 'string');
        assert.equal(body.details?.productId, productId);
        assert.equal(body.details?.requested, 2);
        assert.equal(body.details?.available, 1);
        return true;
    });
});
test('OrdersService.updateStatus выполняет переход PACKED -> SHIPPED и обновляет склад', async () => {
    const inventoryUpdates = [];
    const tx = {
        order: {
            findUnique: async () => ({
                id: 'order-10',
                status: OrderStatus.PACKED,
                items: [{ productId: 'product-1', quantity: 2 }],
            }),
            update: async (args) => args,
        },
        inventoryItem: {
            findUnique: async () => ({ productId: 'product-1', onHand: 5, reserved: 2 }),
            update: async (args) => {
                inventoryUpdates.push(args);
                return {};
            },
        },
    };
    const prisma = {
        $transaction: async (fn) => fn(tx),
    };
    const service = new OrdersService(prisma);
    const result = (await service.updateStatus('order-10', {
        toStatus: OrderStatus.SHIPPED,
    }));
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
        $transaction: async (fn) => fn(tx),
    };
    const service = new OrdersService(prisma);
    await assert.rejects(() => service.updateStatus('order-11', {
        toStatus: OrderStatus.SHIPPED,
    }), (error) => {
        if (!(error instanceof ConflictException)) {
            return false;
        }
        const body = error.getResponse();
        return body.code === 'INVALID_ORDER_STATUS_TRANSITION';
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
        $transaction: async (fn) => fn(tx),
    };
    const service = new OrdersService(prisma);
    await assert.rejects(() => service.updateStatus('order-12', {
        toStatus: OrderStatus.SHIPPED,
    }), (error) => {
        if (!(error instanceof ConflictException)) {
            return false;
        }
        const body = error.getResponse();
        return body.code === 'INVENTORY_INVARIANT_VIOLATION';
    });
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
        $transaction: async (fn) => fn(tx),
    };
    const service = new OrdersService(prisma);
    await assert.rejects(() => service.updateStatus('missing-order', {
        toStatus: OrderStatus.PACKED,
    }), (error) => error instanceof NotFoundException);
});
//# sourceMappingURL=orders.service.test.js.map