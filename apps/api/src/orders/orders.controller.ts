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
import {
  ApiBusinessConflictBodyDto,
  ApiNotFoundErrorBodyDto,
  ApiValidationErrorBodyDto,
} from '../openapi/error-models.js';
import { OrderResponseDto } from '../openapi/response-models.js';
import { OrdersService } from './orders.service.js';
import {
  CreateOrderDto,
  ManualOrderLifecycleTransitionDto,
  UpdateOrderStatusDto,
} from './orders.dto.js';

@Controller('orders')
@ApiTags('orders')
export class OrdersController {
  constructor(
    @Inject(OrdersService)
    private readonly ordersService: OrdersService,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get order with guest snapshot, items, statuses, and history' })
  @ApiParam({ name: 'id', description: 'Order id', type: String })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiNotFoundResponse({ type: ApiNotFoundErrorBodyDto, description: 'Order not found' })
  getById(@Param('id') id: string) {
    return this.ordersService.getById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create guest checkout order and reserve stock',
    description:
      'ADR 0005 public contract: customer snapshot fields are required; customerId is optional for linked non-guest orders.',
  })
  @ApiBody({ type: CreateOrderDto })
  @ApiCreatedResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ type: ApiValidationErrorBodyDto, description: 'Invalid payload' })
  @ApiConflictResponse({ type: ApiBusinessConflictBodyDto, description: 'Out of stock or inactive product' })
  @ApiNotFoundResponse({
    type: ApiNotFoundErrorBodyDto,
    description: 'Customer, product, or inventory row not found',
  })
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel not-yet-shipped order and release reserved stock' })
  @ApiParam({ name: 'id', description: 'Order id', type: String })
  @ApiBody({ type: ManualOrderLifecycleTransitionDto, required: false })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ type: ApiValidationErrorBodyDto, description: 'Invalid payload' })
  @ApiConflictResponse({ type: ApiBusinessConflictBodyDto, description: 'Invalid transition or inventory invariant' })
  @ApiNotFoundResponse({ type: ApiNotFoundErrorBodyDto, description: 'Order or inventory not found' })
  cancel(@Param('id') id: string, @Body() dto: ManualOrderLifecycleTransitionDto = {}) {
    return this.ordersService.cancel(id, dto);
  }

  @Patch(':id/invoice-sent')
  @ApiOperation({ summary: 'Mark manual invoice as sent' })
  @ApiParam({ name: 'id', description: 'Order id', type: String })
  @ApiBody({ type: ManualOrderLifecycleTransitionDto, required: false })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ type: ApiValidationErrorBodyDto, description: 'Invalid payload' })
  @ApiConflictResponse({ type: ApiBusinessConflictBodyDto, description: 'Invalid lifecycle transition' })
  @ApiNotFoundResponse({ type: ApiNotFoundErrorBodyDto, description: 'Order not found' })
  markInvoiceSent(
    @Param('id') id: string,
    @Body() dto: ManualOrderLifecycleTransitionDto = {},
  ) {
    return this.ordersService.markInvoiceSent(id, dto);
  }

  @Patch(':id/payment-confirmed')
  @ApiOperation({ summary: 'Confirm manual payment' })
  @ApiParam({ name: 'id', description: 'Order id', type: String })
  @ApiBody({ type: ManualOrderLifecycleTransitionDto, required: false })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ type: ApiValidationErrorBodyDto, description: 'Invalid payload' })
  @ApiConflictResponse({ type: ApiBusinessConflictBodyDto, description: 'Invalid lifecycle transition' })
  @ApiNotFoundResponse({ type: ApiNotFoundErrorBodyDto, description: 'Order not found' })
  confirmPayment(
    @Param('id') id: string,
    @Body() dto: ManualOrderLifecycleTransitionDto = {},
  ) {
    return this.ordersService.confirmPayment(id, dto);
  }

  @Patch(':id/handoff-to-delivery')
  @ApiOperation({ summary: 'Hand order off to delivery and decrement onHand/reserved stock' })
  @ApiParam({ name: 'id', description: 'Order id', type: String })
  @ApiBody({ type: ManualOrderLifecycleTransitionDto, required: false })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ type: ApiValidationErrorBodyDto, description: 'Invalid payload' })
  @ApiConflictResponse({ type: ApiBusinessConflictBodyDto, description: 'Invalid transition or inventory invariant' })
  @ApiNotFoundResponse({ type: ApiNotFoundErrorBodyDto, description: 'Order or inventory not found' })
  handOffToDelivery(
    @Param('id') id: string,
    @Body() dto: ManualOrderLifecycleTransitionDto = {},
  ) {
    return this.ordersService.handOffToDelivery(id, dto);
  }

  @Patch(':id/delivered')
  @ApiOperation({ summary: 'Confirm customer receipt / delivery' })
  @ApiParam({ name: 'id', description: 'Order id', type: String })
  @ApiBody({ type: ManualOrderLifecycleTransitionDto, required: false })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ type: ApiValidationErrorBodyDto, description: 'Invalid payload' })
  @ApiConflictResponse({ type: ApiBusinessConflictBodyDto, description: 'Invalid lifecycle transition' })
  @ApiNotFoundResponse({ type: ApiNotFoundErrorBodyDto, description: 'Order not found' })
  confirmDelivered(
    @Param('id') id: string,
    @Body() dto: ManualOrderLifecycleTransitionDto = {},
  ) {
    return this.ordersService.confirmDelivered(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Legacy single-status transition endpoint' })
  @ApiParam({ name: 'id', description: 'Order id', type: String })
  @ApiBody({ type: UpdateOrderStatusDto })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ type: ApiValidationErrorBodyDto, description: 'Invalid payload' })
  @ApiConflictResponse({ type: ApiBusinessConflictBodyDto, description: 'Invalid transition or inventory invariant' })
  @ApiNotFoundResponse({ type: ApiNotFoundErrorBodyDto, description: 'Order or inventory not found' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.updateStatus(id, dto);
  }
}
