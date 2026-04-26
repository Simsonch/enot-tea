var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
export class GetProductsQueryDto {
    limit = 20;
    offset = 0;
    isActive;
}
__decorate([
    ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 }),
    IsOptional(),
    IsInt(),
    Min(1),
    Max(100),
    __metadata("design:type", Object)
], GetProductsQueryDto.prototype, "limit", void 0);
__decorate([
    ApiPropertyOptional({ default: 0, minimum: 0 }),
    IsOptional(),
    IsInt(),
    Min(0),
    __metadata("design:type", Object)
], GetProductsQueryDto.prototype, "offset", void 0);
__decorate([
    ApiPropertyOptional(),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], GetProductsQueryDto.prototype, "isActive", void 0);
//# sourceMappingURL=products.dto.js.map