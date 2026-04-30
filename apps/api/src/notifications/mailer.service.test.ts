import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { MailerService, getMailerConfig } from './mailer.service.js';
import type { EmailMessage } from './notifications.types.js';

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
});

test('getMailerConfig defaults to log provider with safe timeout', () => {
  const config = getMailerConfig({});

  assert.deepEqual(config, {
    provider: 'log',
    from: 'Enot Tea <no-reply@example.com>',
    requestTimeoutMs: 5000,
  });
});

test('getMailerConfig parses resend env without exposing missing secrets by default', () => {
  const config = getMailerConfig({
    EMAIL_PROVIDER: 'resend',
    EMAIL_FROM: 'Shop <orders@example.com>',
    EMAIL_REQUEST_TIMEOUT_MS: '2500',
    RESEND_API_KEY: 'test-key',
  });

  assert.deepEqual(config, {
    provider: 'resend',
    from: 'Shop <orders@example.com>',
    requestTimeoutMs: 2500,
    resendApiKey: 'test-key',
  });
});

test('getMailerConfig rejects unsupported provider and invalid timeout', () => {
  assert.throws(
    () => getMailerConfig({ EMAIL_PROVIDER: 'smtp' }),
    /Unsupported EMAIL_PROVIDER=smtp/,
  );
  assert.throws(
    () => getMailerConfig({ EMAIL_REQUEST_TIMEOUT_MS: '0' }),
    /EMAIL_REQUEST_TIMEOUT_MS must be a positive integer/,
  );
});

test('MailerService.send with log provider does not call fetch', async () => {
  process.env = {
    ...originalEnv,
    EMAIL_PROVIDER: 'log',
  };
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response(null, { status: 202 });
  }) as typeof fetch;

  await new MailerService().send(emailMessage());

  assert.equal(fetchCalls, 0);
});

test('MailerService.send sends expected Resend payload and tags', async () => {
  process.env = {
    ...originalEnv,
    EMAIL_PROVIDER: 'resend',
    EMAIL_FROM: 'Shop <orders@example.com>',
    EMAIL_REQUEST_TIMEOUT_MS: '1000',
    RESEND_API_KEY: 'test-key',
  };
  let request: { input: RequestInfo | URL; init: RequestInit | undefined };
  globalThis.fetch = (async (input, init) => {
    request = { input, init };
    return new Response(null, { status: 202 });
  }) as typeof fetch;

  await new MailerService().send(emailMessage());

  assert.equal(request!.input, 'https://api.resend.com/emails');
  assert.equal(request!.init?.method, 'POST');
  assert.equal((request!.init?.headers as Record<string, string>).Authorization, 'Bearer test-key');
  assert.ok(request!.init?.signal instanceof AbortSignal);
  assert.deepEqual(JSON.parse(String(request!.init?.body)), {
    from: 'Shop <orders@example.com>',
    to: ['customer@example.com'],
    subject: 'Order update #order-1',
    html: '<p>Order order-1</p>',
    text: 'Order order-1',
    tags: [
      { name: 'orderId', value: 'order-1' },
      { name: 'event', value: 'order-created' },
    ],
  });
});

test('MailerService.send rejects resend without API key', async () => {
  process.env = {
    ...originalEnv,
    EMAIL_PROVIDER: 'resend',
    RESEND_API_KEY: '',
  };

  await assert.rejects(
    () => new MailerService().send(emailMessage()),
    /RESEND_API_KEY is required/,
  );
});

test('MailerService.send rejects non-2xx Resend responses', async () => {
  process.env = {
    ...originalEnv,
    EMAIL_PROVIDER: 'resend',
    RESEND_API_KEY: 'test-key',
  };
  globalThis.fetch = (async () => new Response(null, { status: 500 })) as typeof fetch;

  await assert.rejects(
    () => new MailerService().send(emailMessage()),
    /Resend email request failed with status=500/,
  );
});

test('MailerService.send turns aborts into timeout errors', async () => {
  process.env = {
    ...originalEnv,
    EMAIL_PROVIDER: 'resend',
    EMAIL_REQUEST_TIMEOUT_MS: '1',
    RESEND_API_KEY: 'test-key',
  };
  globalThis.fetch = (async (_input, init) => {
    await new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });
    throw new Error('unreachable');
  }) as typeof fetch;

  await assert.rejects(
    () => new MailerService().send(emailMessage()),
    /Resend email request timed out after 1ms/,
  );
});

function emailMessage(): EmailMessage {
  return {
    to: 'customer@example.com',
    from: 'ignored@example.com',
    subject: 'Order update #order-1',
    text: 'Order order-1',
    html: '<p>Order order-1</p>',
    tags: {
      orderId: 'order-1',
      event: 'order-created',
    },
  };
}
