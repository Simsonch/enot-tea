import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { formatValidationFieldErrors } from '../common/validation-error-format.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './auth.dto.js';

Reflect.defineMetadata('design:paramtypes', [LoginDto], AuthController.prototype, 'login');

async function createApp(login?: (dto: LoginDto) => Promise<unknown>) {
  const authServiceMock = {
    login:
      login ??
      (async (dto: LoginDto) => ({
        accessToken: 'token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        ownerId: 'owner-1',
        email: dto.email,
      })),
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [{ provide: AuthService, useValue: authServiceMock }],
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
  return app;
}

test('POST /auth/login returns owner bearer token', async () => {
  const app = await createApp();
  try {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'owner@example.com', password: 'secret' })
      .expect(200);

    assert.equal(response.body.accessToken, 'token');
    assert.equal(response.body.tokenType, 'Bearer');
    assert.equal(response.body.email, 'owner@example.com');
  } finally {
    await app.close();
  }
});

test('POST /auth/login validates payload and returns VALIDATION_ERROR', async () => {
  const app = await createApp();
  try {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'not-email', password: '' })
      .expect(400);

    assert.equal(response.body.code, 'VALIDATION_ERROR');
    assert.ok(response.body.errors.some((error: { field: string }) => error.field === 'email'));
    assert.ok(response.body.errors.some((error: { field: string }) => error.field === 'password'));
  } finally {
    await app.close();
  }
});

test('POST /auth/login returns 401 for invalid credentials', async () => {
  const app = await createApp(async () => {
    throw new UnauthorizedException({
      statusCode: 401,
      code: 'AUTH_INVALID_CREDENTIALS',
      message: 'Неверный email или пароль владельца.',
    });
  });
  try {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'owner@example.com', password: 'wrong' })
      .expect(401);

    assert.equal(response.body.code, 'AUTH_INVALID_CREDENTIALS');
  } finally {
    await app.close();
  }
});
