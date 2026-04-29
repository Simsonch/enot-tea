import test from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service.js';
import { OwnerAuthGuard } from './owner-auth.guard.js';
import { hashPassword } from './password.js';

test('AuthService.login returns bearer token for OWNER credentials', async () => {
  process.env.JWT_SECRET = 'test-secret';
  const passwordHash = await hashPassword('correct-password');
  const prisma = {
    user: {
      findUnique: async () => ({
        id: 'owner-1',
        email: 'owner@example.com',
        passwordHash,
        roles: [{ role: Role.OWNER }],
      }),
    },
  } as any;
  const jwtService = new JwtService();
  const service = new AuthService(prisma, jwtService);

  const result = await service.login({
    email: 'owner@example.com',
    password: 'correct-password',
  });
  const payload = await jwtService.verifyAsync(result.accessToken, {
    secret: 'test-secret',
  });

  assert.equal(result.tokenType, 'Bearer');
  assert.equal(result.ownerId, 'owner-1');
  assert.equal(payload.sub, 'owner-1');
  assert.deepEqual(payload.roles, [Role.OWNER]);
});

test('AuthService.login rejects non-owner or invalid credentials', async () => {
  process.env.JWT_SECRET = 'test-secret';
  const passwordHash = await hashPassword('correct-password');
  const prisma = {
    user: {
      findUnique: async () => ({
        id: 'customer-1',
        email: 'customer@example.com',
        passwordHash,
        roles: [{ role: Role.CUSTOMER }],
      }),
    },
  } as any;
  const service = new AuthService(prisma, new JwtService());

  await assert.rejects(
    () => service.login({ email: 'customer@example.com', password: 'correct-password' }),
    (error: unknown) => error instanceof UnauthorizedException,
  );
});

test('OwnerAuthGuard attaches owner from valid Bearer token', async () => {
  process.env.JWT_SECRET = 'test-secret';
  const jwtService = new JwtService();
  const authService = {
    getJwtSecret: () => 'test-secret',
  } as AuthService;
  const prisma = {
    user: {
      findFirst: async () => ({
        id: 'owner-1',
        email: 'current-owner@example.com',
      }),
    },
  } as any;
  const token = await jwtService.signAsync(
    { sub: 'owner-1', email: 'owner@example.com', roles: [Role.OWNER] },
    { secret: 'test-secret' },
  );
  const request = { headers: { authorization: `Bearer ${token}` } };
  const guard = new OwnerAuthGuard(authService, jwtService, prisma);
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;

  assert.equal(await guard.canActivate(context), true);
  assert.deepEqual((request as any).owner, {
    id: 'owner-1',
    email: 'current-owner@example.com',
  });
});

test('OwnerAuthGuard rejects non-owner token', async () => {
  const jwtService = new JwtService();
  const authService = {
    getJwtSecret: () => 'test-secret',
  } as AuthService;
  const prisma = {
    user: {
      findFirst: async () => {
        throw new Error('non-owner token should not query user');
      },
    },
  } as any;
  const token = await jwtService.signAsync(
    { sub: 'user-1', email: 'user@example.com', roles: [Role.CUSTOMER] },
    { secret: 'test-secret' },
  );
  const guard = new OwnerAuthGuard(authService, jwtService, prisma);
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization: `Bearer ${token}` } }),
    }),
  } as any;

  await assert.rejects(
    () => guard.canActivate(context),
    (error: unknown) => error instanceof ForbiddenException,
  );
});

test('OwnerAuthGuard rejects signed token with malformed payload', async () => {
  const jwtService = new JwtService();
  const authService = {
    getJwtSecret: () => 'test-secret',
  } as AuthService;
  const prisma = {
    user: {
      findFirst: async () => {
        throw new Error('malformed token should not query user');
      },
    },
  } as any;
  const token = await jwtService.signAsync(
    { sub: 'owner-1', email: 'owner@example.com' },
    { secret: 'test-secret' },
  );
  const guard = new OwnerAuthGuard(authService, jwtService, prisma);
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization: `Bearer ${token}` } }),
    }),
  } as any;

  await assert.rejects(
    () => guard.canActivate(context),
    (error: unknown) => error instanceof UnauthorizedException,
  );
});

test('OwnerAuthGuard rejects token when owner role was removed', async () => {
  const jwtService = new JwtService();
  const authService = {
    getJwtSecret: () => 'test-secret',
  } as AuthService;
  const prisma = {
    user: {
      findFirst: async () => null,
    },
  } as any;
  const token = await jwtService.signAsync(
    { sub: 'owner-1', email: 'owner@example.com', roles: [Role.OWNER] },
    { secret: 'test-secret' },
  );
  const guard = new OwnerAuthGuard(authService, jwtService, prisma);
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization: `Bearer ${token}` } }),
    }),
  } as any;

  await assert.rejects(
    () => guard.canActivate(context),
    (error: unknown) => error instanceof ForbiddenException,
  );
});
