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
  @ApiOperation({ summary: 'Получить заказ: снимок гостя, позиции, статусы, история' })
  @ApiParam({ name: 'id', description: 'Идентификатор заказа', type: String })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiNotFoundResponse({ type: ApiNotFoundErrorBodyDto, description: 'Заказ не найден' })
  getById(@Param('id') id: string) {
    return this.ordersService.getById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Создать гостевой заказ и зарезервировать склад',
    description:
      'Публичный контракт ADR 0005: поля снимка покупателя обязательны; customerId — опционально для связанных негостевых заказов.',
  })
  @ApiBody({ type: CreateOrderDto })
  @ApiCreatedResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ type: ApiValidationErrorBodyDto, description: 'Некорректное тело запроса' })
  @ApiConflictResponse({
    type: ApiBusinessConflictBodyDto,
    description: 'Нет на складе или товар неактивен',
  })
  @ApiNotFoundResponse({
    type: ApiNotFoundErrorBodyDto,
    description: 'Покупатель, товар или строка склада не найдены',
  })
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Отменить ещё не отгруженный заказ и снять резерв' })
  @ApiParam({ name: 'id', description: 'Идентификатор заказа', type: String })
  @ApiBody({ type: ManualOrderLifecycleTransitionDto, required: false })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ type: ApiValidationErrorBodyDto, description: 'Некорректное тело запроса' })
  @ApiConflictResponse({
    type: ApiBusinessConflictBodyDto,
    description: 'Недопустимый переход или нарушение инварианта склада',
  })
  @ApiNotFoundResponse({ type: ApiNotFoundErrorBodyDto, description: 'Заказ или склад не найдены' })
  cancel(@Param('id') id: string, @Body() dto: ManualOrderLifecycleTransitionDto = {}) {
    return this.ordersService.cancel(id, dto);
  }

  @Patch(':id/invoice-sent')
  @ApiOperation({ summary: 'Отметить, что счёт вручную отправлен' })
  @ApiParam({ name: 'id', description: 'Идентификатор заказа', type: String })
  @ApiBody({ type: ManualOrderLifecycleTransitionDto, required: false })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ type: ApiValidationErrorBodyDto, description: 'Некорректное тело запроса' })
  @ApiConflictResponse({
    type: ApiBusinessConflictBodyDto,
    description: 'Недопустимый переход в жизненном цикле',
  })
  @ApiNotFoundResponse({ type: ApiNotFoundErrorBodyDto, description: 'Заказ не найден' })
  markInvoiceSent(
    @Param('id') id: string,
    @Body() dto: ManualOrderLifecycleTransitionDto = {},
  ) {
    return this.ordersService.markInvoiceSent(id, dto);
  }

  @Patch(':id/payment-confirmed')
  @ApiOperation({ summary: 'Подтвердить ручную оплату' })
  @ApiParam({ name: 'id', description: 'Идентификатор заказа', type: String })
  @ApiBody({ type: ManualOrderLifecycleTransitionDto, required: false })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ type: ApiValidationErrorBodyDto, description: 'Некорректное тело запроса' })
  @ApiConflictResponse({
    type: ApiBusinessConflictBodyDto,
    description: 'Недопустимый переход в жизненном цикле',
  })
  @ApiNotFoundResponse({ type: ApiNotFoundErrorBodyDto, description: 'Заказ не найден' })
  confirmPayment(
    @Param('id') id: string,
    @Body() dto: ManualOrderLifecycleTransitionDto = {},
  ) {
    return this.ordersService.confirmPayment(id, dto);
  }

  @Patch(':id/handoff-to-delivery')
  @ApiOperation({
    summary: 'Передать заказ в доставку, уменьшить onHand и reserved на складе',
  })
  @ApiParam({ name: 'id', description: 'Идентификатор заказа', type: String })
  @ApiBody({ type: ManualOrderLifecycleTransitionDto, required: false })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ type: ApiValidationErrorBodyDto, description: 'Некорректное тело запроса' })
  @ApiConflictResponse({
    type: ApiBusinessConflictBodyDto,
    description: 'Недопустимый переход или нарушение инварианта склада',
  })
  @ApiNotFoundResponse({ type: ApiNotFoundErrorBodyDto, description: 'Заказ или склад не найдены' })
  handOffToDelivery(
    @Param('id') id: string,
    @Body() dto: ManualOrderLifecycleTransitionDto = {},
  ) {
    return this.ordersService.handOffToDelivery(id, dto);
  }

  @Patch(':id/delivered')
  @ApiOperation({ summary: 'Подтвердить получение покупателем / доставку' })
  @ApiParam({ name: 'id', description: 'Идентификатор заказа', type: String })
  @ApiBody({ type: ManualOrderLifecycleTransitionDto, required: false })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ type: ApiValidationErrorBodyDto, description: 'Некорректное тело запроса' })
  @ApiConflictResponse({
    type: ApiBusinessConflictBodyDto,
    description: 'Недопустимый переход в жизненном цикле',
  })
  @ApiNotFoundResponse({ type: ApiNotFoundErrorBodyDto, description: 'Заказ не найден' })
  confirmDelivered(
    @Param('id') id: string,
    @Body() dto: ManualOrderLifecycleTransitionDto = {},
  ) {
    return this.ordersService.confirmDelivered(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Устаревший эндпоинт смены единого статуса' })
  @ApiParam({ name: 'id', description: 'Идентификатор заказа', type: String })
  @ApiBody({ type: UpdateOrderStatusDto })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ type: ApiValidationErrorBodyDto, description: 'Некорректное тело запроса' })
  @ApiConflictResponse({
    type: ApiBusinessConflictBodyDto,
    description: 'Недопустимый переход или нарушение инварианта склада',
  })
  @ApiNotFoundResponse({ type: ApiNotFoundErrorBodyDto, description: 'Заказ или склад не найдены' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.updateStatus(id, dto);
  }
}
