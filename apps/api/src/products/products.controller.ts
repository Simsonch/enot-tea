import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { MaxFileSizeValidator, ParseFilePipe } from '@nestjs/common';
import type { Express } from 'express';
import { memoryStorage } from 'multer';
import { ProductsListResponseDto, ProductResponseDto } from '../openapi/response-models.js';
import {
  ApiAuthErrorBodyDto,
  ApiBusinessConflictBodyDto,
  ApiValidationErrorBodyDto,
} from '../openapi/error-models.js';
import { OwnerAuthGuard } from '../auth/owner-auth.guard.js';
import { ProductsService } from './products.service.js';
import { CreateProductDto, GetProductsQueryDto } from './products.dto.js';
import { appConfig } from '../common/app.config.js';

const productImageMaxSize = appConfig.productImage.maxSizeBytes;

const imageValidationExceptionFactory = (errors: unknown) =>
  new BadRequestException({
    statusCode: 400,
    code: 'VALIDATION_ERROR',
    message: 'Файл изображения не прошёл проверку.',
    errors: [
      {
        field: 'image',
        messages: Array.isArray(errors) ? errors : [String(errors)],
      },
    ],
  });

@Controller('products')
@ApiTags('products')
export class ProductsController {
  constructor(
    @Inject(ProductsService)
    private readonly productsService: ProductsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Список товаров с пагинацией' })
  @ApiQuery({ name: 'limit', required: false, type: Number, minimum: 1, maximum: 100 })
  @ApiQuery({ name: 'offset', required: false, type: Number, minimum: 0 })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiOkResponse({ type: ProductsListResponseDto })
  list(@Query() query: GetProductsQueryDto) {
    return this.productsService.list(query);
  }

  @Post()
  @UseGuards(OwnerAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: productImageMaxSize },
    }),
  )
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Создать товар каталога' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      required: ['sku', 'name', 'priceMinor', 'image'],
      properties: {
        sku: { type: 'string' },
        name: { type: 'string' },
        priceMinor: { type: 'number', minimum: 0 },
        description: { type: 'string' },
        productType: { type: 'string' },
        category: { type: 'string' },
        discountPercent: { type: 'number', minimum: 0, maximum: 100 },
        promotionLabel: { type: 'string' },
        discountedPriceMinor: { type: 'number', minimum: 0 },
        isActive: { type: 'boolean' },
        image: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiCreatedResponse({ type: ProductResponseDto })
  @ApiBadRequestResponse({
    type: ApiValidationErrorBodyDto,
    description: 'Некорректное тело запроса или файл изображения',
  })
  @ApiUnauthorizedResponse({
    type: ApiAuthErrorBodyDto,
    description: 'Не передан или недействителен Bearer token',
  })
  @ApiConflictResponse({
    type: ApiBusinessConflictBodyDto,
    description: 'SKU уже существует',
  })
  create(
    @Body() dto: CreateProductDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: productImageMaxSize }),
        ],
        exceptionFactory: imageValidationExceptionFactory,
      }),
    ) file: Express.Multer.File,
  ) {
    if (!appConfig.productImage.allowedMimeTypes.includes(file.mimetype)) {
      throw imageValidationExceptionFactory([
        `Validation failed (current file type is ${file.mimetype}, expected type is ${appConfig.productImage.allowedMimeTypes.join(', ')})`,
      ]);
    }
    return this.productsService.create(dto, file);
  }
}
