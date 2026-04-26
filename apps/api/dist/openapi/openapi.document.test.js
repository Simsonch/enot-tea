import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
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
        const productQueryParams = (productsGet.parameters ?? []).map((parameter) => parameter.name);
        assert.deepEqual(productQueryParams.sort(), ['isActive', 'limit', 'offset']);
        assert.ok(paths['/orders']?.post, 'order create is documented');
        const schemas = (document.components?.schemas ?? {});
        const createOrderSchema = schemas.CreateOrderDto;
        assert.ok(createOrderSchema, 'order create schema is documented');
        assert.deepEqual(createOrderSchema.required?.sort(), [
            'customerEmail',
            'customerFullName',
            'items',
            'shippingAddress',
        ]);
        assert.equal(createOrderSchema.properties?.customerId?.description, 'Optional linked customer id for non-guest orders; omit for guest checkout.');
        assert.equal(createOrderSchema.properties?.items?.minItems, 1);
        const orderResponseSchema = schemas.OrderResponseDto;
        assert.ok(orderResponseSchema, 'order response schema is documented');
        assert.ok(orderResponseSchema.properties?.customerFullName, 'customer snapshot is returned');
        assert.ok(orderResponseSchema.properties?.paymentStatus, 'payment status is returned');
        assert.ok(orderResponseSchema.properties?.fulfillmentStatus, 'fulfillment status is returned');
        assert.equal(orderResponseSchema.properties?.customerId?.nullable, true);
        assert.equal(orderResponseSchema.properties?.customerPhone?.nullable, true);
        assert.ok(orderResponseSchema.required?.includes('statusHistory'), 'statusHistory is returned on order endpoints');
        const historyEntrySchema = schemas.OrderStatusHistoryEntryDto;
        assert.ok(historyEntrySchema, 'order status history entry schema is documented');
        assert.ok(historyEntrySchema.required?.includes('fromStatus'));
        assert.equal(historyEntrySchema.properties?.fromPaymentStatus?.nullable, true);
        assert.ok(schemas.ApiNotFoundErrorBodyDto, 'not-found response body is documented');
        const orderById = '/orders/{id}';
        const orderGet = paths[orderById]?.get;
        assert.ok(orderGet, 'order get by id is documented');
        const idParam = (orderGet.parameters ?? []).find((parameter) => parameter.name === 'id');
        assert.equal(idParam?.schema?.type, 'string');
        assert.equal(orderGet.responses?.['404']?.content?.['application/json']?.schema?.$ref, '#/components/schemas/ApiNotFoundErrorBodyDto');
        const orderCreate = paths['/orders']?.post;
        assert.equal(orderCreate?.summary, 'Create guest checkout order and reserve stock');
        assert.match(orderCreate?.description ?? '', /ADR 0005/);
        const cancel = paths[`${orderById}/cancel`]?.patch;
        assert.equal(cancel?.summary, 'Cancel not-yet-shipped order and release reserved stock');
        assert.ok(paths[`${orderById}/invoice-sent`]?.patch, 'invoice sent is documented');
        assert.ok(paths[`${orderById}/payment-confirmed`]?.patch, 'payment confirmed is documented');
        const handoff = paths[`${orderById}/handoff-to-delivery`]?.patch;
        assert.equal(handoff?.summary, 'Hand order off to delivery and decrement onHand/reserved stock');
        assert.ok(paths[`${orderById}/delivered`]?.patch, 'delivered is documented');
        const legacyStatus = paths[`${orderById}/status`]?.patch;
        assert.equal(legacyStatus?.summary, 'Legacy single-status transition endpoint');
        assert.equal(document.info?.title, 'Enot Tea API');
    }
    finally {
        await app.close();
    }
});
//# sourceMappingURL=openapi.document.test.js.map