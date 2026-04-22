import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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
