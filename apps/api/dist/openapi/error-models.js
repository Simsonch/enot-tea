var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ValidationErrorField } from './validation-error-field.js';
/**
 * 400: validation and payload errors produced by the global `ValidationPipe` and service guards.
 */
export class ApiValidationErrorBodyDto {
    statusCode;
    code;
    message;
    errors;
}
__decorate([
    ApiProperty({ type: 'number', example: 400 }),
    __metadata("design:type", Number)
], ApiValidationErrorBodyDto.prototype, "statusCode", void 0);
__decorate([
    ApiProperty({ type: 'string', example: 'VALIDATION_ERROR' }),
    __metadata("design:type", String)
], ApiValidationErrorBodyDto.prototype, "code", void 0);
__decorate([
    ApiProperty({ type: 'string' }),
    __metadata("design:type", String)
], ApiValidationErrorBodyDto.prototype, "message", void 0);
__decorate([
    ApiPropertyOptional({ type: () => [ValidationErrorField] }),
    __metadata("design:type", Object)
], ApiValidationErrorBodyDto.prototype, "errors", void 0);
/**
 * 409: domain/business rules (e.g. invalid status transition, inventory invariants, insufficient stock).
 */
export class ApiBusinessConflictBodyDto {
    statusCode;
    code;
    message;
    details;
}
__decorate([
    ApiProperty({ type: 'number', example: 409 }),
    __metadata("design:type", Number)
], ApiBusinessConflictBodyDto.prototype, "statusCode", void 0);
__decorate([
    ApiProperty({
        type: 'string',
        example: 'INVALID_ORDER_STATUS_TRANSITION',
        description: 'One of: INSUFFICIENT_STOCK, INVALID_ORDER_STATUS_TRANSITION, INVENTORY_INVARIANT_VIOLATION',
    }),
    __metadata("design:type", String)
], ApiBusinessConflictBodyDto.prototype, "code", void 0);
__decorate([
    ApiProperty({ type: 'string' }),
    __metadata("design:type", String)
], ApiBusinessConflictBodyDto.prototype, "message", void 0);
__decorate([
    ApiPropertyOptional({ type: 'object', additionalProperties: true }),
    __metadata("design:type", Object)
], ApiBusinessConflictBodyDto.prototype, "details", void 0);
//# sourceMappingURL=error-models.js.map