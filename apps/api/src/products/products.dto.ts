import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

function transformBoolean(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') {
      return true;
    }
    if (value.toLowerCase() === 'false') {
      return false;
    }
  }
  return value;
}

export class GetProductsQueryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => transformBoolean(value))
  @IsBoolean()
  isActive?: boolean;
}

export class CreateProductDto {
  @ApiProperty({ description: 'Уникальный SKU товара' })
  @MinLength(1)
  @MaxLength(64)
  @IsString()
  sku!: string;

  @ApiProperty({ description: 'Название товара' })
  @MinLength(1)
  @MaxLength(255)
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Цена в минорных единицах', minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMinor!: number;

  @ApiPropertyOptional({ description: 'Описание товара' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: 'Тип товара (например, "чай")' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  productType?: string;

  @ApiPropertyOptional({ description: 'Категория товара (например, "зеленый")' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  category?: string;

  @ApiPropertyOptional({ description: 'Процент скидки', minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @ApiPropertyOptional({ description: 'Маркировка акции, выдаваемая в витрине' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  promotionLabel?: string;

  @ApiPropertyOptional({ description: 'Цена со скидкой в минорных единицах', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  discountedPriceMinor?: number;

  @ApiPropertyOptional({ description: 'Активен ли товар в каталоге', default: true })
  @IsOptional()
  @Transform(({ value }) => transformBoolean(value))
  @IsBoolean()
  isActive?: boolean;
}
