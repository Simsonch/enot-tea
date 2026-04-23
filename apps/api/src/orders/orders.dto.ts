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
  @IsString({ message: 'productId должен быть строкой.' })
  @IsNotEmpty({ message: 'Укажите идентификатор товара (productId).' })
  productId!: string;

  @IsInt({ message: 'Количество должно быть целым числом.' })
  @Min(1, { message: 'Количество должно быть не меньше 1.' })
  quantity!: number;
}

export class CreateOrderDto {
  @IsString({ message: 'customerId должен быть строкой.' })
  @IsNotEmpty({ message: 'Укажите идентификатор покупателя (customerId).' })
  customerId!: string;

  @IsArray({ message: 'Список позиций (items) должен быть массивом.' })
  @ArrayMinSize(1, { message: 'Добавьте хотя бы одну позицию в заказ (items).' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}

export class UpdateOrderStatusDto {
  @IsIn(
    [OrderStatus.CONFIRMED, OrderStatus.PACKED, OrderStatus.SHIPPED, OrderStatus.DELIVERED],
    {
      message:
        'toStatus должен быть одним из значений: CONFIRMED, PACKED, SHIPPED, DELIVERED.',
    },
  )
  toStatus!: OrderStatus;

  @IsOptional()
  @IsString({ message: 'comment должен быть строкой.' })
  @IsNotEmpty({ message: 'comment не должен быть пустым.' })
  @MaxLength(500, { message: 'comment не должен превышать 500 символов.' })
  comment?: string;
}
