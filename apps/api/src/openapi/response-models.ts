import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';

const paymentStatuses = ['PENDING', 'INVOICE_SENT', 'PAID', 'REFUNDED', 'PAYMENT_FAILED'] as const;
type PaymentStatus = (typeof paymentStatuses)[number];

const fulfillmentStatuses = ['RESERVED', 'HANDED_TO_CARRIER', 'DELIVERED', 'RETURNED'] as const;
type FulfillmentStatus = (typeof fulfillmentStatuses)[number];

const orderStatusDimensions = ['ORDER', 'PAYMENT', 'FULFILLMENT'] as const;
type OrderStatusDimension = (typeof orderStatusDimensions)[number];

export class HealthDbResponseDto {
  @ApiProperty({ type: 'string', example: 'ok', description: 'Проверка жизнеспособности' })
  status!: string;

  @ApiProperty({ type: 'string', example: 'up', description: 'База данных' })
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

  @ApiProperty({ type: 'number', example: 1000, description: 'Цена в минорных единицах' })
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

export class OrderListItemDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', nullable: true })
  customerId!: string | null;

  @ApiProperty({ type: 'string' })
  customerFullName!: string;

  @ApiProperty({ type: 'string', format: 'email' })
  customerEmail!: string;

  @ApiProperty({ type: 'string', nullable: true })
  customerPhone!: string | null;

  @ApiProperty({ type: 'string' })
  shippingAddress!: string;

  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  status!: OrderStatus;

  @ApiProperty({ enum: paymentStatuses, enumName: 'PaymentStatus' })
  paymentStatus!: PaymentStatus;

  @ApiProperty({ enum: fulfillmentStatuses, enumName: 'FulfillmentStatus' })
  fulfillmentStatus!: FulfillmentStatus;

  @ApiProperty({ type: 'number' })
  totalMinor!: number;

  @ApiProperty({ type: 'number' })
  itemsCount!: number;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: string;
}

export class OrderPaginationDto {
  @ApiProperty({ type: 'number' })
  limit!: number;

  @ApiProperty({ type: 'number' })
  offset!: number;

  @ApiProperty({ type: 'number' })
  total!: number;
}

export class OrdersListResponseDto {
  @ApiProperty({ type: () => [OrderListItemDto] })
  items!: OrderListItemDto[];

  @ApiProperty({ type: () => OrderPaginationDto })
  pagination!: OrderPaginationDto;
}

export class OrderStatusHistoryEntryDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ enum: orderStatusDimensions, enumName: 'OrderStatusDimension' })
  statusDimension!: OrderStatusDimension;

  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus', nullable: true })
  fromStatus!: OrderStatus | null;

  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus', nullable: true })
  toStatus!: OrderStatus | null;

  @ApiProperty({ enum: paymentStatuses, enumName: 'PaymentStatus', nullable: true })
  fromPaymentStatus!: PaymentStatus | null;

  @ApiProperty({ enum: paymentStatuses, enumName: 'PaymentStatus', nullable: true })
  toPaymentStatus!: PaymentStatus | null;

  @ApiProperty({ enum: fulfillmentStatuses, enumName: 'FulfillmentStatus', nullable: true })
  fromFulfillmentStatus!: FulfillmentStatus | null;

  @ApiProperty({ enum: fulfillmentStatuses, enumName: 'FulfillmentStatus', nullable: true })
  toFulfillmentStatus!: FulfillmentStatus | null;

  @ApiProperty({ type: 'string', nullable: true })
  changedById!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  comment!: string | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: string;
}

/**
 * Ответы `GET /orders/:id` и успешные `POST /orders` / `PATCH`.
 * Эндпоинты заказа всегда отдают `items` и `statusHistory`, поэтому в JSON
 * присутствуют nullable-поля, даже если они не релевантны гостевому checkout
 * или измерению истории.
 */
export class OrderResponseDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({
    type: 'string',
    nullable: true,
    description: 'Связанный id покупателя; null для гостевых заказов.',
  })
  customerId!: string | null;

  @ApiProperty({ type: 'string' })
  customerFullName!: string;

  @ApiProperty({ type: 'string', format: 'email' })
  customerEmail!: string;

  @ApiProperty({ type: 'string', nullable: true })
  customerPhone!: string | null;

  @ApiProperty({ type: 'string' })
  shippingAddress!: string;

  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  status!: OrderStatus;

  @ApiProperty({ enum: paymentStatuses, enumName: 'PaymentStatus' })
  paymentStatus!: PaymentStatus;

  @ApiProperty({ enum: fulfillmentStatuses, enumName: 'FulfillmentStatus' })
  fulfillmentStatus!: FulfillmentStatus;

  @ApiProperty({ type: 'number' })
  totalMinor!: number;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: () => [OrderItemResponseDto] })
  items!: OrderItemResponseDto[];

  @ApiProperty({ type: () => [OrderStatusHistoryEntryDto] })
  statusHistory!: OrderStatusHistoryEntryDto[];
}
