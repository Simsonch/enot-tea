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
    description: 'One of: INSUFFICIENT_STOCK, INVALID_ORDER_STATUS_TRANSITION, INVENTORY_INVARIANT_VIOLATION',
  })
  code!: string;

  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  details?: Record<string, unknown>;
}
