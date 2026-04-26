import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus } from '@prisma/client';

export class CreateOrderItemDto {
  @ApiProperty({ type: 'string' })
  @IsString({ message: 'productId должен быть строкой.' })
  @IsNotEmpty({ message: 'Укажите идентификатор товара (productId).' })
  productId!: string;

  @ApiProperty({ type: 'number', minimum: 1, example: 1 })
  @IsInt({ message: 'Количество должно быть целым числом.' })
  @Min(1, { message: 'Количество должно быть не меньше 1.' })
  quantity!: number;
}

export class CreateOrderDto {
  @ApiProperty({ type: 'string' })
  @IsString({ message: 'customerId должен быть строкой.' })
  @IsNotEmpty({ message: 'Укажите идентификатор покупателя (customerId).' })
  customerId!: string;

  @ApiProperty({ type: () => [CreateOrderItemDto] })
  @IsArray({ message: 'Список позиций (items) должен быть массивом.' })
  @ArrayMinSize(1, { message: 'Добавьте хотя бы одну позицию в заказ (items).' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}

export class UpdateOrderStatusDto {
  @ApiProperty({
    enum: [
      OrderStatus.CONFIRMED,
      OrderStatus.PACKED,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ],
    description: 'Target status; CANCELLED is not allowed (use /cancel).',
  })
  @IsIn(
    [OrderStatus.CONFIRMED, OrderStatus.PACKED, OrderStatus.SHIPPED, OrderStatus.DELIVERED],
    {
      message:
        'toStatus должен быть одним из значений: CONFIRMED, PACKED, SHIPPED, DELIVERED.',
    },
  )
  toStatus!: OrderStatus;

  @ApiPropertyOptional({ type: 'string', maxLength: 500 })
  @IsOptional()
  @IsString({ message: 'comment должен быть строкой.' })
  @IsNotEmpty({ message: 'comment не должен быть пустым.' })
  @MaxLength(500, { message: 'comment не должен превышать 500 символов.' })
  comment?: string;
}
