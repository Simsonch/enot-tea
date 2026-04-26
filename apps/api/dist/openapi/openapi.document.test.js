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
        const orderById = '/orders/{id}';
        const orderGet = paths[orderById]?.get;
        assert.ok(orderGet, 'order get by id is documented');
        const idParam = (orderGet.parameters ?? []).find((parameter) => parameter.name === 'id');
        assert.equal(idParam?.schema?.type, 'string');
        assert.ok(paths[`${orderById}/cancel`]?.patch, 'order cancel is documented');
        assert.ok(paths[`${orderById}/status`]?.patch, 'order status update is documented');
        assert.equal(document.info?.title, 'Enot Tea API');
    }
    finally {
        await app.close();
    }
});
//# sourceMappingURL=openapi.document.test.js.map