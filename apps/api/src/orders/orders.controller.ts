import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiBusinessConflictBodyDto, ApiValidationErrorBodyDto } from '../openapi/error-models.js';
import { OrderResponseDto } from '../openapi/response-models.js';
import { OrdersService } from './orders.service.js';
import { CreateOrderDto, UpdateOrderStatusDto } from './orders.dto.js';

@Controller('orders')
@ApiTags('orders')
export class OrdersController {
  constructor(
    @Inject(OrdersService)
    private readonly ordersService: OrdersService,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get order with items and status history' })
  @ApiParam({ name: 'id', description: 'Order id', type: String })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiNotFoundResponse({ description: 'Order not found' })
  getById(@Param('id') id: string) {
    return this.ordersService.getById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create order and reserve stock' })
  @ApiBody({ type: CreateOrderDto })
  @ApiCreatedResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ type: ApiValidationErrorBodyDto, description: 'Invalid payload' })
  @ApiConflictResponse({ type: ApiBusinessConflictBodyDto, description: 'Out of stock or inactive product' })
  @ApiNotFoundResponse({ description: 'Customer, product, or inventory row not found' })
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel order' })
  @ApiParam({ name: 'id', description: 'Order id', type: String })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiConflictResponse({ type: ApiBusinessConflictBodyDto, description: 'Invalid transition or inventory invariant' })
  @ApiNotFoundResponse({ description: 'Order or inventory not found' })
  cancel(@Param('id') id: string) {
    return this.ordersService.cancel(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status' })
  @ApiParam({ name: 'id', description: 'Order id', type: String })
  @ApiBody({ type: UpdateOrderStatusDto })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ type: ApiValidationErrorBodyDto, description: 'Invalid payload' })
  @ApiConflictResponse({ type: ApiBusinessConflictBodyDto, description: 'Invalid transition or inventory invariant' })
  @ApiNotFoundResponse({ description: 'Order or inventory not found' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.updateStatus(id, dto);
  }
}
