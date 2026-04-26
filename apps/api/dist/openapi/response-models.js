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
import { OrderStatus } from '@prisma/client';
export class HealthDbResponseDto {
    status;
    db;
}
__decorate([
    ApiProperty({ type: 'string', example: 'ok', description: 'Liveness' }),
    __metadata("design:type", String)
], HealthDbResponseDto.prototype, "status", void 0);
__decorate([
    ApiProperty({ type: 'string', example: 'up', description: 'Database' }),
    __metadata("design:type", String)
], HealthDbResponseDto.prototype, "db", void 0);
export class ProductListItemDto {
    id;
    sku;
    name;
    description;
    priceMinor;
    isActive;
}
__decorate([
    ApiProperty({ type: 'string' }),
    __metadata("design:type", String)
], ProductListItemDto.prototype, "id", void 0);
__decorate([
    ApiProperty({ type: 'string' }),
    __metadata("design:type", String)
], ProductListItemDto.prototype, "sku", void 0);
__decorate([
    ApiProperty({ type: 'string' }),
    __metadata("design:type", String)
], ProductListItemDto.prototype, "name", void 0);
__decorate([
    ApiPropertyOptional({ nullable: true, type: 'string' }),
    __metadata("design:type", Object)
], ProductListItemDto.prototype, "description", void 0);
__decorate([
    ApiProperty({ type: 'number', example: 1000, description: 'Price in minor units' }),
    __metadata("design:type", Number)
], ProductListItemDto.prototype, "priceMinor", void 0);
__decorate([
    ApiProperty({ type: 'boolean' }),
    __metadata("design:type", Boolean)
], ProductListItemDto.prototype, "isActive", void 0);
export class ProductPaginationDto {
    limit;
    offset;
    total;
}
__decorate([
    ApiProperty({ type: 'number' }),
    __metadata("design:type", Number)
], ProductPaginationDto.prototype, "limit", void 0);
__decorate([
    ApiProperty({ type: 'number' }),
    __metadata("design:type", Number)
], ProductPaginationDto.prototype, "offset", void 0);
__decorate([
    ApiProperty({ type: 'number' }),
    __metadata("design:type", Number)
], ProductPaginationDto.prototype, "total", void 0);
export class ProductsListResponseDto {
    items;
    pagination;
}
__decorate([
    ApiProperty({ type: () => [ProductListItemDto] }),
    __metadata("design:type", Array)
], ProductsListResponseDto.prototype, "items", void 0);
__decorate([
    ApiProperty({ type: () => ProductPaginationDto }),
    __metadata("design:type", ProductPaginationDto)
], ProductsListResponseDto.prototype, "pagination", void 0);
export class OrderItemResponseDto {
    id;
    productId;
    quantity;
    priceMinor;
    totalMinor;
}
__decorate([
    ApiProperty({ type: 'string' }),
    __metadata("design:type", String)
], OrderItemResponseDto.prototype, "id", void 0);
__decorate([
    ApiProperty({ type: 'string' }),
    __metadata("design:type", String)
], OrderItemResponseDto.prototype, "productId", void 0);
__decorate([
    ApiProperty({ type: 'number' }),
    __metadata("design:type", Number)
], OrderItemResponseDto.prototype, "quantity", void 0);
__decorate([
    ApiProperty({ type: 'number' }),
    __metadata("design:type", Number)
], OrderItemResponseDto.prototype, "priceMinor", void 0);
__decorate([
    ApiProperty({ type: 'number' }),
    __metadata("design:type", Number)
], OrderItemResponseDto.prototype, "totalMinor", void 0);
export class OrderStatusHistoryEntryDto {
    id;
    fromStatus;
    toStatus;
    changedById;
    comment;
    createdAt;
}
__decorate([
    ApiProperty({ type: 'string' }),
    __metadata("design:type", String)
], OrderStatusHistoryEntryDto.prototype, "id", void 0);
__decorate([
    ApiPropertyOptional({ enum: OrderStatus, enumName: 'OrderStatus' }),
    __metadata("design:type", Object)
], OrderStatusHistoryEntryDto.prototype, "fromStatus", void 0);
__decorate([
    ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' }),
    __metadata("design:type", String)
], OrderStatusHistoryEntryDto.prototype, "toStatus", void 0);
__decorate([
    ApiPropertyOptional({ type: 'string', nullable: true }),
    __metadata("design:type", Object)
], OrderStatusHistoryEntryDto.prototype, "changedById", void 0);
__decorate([
    ApiPropertyOptional({ type: 'string', nullable: true }),
    __metadata("design:type", Object)
], OrderStatusHistoryEntryDto.prototype, "comment", void 0);
__decorate([
    ApiProperty({ type: 'string', format: 'date-time' }),
    __metadata("design:type", String)
], OrderStatusHistoryEntryDto.prototype, "createdAt", void 0);
/**
 * `GET /orders/:id` and successful `POST /orders` / `PATCH` responses.
 * `statusHistory` is included when the application loads relations (read/detail flows).
 */
export class OrderResponseDto {
    id;
    customerId;
    status;
    totalMinor;
    createdAt;
    updatedAt;
    items;
    statusHistory;
}
__decorate([
    ApiProperty({ type: 'string' }),
    __metadata("design:type", String)
], OrderResponseDto.prototype, "id", void 0);
__decorate([
    ApiProperty({ type: 'string' }),
    __metadata("design:type", String)
], OrderResponseDto.prototype, "customerId", void 0);
__decorate([
    ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' }),
    __metadata("design:type", String)
], OrderResponseDto.prototype, "status", void 0);
__decorate([
    ApiProperty({ type: 'number' }),
    __metadata("design:type", Number)
], OrderResponseDto.prototype, "totalMinor", void 0);
__decorate([
    ApiProperty({ type: 'string', format: 'date-time' }),
    __metadata("design:type", String)
], OrderResponseDto.prototype, "createdAt", void 0);
__decorate([
    ApiProperty({ type: 'string', format: 'date-time' }),
    __metadata("design:type", String)
], OrderResponseDto.prototype, "updatedAt", void 0);
__decorate([
    ApiProperty({ type: () => [OrderItemResponseDto] }),
    __metadata("design:type", Array)
], OrderResponseDto.prototype, "items", void 0);
__decorate([
    ApiPropertyOptional({ type: () => [OrderStatusHistoryEntryDto] }),
    __metadata("design:type", Array)
], OrderResponseDto.prototype, "statusHistory", void 0);
//# sourceMappingURL=response-models.js.map