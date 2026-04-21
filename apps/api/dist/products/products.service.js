var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {} from './products.dto.js';
let ProductsService = class ProductsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(query) {
        const where = query.isActive === undefined ? {} : { isActive: query.isActive };
        const [items, total] = await this.prisma.$transaction([
            this.prisma.product.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: query.limit,
                skip: query.offset,
                select: {
                    id: true,
                    sku: true,
                    name: true,
                    description: true,
                    priceMinor: true,
                    isActive: true,
                },
            }),
            this.prisma.product.count({ where }),
        ]);
        return {
            items,
            pagination: {
                limit: query.limit,
                offset: query.offset,
                total,
            },
        };
    }
};
ProductsService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService])
], ProductsService);
export { ProductsService };
//# sourceMappingURL=products.service.js.map