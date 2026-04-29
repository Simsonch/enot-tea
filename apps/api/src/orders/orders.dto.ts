import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsDateString,
  IsEmail,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus } from '@prisma/client';

export class CreateOrderItemDto {
  @ApiProperty({ type: 'string', description: 'Идентификатор товара из публичного каталога.' })
  @IsString({ message: 'productId должен быть строкой.' })
  @IsNotEmpty({ message: 'Укажите идентификатор товара (productId).' })
  productId!: string;

  @ApiProperty({ type: 'number', minimum: 1, example: 1 })
  @IsInt({ message: 'Количество должно быть целым числом.' })
  @Min(1, { message: 'Количество должно быть не меньше 1.' })
  quantity!: number;
}

export class CreateOrderDto {
  @ApiPropertyOptional({
    type: 'string',
    description:
      'Необязательный связанный id покупателя для негостевых заказов; для гостевого checkout не указывайте.',
  })
  @IsOptional()
  @IsString({ message: 'customerId должен быть строкой.' })
  @IsNotEmpty({ message: 'Укажите идентификатор покупателя (customerId).' })
  customerId?: string;

  @ApiProperty({
    type: 'string',
    example: 'Иван Иванов',
    description: 'Снимок ФИО гостя/покупателя, хранимый в заказе.',
  })
  @IsString({ message: 'customerFullName должен быть строкой.' })
  @IsNotEmpty({ message: 'Укажите ФИО покупателя (customerFullName).' })
  customerFullName!: string;

  @ApiProperty({
    type: 'string',
    format: 'email',
    example: 'customer@example.com',
    description: 'Снимок email гостя/покупателя, хранимый в заказе.',
  })
  @IsEmail({}, { message: 'customerEmail должен быть корректным email.' })
  @IsNotEmpty({ message: 'Укажите email покупателя (customerEmail).' })
  customerEmail!: string;

  @ApiPropertyOptional({
    type: 'string',
    example: '+995 555 010 010',
    description: 'Необязательный снимок телефона.',
  })
  @IsOptional()
  @IsString({ message: 'customerPhone должен быть строкой.' })
  @IsNotEmpty({ message: 'customerPhone не должен быть пустым.' })
  customerPhone?: string;

  @ApiProperty({
    type: 'string',
    example: 'Тбилиси, ул. Руставели, 1',
    description: 'Снимок адреса доставки, хранимый в заказе.',
  })
  @IsString({ message: 'shippingAddress должен быть строкой.' })
  @IsNotEmpty({ message: 'Укажите адрес доставки (shippingAddress).' })
  shippingAddress!: string;

  @ApiProperty({ type: () => [CreateOrderItemDto], minItems: 1 })
  @IsArray({ message: 'Список позиций (items) должен быть массивом.' })
  @ArrayMinSize(1, { message: 'Добавьте хотя бы одну позицию в заказ (items).' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}

export class GetOrdersQueryDto {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;

  @ApiPropertyOptional({ enum: OrderStatus, enumName: 'OrderStatus' })
  @IsOptional()
  @IsIn(Object.values(OrderStatus), {
    message: 'status должен быть одним из значений OrderStatus.',
  })
  status?: OrderStatus;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @IsOptional()
  @IsDateString({}, { message: 'from должен быть датой в ISO 8601.' })
  from?: string;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @IsOptional()
  @IsDateString({}, { message: 'to должен быть датой в ISO 8601.' })
  to?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({
    enum: [
      OrderStatus.CONFIRMED,
      OrderStatus.PACKED,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ],
    description: 'Целевой статус; CANCELLED недопустим (используйте /cancel).',
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

export class ManualOrderLifecycleTransitionDto {
  @ApiPropertyOptional({ type: 'string', maxLength: 500 })
  @IsOptional()
  @IsString({ message: 'comment должен быть строкой.' })
  @IsNotEmpty({ message: 'comment не должен быть пустым.' })
  @MaxLength(500, { message: 'comment не должен превышать 500 символов.' })
  comment?: string;
}
