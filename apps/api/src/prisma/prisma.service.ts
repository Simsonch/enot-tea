import { Injectable, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * При значении `1` Prisma не открывает реальное соединение с БД
 * (экспорт OpenAPI, тесты только метаданных).
 */
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