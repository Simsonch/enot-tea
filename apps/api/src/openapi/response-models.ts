import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';

export class HealthDbResponseDto {
  @ApiProperty({ type: 'string', example: 'ok', description: 'Liveness' })
  status!: string;

  @ApiProperty({ type: 'string', example: 'up', description: 'Database' })
  db!: string;
}

export class ProductListItemDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  sku!: string;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiPropertyOptional({ nullable: true, type: 'string' })
  description?: string | null;

  @ApiProperty({ type: 'number', example: 1000, description: 'Price in minor units' })
  priceMinor!: number;

  @ApiProperty({ type: 'boolean' })
  isActive!: boolean;
}

export class ProductPaginationDto {
  @ApiProperty({ type: 'number' })
  limit!: number;

  @ApiProperty({ type: 'number' })
  offset!: number;

  @ApiProperty({ type: 'number' })
  total!: number;
}

export class ProductsListResponseDto {
  @ApiProperty({ type: () => [ProductListItemDto] })
  items!: ProductListItemDto[];

  @ApiProperty({ type: () => ProductPaginationDto })
  pagination!: ProductPaginationDto;
}

export class OrderItemResponseDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  productId!: string;

  @ApiProperty({ type: 'number' })
  quantity!: number;

  @ApiProperty({ type: 'number' })
  priceMinor!: number;

  @ApiProperty({ type: 'number' })
  totalMinor!: number;
}

export class OrderStatusHistoryEntryDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiPropertyOptional({ enum: OrderStatus, enumName: 'OrderStatus' })
  fromStatus?: OrderStatus | null;

  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  toStatus!: OrderStatus;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  changedById?: string | null;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  comment?: string | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: string;
}

/**
 * `GET /orders/:id` and successful `POST /orders` / `PATCH` responses.
 * `statusHistory` is included when the application loads relations (read/detail flows).
 */
export class OrderResponseDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  customerId!: string;

  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  status!: OrderStatus;

  @ApiProperty({ type: 'number' })
  totalMinor!: number;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: () => [OrderItemResponseDto] })
  items!: OrderItemResponseDto[];

  @ApiPropertyOptional({ type: () => [OrderStatusHistoryEntryDto] })
  statusHistory?: OrderStatusHistoryEntryDto[];
}
