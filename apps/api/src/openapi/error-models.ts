import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ValidationErrorField } from './validation-error-field.js';

/**
 * 400: ошибки валидации и тела запроса от глобального `ValidationPipe` и проверок сервиса.
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
 * 401/403: ошибки owner-auth guard и login endpoint.
 */
export class ApiAuthErrorBodyDto {
  @ApiProperty({ type: 'number', example: 401 })
  statusCode!: number;

  @ApiProperty({
    type: 'string',
    example: 'AUTH_REQUIRED',
    description:
      'Один из: AUTH_REQUIRED, AUTH_INVALID_TOKEN, AUTH_INVALID_CREDENTIALS, OWNER_ONLY',
  })
  code!: string;

  @ApiProperty({ type: 'string' })
  message!: string;
}

/**
 * 409: доменные/бизнес-правила (недопустимый переход статуса, инварианты склада, недостаток остатка).
 */
export class ApiBusinessConflictBodyDto {
  @ApiProperty({ type: 'number', example: 409 })
  statusCode!: number;

  @ApiProperty({
    type: 'string',
    example: 'INVALID_ORDER_STATUS_TRANSITION',
    description:
      'Один из: INSUFFICIENT_STOCK, PRODUCT_INACTIVE, INVALID_ORDER_STATUS_TRANSITION, INVENTORY_INVARIANT_VIOLATION',
  })
  code!: string;

  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  details?: Record<string, unknown>;
}

/**
 * 404: стандартный ответ NestJS «не найдено» от проверок сервиса.
 */
export class ApiNotFoundErrorBodyDto {
  @ApiProperty({ type: 'number', example: 404 })
  statusCode!: number;

  @ApiProperty({ type: 'string', example: 'Заказ orderId=order-1 не найден.' })
  message!: string;

  @ApiProperty({ type: 'string', example: 'Не найдено' })
  error!: string;
}
