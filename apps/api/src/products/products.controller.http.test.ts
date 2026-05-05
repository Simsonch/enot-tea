import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Express } from 'express';
import { formatValidationFieldErrors } from '../common/validation-error-format.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';
import { CreateProductDto, GetProductsQueryDto } from './products.dto.js';
import { OwnerAuthGuard } from '../auth/owner-auth.guard.js';

Reflect.defineMetadata(
  'design:paramtypes',
  [GetProductsQueryDto],
  ProductsController.prototype,
  'list',
);
Reflect.defineMetadata(
  'design:paramtypes',
  [CreateProductDto, Object],
  ProductsController.prototype,
  'create',
);

type GuardCanActivate = (context: Parameters<OwnerAuthGuard['canActivate']>[0]) => boolean | Promise<boolean>;

async function createApp(overrides?: {
  list?: (query: GetProductsQueryDto) => Promise<unknown>;
  create?: (dto: CreateProductDto, file: Express.Multer.File) => Promise<unknown>;
  guardCanActivate?: GuardCanActivate;
}) {
  const queries: GetProductsQueryDto[] = [];
  const createCalls: { dto: CreateProductDto; file: Express.Multer.File }[] = [];
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
    create:
      overrides?.create ??
      (async (dto: CreateProductDto, file: Express.Multer.File) => {
        createCalls.push({ dto, file });
        return {
          id: 'product-created',
          sku: dto.sku,
          name: dto.name,
          description: dto.description ?? null,
          priceMinor: dto.priceMinor,
          productType: dto.productType ?? null,
          category: dto.category ?? null,
          discountPercent: dto.discountPercent ?? null,
          promotionLabel: dto.promotionLabel ?? null,
          discountedPriceMinor: dto.discountedPriceMinor ?? null,
          imageUrl: '/uploads/products/mock.png',
          isActive: dto.isActive ?? true,
        };
      }),
  };

  const moduleBuilder = Test.createTestingModule({
    controllers: [ProductsController],
    providers: [{ provide: ProductsService, useValue: productsServiceMock }],
  }).overrideGuard(OwnerAuthGuard)
    .useValue({
      canActivate: overrides?.guardCanActivate ?? (() => true),
    });

  const moduleRef = await moduleBuilder.compile();

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
    getCreateCalls: () => createCalls,
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

test('POST /products создаёт товар и передаёт файл в сервис', async () => {
  const { app, getCreateCalls } = await createApp();

  try {
    const response = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', 'Bearer owner-token')
      .field('sku', 'TEA-100')
      .field('name', 'Новый чай')
      .field('priceMinor', '1500')
      .field('discountPercent', '10')
      .attach('image', Buffer.from('fake-image'), {
        filename: 'preview.png',
        contentType: 'image/png',
      })
      .expect(201);

    const calls = getCreateCalls();
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.dto.sku, 'TEA-100');
    assert.equal(calls[0]?.dto.priceMinor, 1500);
    assert.equal(calls[0]?.dto.discountPercent, 10);
    assert.equal(calls[0]?.file.mimetype, 'image/png');
    assert.equal(response.body.sku, 'TEA-100');
    assert.equal(response.body.imageUrl, '/uploads/products/mock.png');
  } finally {
    await app.close();
  }
});

test('POST /products отклоняет неподдерживаемый тип файла', async () => {
  const { app } = await createApp();

  try {
    const response = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', 'Bearer owner-token')
      .field('sku', 'TEA-101')
      .field('name', 'Некорректный чай')
      .field('priceMinor', '900')
      .attach('image', Buffer.from('not-an-image'), {
        filename: 'preview.txt',
        contentType: 'text/plain',
      })
      .expect(400);

    assert.equal(response.body.code, 'VALIDATION_ERROR');
    assert.ok(
      response.body.errors.some(
        (error: { field?: string; messages?: string[] }) => error.field === 'image',
      ),
    );
  } finally {
    await app.close();
  }
});

test('POST /products возвращает 401, если guard отклоняет запрос', async () => {
  const { app } = await createApp({
    guardCanActivate: () => {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'AUTH_REQUIRED',
        message: 'Требуется Bearer token владельца.',
      });
    },
  });

  try {
    const response = await request(app.getHttpServer())
      .post('/products')
      .field('sku', 'TEA-102')
      .field('name', 'Без авторизации')
      .field('priceMinor', '1000')
      .attach('image', Buffer.from('fake-image'), {
        filename: 'preview.png',
        contentType: 'image/png',
      })
      .expect(401);

    assert.equal(response.body.code, 'AUTH_REQUIRED');
  } finally {
    await app.close();
  }
});
