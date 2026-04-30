import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOrderEmailMessage } from './email-templates.js';

test('buildOrderEmailMessage добавляет orderId correlation в письмо и tags', () => {
  const message = buildOrderEmailMessage(
    'payment-confirmed',
    {
      id: 'order-42',
      customerEmail: 'customer@example.com',
      customerFullName: 'Иван Иванов',
      totalMinor: 12345,
    },
    'Enot Tea <no-reply@example.com>',
  );

  assert.equal(message.to, 'customer@example.com');
  assert.equal(message.tags.orderId, 'order-42');
  assert.equal(message.tags.event, 'payment-confirmed');
  assert.match(message.subject, /order-42/);
  assert.match(message.text, /order-42/);
  assert.match(message.html, /order-42/);
});
