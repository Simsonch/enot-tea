import { ConflictException, Injectable, Logger } from '@nestjs/common';
import type { Express } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service.js';
import { FileStorageService } from '../storage/file-storage.service.js';
import { type CreateProductDto, type GetProductsQueryDto } from './products.dto.js';

const productSelect = {
  id: true,
  sku: true,
  name: true,
  description: true,
  priceMinor: true,
  productType: true,
  category: true,
  discountPercent: true,
  promotionLabel: true,
  discountedPriceMinor: true,
  imageUrl: true,
  isActive: true,
} as const;

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorage: FileStorageService,
  ) {}

  async list(query: GetProductsQueryDto) {
    const where =
      query.isActive === undefined ? {} : { isActive: query.isActive };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
        select: productSelect,
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

  async create(dto: CreateProductDto, file: Express.Multer.File) {
    const savedImage = await this.fileStorage.saveProductImage({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });

    try {
      return await this.prisma.product.create({
        data: {
          sku: dto.sku,
          name: dto.name,
          description: dto.description ?? null,
          priceMinor: dto.priceMinor,
          productType: dto.productType ?? null,
          category: dto.category ?? null,
          discountPercent: dto.discountPercent ?? null,
          promotionLabel: dto.promotionLabel ?? null,
          discountedPriceMinor: dto.discountedPriceMinor ?? null,
          imagePath: savedImage.relativePath,
          imageUrl: savedImage.publicUrl,
          isActive: dto.isActive ?? true,
        },
        select: productSelect,
      });
    } catch (error) {
      try {
        await this.fileStorage.delete(savedImage.relativePath);
      } catch (cleanupError) {
        const err = cleanupError as Error;
        this.logger.warn(`Не удалось удалить файл после отката транзакции: ${savedImage.relativePath}`, err.stack);
      }

      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          statusCode: 409,
          code: 'PRODUCT_DUPLICATE',
          message: 'Товар с таким SKU уже существует.',
        });
      }
      throw error;
    }
  }
}
