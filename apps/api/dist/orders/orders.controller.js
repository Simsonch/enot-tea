var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Patch, Post, } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBody, ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags, } from '@nestjs/swagger';
import { ApiBusinessConflictBodyDto, ApiValidationErrorBodyDto } from '../openapi/error-models.js';
import { OrderResponseDto } from '../openapi/response-models.js';
import { OrdersService } from './orders.service.js';
import { CreateOrderDto, UpdateOrderStatusDto } from './orders.dto.js';
let OrdersController = class OrdersController {
    ordersService;
    constructor(ordersService) {
        this.ordersService = ordersService;
    }
    getById(id) {
        return this.ordersService.getById(id);
    }
    create(dto) {
        return this.ordersService.create(dto);
    }
    cancel(id) {
        return this.ordersService.cancel(id);
    }
    updateStatus(id, dto) {
        return this.ordersService.updateStatus(id, dto);
    }
};
__decorate([
    Get(':id'),
    ApiOperation({ summary: 'Get order with items and status history' }),
    ApiParam({ name: 'id', description: 'Order id', type: String }),
    ApiOkResponse({ type: OrderResponseDto }),
    ApiNotFoundResponse({ description: 'Order not found' }),
    __param(0, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "getById", null);
__decorate([
    Post(),
    HttpCode(HttpStatus.CREATED),
    ApiOperation({ summary: 'Create order and reserve stock' }),
    ApiBody({ type: CreateOrderDto }),
    ApiCreatedResponse({ type: OrderResponseDto }),
    ApiBadRequestResponse({ type: ApiValidationErrorBodyDto, description: 'Invalid payload' }),
    ApiConflictResponse({ type: ApiBusinessConflictBodyDto, description: 'Out of stock or inactive product' }),
    ApiNotFoundResponse({ description: 'Customer, product, or inventory row not found' }),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateOrderDto]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "create", null);
__decorate([
    Patch(':id/cancel'),
    ApiOperation({ summary: 'Cancel order' }),
    ApiParam({ name: 'id', description: 'Order id', type: String }),
    ApiOkResponse({ type: OrderResponseDto }),
    ApiConflictResponse({ type: ApiBusinessConflictBodyDto, description: 'Invalid transition or inventory invariant' }),
    ApiNotFoundResponse({ description: 'Order or inventory not found' }),
    __param(0, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "cancel", null);
__decorate([
    Patch(':id/status'),
    ApiOperation({ summary: 'Update order status' }),
    ApiParam({ name: 'id', description: 'Order id', type: String }),
    ApiBody({ type: UpdateOrderStatusDto }),
    ApiOkResponse({ type: OrderResponseDto }),
    ApiBadRequestResponse({ type: ApiValidationErrorBodyDto, description: 'Invalid payload' }),
    ApiConflictResponse({ type: ApiBusinessConflictBodyDto, description: 'Invalid transition or inventory invariant' }),
    ApiNotFoundResponse({ description: 'Order or inventory not found' }),
    __param(0, Param('id')),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateOrderStatusDto]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "updateStatus", null);
OrdersController = __decorate([
    Controller('orders'),
    ApiTags('orders'),
    __param(0, Inject(OrdersService)),
    __metadata("design:paramtypes", [OrdersService])
], OrdersController);
export { OrdersController };
//# sourceMappingURL=orders.controller.js.map