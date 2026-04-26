import { Injectable, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/** When set to `1`, Prisma will not open a real DB connection (e.g. OpenAPI export, metadata-only tests). */
export const OPENAPI_EXPORT_ENV = 'OPENAPI_EXPORT';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    if (process.env[OPENAPI_EXPORT_ENV] === '1') {
      return;
    }
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (process.env[OPENAPI_EXPORT_ENV] === '1') {
      return;
    }
    await this.$disconnect();
  }
}