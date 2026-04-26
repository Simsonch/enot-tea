import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { formatValidationFieldErrors } from '../common/validation-error-format.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';
import { GetProductsQueryDto } from './products.dto.js';

Reflect.defineMetadata(
  'design:paramtypes',
  [GetProductsQueryDto],
  ProductsController.prototype,
  'list',
);

async function createApp(overrides?: {
  list?: (query: GetProductsQueryDto) => Promise<unknown>;
}) {
  const queries: GetProductsQueryDto[] = [];
  const productsServiceMock = {
    list:
      overrides?.list ??
      (async (query: GetProductsQueryDto) => {
        queries.push(query);
        return {
          items: [
            {
              id: 'product-2',
              sku: 'TEA-002',
              name: 'Inactive tea',
              description: null,
              priceMinor: 1200,
              isActive: false,
            },
          ],
          pagination: {
            limit: query.limit,
            offset: query.offset,
            total: 3,
          },
        };
      }),
  };

  const moduleRef = await Test.createTestingModule({
    controllers: [ProductsController],
    providers: [{ provide: ProductsService, useValue: productsServiceMock }],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) =>
        new BadRequestException({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Входные данные не прошли проверку.',
          errors: formatValidationFieldErrors(errors),
        }),
    }),
  );
  await app.init();

  return {
    app,
    getQueries: () => queries,
  };
}

test('GET /products применяет пагинацию и фильтр isActive=false', async () => {
  const { app, getQueries } = await createApp();

  try {
    const response = await request(app.getHttpServer())
      .get('/products?limit=1&offset=1&isActive=false')
      .expect(200);

    assert.equal(getQueries()[0]?.limit, 1);
    assert.equal(getQueries()[0]?.offset, 1);
    assert.equal(getQueries()[0]?.isActive, false);
    assert.equal(response.body.items.length, 1);
    assert.equal(response.body.items[0].isActive, false);
    assert.deepEqual(response.body.pagination, {
      limit: 1,
      offset: 1,
      total: 3,
    });
  } finally {
    await app.close();
  }
});

test('GET /products возвращает VALIDATION_ERROR для некорректной пагинации', async () => {
  const { app, getQueries } = await createApp();

  try {
    const response = await request(app.getHttpServer())
      .get('/products?limit=0&offset=-1&isActive=maybe')
      .expect(400);

    assert.equal(response.body.code, 'VALIDATION_ERROR');
    assert.equal(response.body.statusCode, 400);
    assert.equal(getQueries().length, 0);
    assert.ok(
      response.body.errors.some(
        (error: { field?: string; messages?: string[] }) =>
          error.field === 'limit' && Array.isArray(error.messages),
      ),
    );
  } finally {
    await app.close();
  }
});
