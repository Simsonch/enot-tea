var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ArrayMinSize, IsArray, IsInt, IsNotEmpty, IsString, Min, ValidateNested, } from 'class-validator';
import { Type } from 'class-transformer';
export class CreateOrderItemDto {
    productId;
    quantity;
}
__decorate([
    IsString({ message: 'productId должен быть строкой.' }),
    IsNotEmpty({ message: 'Укажите идентификатор товара (productId).' }),
    __metadata("design:type", String)
], CreateOrderItemDto.prototype, "productId", void 0);
__decorate([
    IsInt({ message: 'Количество должно быть целым числом.' }),
    Min(1, { message: 'Количество должно быть не меньше 1.' }),
    __metadata("design:type", Number)
], CreateOrderItemDto.prototype, "quantity", void 0);
export class CreateOrderDto {
    customerId;
    items;
}
__decorate([
    IsString({ message: 'customerId должен быть строкой.' }),
    IsNotEmpty({ message: 'Укажите идентификатор покупателя (customerId).' }),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "customerId", void 0);
__decorate([
    IsArray({ message: 'Список позиций (items) должен быть массивом.' }),
    ArrayMinSize(1, { message: 'Добавьте хотя бы одну позицию в заказ (items).' }),
    ValidateNested({ each: true }),
    Type(() => CreateOrderItemDto),
    __metadata("design:type", Array)
], CreateOrderDto.prototype, "items", void 0);
//# sourceMappingURL=orders.dto.js.map