import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';

type OpenApiParameter = {
  name?: string;
  schema?: {
    type?: string;
  };
};

type OpenApiSchema = {
  properties?: Record<string, unknown>;
  required?: string[];
};

test('OpenAPI document includes expected paths and order operations', async () => {
  process.env.OPENAPI_EXPORT = '1';
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../app.module.js');
  const { buildOpenApiDocument } = await import('./build-document.js');

  const app = await NestFactory.create(AppModule, { logger: false });
  try {
    const document = buildOpenApiDocument(app);
    const paths = document.paths ?? {};
    assert.equal(paths['/']?.get, undefined, 'plain-text root GET is excluded from generated clients');
    assert.ok(paths['/health/db']?.get, 'DB health is documented');
    const productsGet = paths['/products']?.get;
    assert.ok(productsGet, 'product list is documented');
    const productQueryParams = ((productsGet.parameters ?? []) as OpenApiParameter[]).map(
      (parameter) => parameter.name,
    );
    assert.deepEqual(productQueryParams.sort(), ['isActive', 'limit', 'offset']);
    assert.ok(paths['/orders']?.post, 'order create is documented');
    const schemas = (document.components?.schemas ?? {}) as Record<string, OpenApiSchema>;
    const createOrderSchema = schemas.CreateOrderDto;
    assert.ok(createOrderSchema, 'order create schema is documented');
    assert.deepEqual(createOrderSchema.required?.sort(), [
      'customerEmail',
      'customerFullName',
      'items',
      'shippingAddress',
    ]);
    assert.ok(createOrderSchema.properties?.customerId, 'optional customerId remains documented');
    const orderResponseSchema = schemas.OrderResponseDto;
    assert.ok(orderResponseSchema, 'order response schema is documented');
    assert.ok(orderResponseSchema.properties?.customerFullName, 'customer snapshot is returned');
    assert.ok(orderResponseSchema.properties?.paymentStatus, 'payment status is returned');
    assert.ok(orderResponseSchema.properties?.fulfillmentStatus, 'fulfillment status is returned');
    const orderById = '/orders/{id}';
    const orderGet = paths[orderById]?.get;
    assert.ok(orderGet, 'order get by id is documented');
    const idParam = ((orderGet.parameters ?? []) as OpenApiParameter[]).find(
      (parameter) => parameter.name === 'id',
    );
    assert.equal(idParam?.schema?.type, 'string');
    assert.ok(paths[`${orderById}/cancel`]?.patch, 'order cancel is documented');
    assert.ok(paths[`${orderById}/status`]?.patch, 'order status update is documented');
    assert.equal(document.info?.title, 'Enot Tea API');
  } finally {
    await app.close();
  }
});
