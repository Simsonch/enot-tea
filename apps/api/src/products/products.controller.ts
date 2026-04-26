import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ProductsListResponseDto } from '../openapi/response-models.js';
import { ProductsService } from './products.service.js';
import { GetProductsQueryDto } from './products.dto.js';

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
}