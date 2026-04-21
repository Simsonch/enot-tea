import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { type GetProductsQueryDto } from './products.dto.js';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: GetProductsQueryDto) {
    const where =
      query.isActive === undefined ? {} : { isActive: query.isActive };

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
}