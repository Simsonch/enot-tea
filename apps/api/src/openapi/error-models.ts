import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ValidationErrorField } from './validation-error-field.js';

/**
 * 400: validation and payload errors produced by the global `ValidationPipe` and service guards.
 */
export class ApiValidationErrorBodyDto {
  @ApiProperty({ type: 'number', example: 400 })
  statusCode!: number;

  @ApiProperty({ type: 'string', example: 'VALIDATION_ERROR' })
  code!: string;

  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiPropertyOptional({ type: () => [ValidationErrorField] })
  errors?: ValidationErrorField[] | undefined;
}

/**
 * 409: domain/business rules (e.g. invalid status transition, inventory invariants, insufficient stock).
 */
export class ApiBusinessConflictBodyDto {
  @ApiProperty({ type: 'number', example: 409 })
  statusCode!: number;

  @ApiProperty({
    type: 'string',
    example: 'INVALID_ORDER_STATUS_TRANSITION',
    description: 'One of: INSUFFICIENT_STOCK, PRODUCT_INACTIVE, INVALID_ORDER_STATUS_TRANSITION, INVENTORY_INVARIANT_VIOLATION',
  })
  code!: string;

  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  details?: Record<string, unknown>;
}

/**
 * 404: default NestJS not-found response used by service guards.
 */
export class ApiNotFoundErrorBodyDto {
  @ApiProperty({ type: 'number', example: 404 })
  statusCode!: number;

  @ApiProperty({ type: 'string', example: 'Заказ orderId=order-1 не найден.' })
  message!: string;

  @ApiProperty({ type: 'string', example: 'Not Found' })
  error!: string;
}
