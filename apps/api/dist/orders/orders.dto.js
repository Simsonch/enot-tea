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
import { ArrayMinSize, IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min, ValidateNested, } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus } from '@prisma/client';
export class CreateOrderItemDto {
    productId;
    quantity;
}
__decorate([
    ApiProperty({ type: 'string' }),
    IsString({ message: 'productId должен быть строкой.' }),
    IsNotEmpty({ message: 'Укажите идентификатор товара (productId).' }),
    __metadata("design:type", String)
], CreateOrderItemDto.prototype, "productId", void 0);
__decorate([
    ApiProperty({ type: 'number', minimum: 1, example: 1 }),
    IsInt({ message: 'Количество должно быть целым числом.' }),
    Min(1, { message: 'Количество должно быть не меньше 1.' }),
    __metadata("design:type", Number)
], CreateOrderItemDto.prototype, "quantity", void 0);
export class CreateOrderDto {
    customerId;
    items;
}
__decorate([
    ApiProperty({ type: 'string' }),
    IsString({ message: 'customerId должен быть строкой.' }),
    IsNotEmpty({ message: 'Укажите идентификатор покупателя (customerId).' }),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "customerId", void 0);
__decorate([
    ApiProperty({ type: () => [CreateOrderItemDto] }),
    IsArray({ message: 'Список позиций (items) должен быть массивом.' }),
    ArrayMinSize(1, { message: 'Добавьте хотя бы одну позицию в заказ (items).' }),
    ValidateNested({ each: true }),
    Type(() => CreateOrderItemDto),
    __metadata("design:type", Array)
], CreateOrderDto.prototype, "items", void 0);
export class UpdateOrderStatusDto {
    toStatus;
    comment;
}
__decorate([
    ApiProperty({
        enum: [
            OrderStatus.CONFIRMED,
            OrderStatus.PACKED,
            OrderStatus.SHIPPED,
            OrderStatus.DELIVERED,
        ],
        description: 'Target status; CANCELLED is not allowed (use /cancel).',
    }),
    IsIn([OrderStatus.CONFIRMED, OrderStatus.PACKED, OrderStatus.SHIPPED, OrderStatus.DELIVERED], {
        message: 'toStatus должен быть одним из значений: CONFIRMED, PACKED, SHIPPED, DELIVERED.',
    }),
    __metadata("design:type", String)
], UpdateOrderStatusDto.prototype, "toStatus", void 0);
__decorate([
    ApiPropertyOptional({ type: 'string', maxLength: 500 }),
    IsOptional(),
    IsString({ message: 'comment должен быть строкой.' }),
    IsNotEmpty({ message: 'comment не должен быть пустым.' }),
    MaxLength(500, { message: 'comment не должен превышать 500 символов.' }),
    __metadata("design:type", String)
], UpdateOrderStatusDto.prototype, "comment", void 0);
//# sourceMappingURL=orders.dto.js.map