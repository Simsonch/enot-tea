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
  properties?: Record<
    string,
    {
      nullable?: boolean;
      description?: string;
      minItems?: number;
    }
  >;
  required?: string[];
};

type OpenApiOperation = {
  parameters?: OpenApiParameter[];
  responses?: Record<
    string,
    {
      content?: {
        'application/json'?: {
          schema?: {
            $ref?: string;
          };
        };
      };
    }
  >;
  summary?: string;
  description?: string;
  security?: Array<Record<string, unknown>>;
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
    const authLogin = paths['/auth/login']?.post as OpenApiOperation | undefined;
    assert.ok(authLogin, 'owner login is documented');
    assert.ok(document.components?.securitySchemes?.bearer, 'bearer auth is documented');
    const schemas = (document.components?.schemas ?? {}) as Record<string, OpenApiSchema>;
    assert.ok(schemas.ApiAuthErrorBodyDto, 'auth error response body is documented');
    assert.equal(
      authLogin.responses?.['401']?.content?.['application/json']?.schema?.$ref,
      '#/components/schemas/ApiAuthErrorBodyDto',
    );
    const createOrderSchema = schemas.CreateOrderDto;
    assert.ok(createOrderSchema, 'order create schema is documented');
    assert.deepEqual(createOrderSchema.required?.sort(), [
      'customerEmail',
      'customerFullName',
      'items',
      'shippingAddress',
    ]);
    assert.equal(
      createOrderSchema.properties?.customerId?.description,
      'Необязательный связанный id покупателя для негостевых заказов; для гостевого checkout не указывайте.',
    );
    assert.equal(createOrderSchema.properties?.items?.minItems, 1);
    const orderResponseSchema = schemas.OrderResponseDto;
    assert.ok(orderResponseSchema, 'order response schema is documented');
    assert.ok(orderResponseSchema.properties?.customerFullName, 'customer snapshot is returned');
    assert.ok(orderResponseSchema.properties?.paymentStatus, 'payment status is returned');
    assert.ok(orderResponseSchema.properties?.fulfillmentStatus, 'fulfillment status is returned');
    assert.equal(orderResponseSchema.properties?.customerId?.nullable, true);
    assert.equal(orderResponseSchema.properties?.customerPhone?.nullable, true);
    assert.ok(
      orderResponseSchema.required?.includes('statusHistory'),
      'statusHistory is returned on order endpoints',
    );
    const historyEntrySchema = schemas.OrderStatusHistoryEntryDto;
    assert.ok(historyEntrySchema, 'order status history entry schema is documented');
    assert.ok(historyEntrySchema.required?.includes('fromStatus'));
    assert.equal(historyEntrySchema.properties?.fromPaymentStatus?.nullable, true);
    assert.ok(schemas.ApiNotFoundErrorBodyDto, 'not-found response body is documented');
    const orderById = '/orders/{id}';
    const ordersList = paths['/orders']?.get as OpenApiOperation | undefined;
    assert.ok(ordersList, 'owner order list is documented');
    assert.deepEqual(ordersList.security, [{ bearer: [] }]);
    assert.ok(schemas.OrdersListResponseDto, 'orders list response is documented');
    assert.equal(
      ordersList.responses?.['401']?.content?.['application/json']?.schema?.$ref,
      '#/components/schemas/ApiAuthErrorBodyDto',
    );
    assert.equal(
      ordersList.responses?.['403']?.content?.['application/json']?.schema?.$ref,
      '#/components/schemas/ApiAuthErrorBodyDto',
    );
    const orderGet = paths[orderById]?.get as OpenApiOperation | undefined;
    assert.ok(orderGet, 'order get by id is documented');
    assert.deepEqual(orderGet.security, [{ bearer: [] }]);
    assert.equal(
      orderGet.responses?.['401']?.content?.['application/json']?.schema?.$ref,
      '#/components/schemas/ApiAuthErrorBodyDto',
    );
    assert.equal(
      orderGet.responses?.['403']?.content?.['application/json']?.schema?.$ref,
      '#/components/schemas/ApiAuthErrorBodyDto',
    );
    const idParam = ((orderGet.parameters ?? []) as OpenApiParameter[]).find(
      (parameter) => parameter.name === 'id',
    );
    assert.equal(idParam?.schema?.type, 'string');
    assert.equal(
      orderGet.responses?.['404']?.content?.['application/json']?.schema?.$ref,
      '#/components/schemas/ApiNotFoundErrorBodyDto',
    );
    const orderCreate = paths['/orders']?.post as OpenApiOperation | undefined;
    assert.equal(orderCreate?.summary, 'Создать гостевой заказ и зарезервировать склад');
    assert.match(orderCreate?.description ?? '', /ADR 0005/);
    const cancel = paths[`${orderById}/cancel`]?.patch as OpenApiOperation | undefined;
    assert.equal(
      cancel?.summary,
      'Отменить ещё не отгруженный заказ и снять резерв',
    );
    assert.ok(paths[`${orderById}/invoice-sent`]?.patch, 'invoice sent is documented');
    assert.ok(
      paths[`${orderById}/payment-confirmed`]?.patch,
      'payment confirmed is documented',
    );
    const handoff = paths[`${orderById}/handoff-to-delivery`]?.patch as
      | OpenApiOperation
      | undefined;
    assert.equal(
      handoff?.summary,
      'Передать заказ в доставку, уменьшить onHand и reserved на складе',
    );
    assert.ok(paths[`${orderById}/delivered`]?.patch, 'delivered is documented');
    const legacyStatus = paths[`${orderById}/status`]?.patch as
      | OpenApiOperation
      | undefined;
    assert.equal(legacyStatus?.summary, 'Устаревший эндпоинт смены единого статуса');
    assert.equal(document.info?.title, 'API Enot Tea');
  } finally {
    await app.close();
  }
});
