var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
/** When set to `1`, Prisma will not open a real DB connection (e.g. OpenAPI export, metadata-only tests). */
export const OPENAPI_EXPORT_ENV = 'OPENAPI_EXPORT';
let PrismaService = class PrismaService extends PrismaClient {
    async onModuleInit() {
        if (process.env[OPENAPI_EXPORT_ENV] === '1') {
            return;
        }
        await this.$connect();
    }
    async onModuleDestroy() {
        if (process.env[OPENAPI_EXPORT_ENV] === '1') {
            return;
        }
        await this.$disconnect();
    }
};
PrismaService = __decorate([
    Injectable()
], PrismaService);
export { PrismaService };
//# sourceMappingURL=prisma.service.js.map