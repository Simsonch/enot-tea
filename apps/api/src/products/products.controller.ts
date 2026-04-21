import { Controller, Get, Query } from "@nestjs/common";
import { ProductsService } from "./products.service.js";
import type { GetProductsQueryDto } from "./products.dto.js";

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(@Query() query: GetProductsQueryDto) {
    return this.productsService.list(query);
  }
}