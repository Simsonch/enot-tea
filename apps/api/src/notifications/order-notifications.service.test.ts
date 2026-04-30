import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderNotificationsService } from './order-notifications.service.js';
import type { EmailMessage } from './notifications.types.js';

const order = {
  id: 'order-1',
  customerEmail: 'customer@example.com',
  customerFullName: 'Иван Иванов',
  totalMinor: 1000,
};

test('OrderNotificationsService records SUCCESS with mock provider', async () => {
  const sentMessages: EmailMessage[] = [];
  const attempts: unknown[] = [];
  const service = new OrderNotificationsService(
    {
      send: async (message: EmailMessage) => {
        sentMessages.push(message);
      },
    } as any,
    prismaMock(attempts) as any,
  );

  const result = await service.sendOrderEvent('order-created', order);

  assert.equal(result.status, 'SUCCESS');
  assert.equal(result.event, 'order-created');
  assert.equal(sentMessages[0]?.tags.orderId, order.id);
  assert.deepEqual(attempts[0], {
    orderId: order.id,
    event: 'order-created',
    status: 'SUCCESS',
  });
});

test('OrderNotificationsService records FAILED with mock provider error', async () => {
  const attempts: unknown[] = [];
  const service = new OrderNotificationsService(
    {
      send: async () => {
        throw new Error('mock provider failed');
      },
    } as any,
    prismaMock(attempts) as any,
  );

  const result = await service.sendOrderEvent('invoice-issued', order);

  assert.equal(result.status, 'FAILED');
  assert.equal(result.event, 'invoice-issued');
  assert.equal(result.errorMessage, 'mock provider failed');
  assert.deepEqual(attempts[0], {
    orderId: order.id,
    event: 'invoice-issued',
    status: 'FAILED',
    errorMessage: 'mock provider failed',
  });
});

function prismaMock(attempts: unknown[]) {
  return {
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
}
