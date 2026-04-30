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
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiUnauthorizedResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiAuthErrorBodyDto,
  ApiBusinessConflictBodyDto,
  ApiNotFoundErrorBodyDto,
  ApiValidationErrorBodyDto,
} from '../openapi/error-models.js';
import { CurrentOwner } from '../auth/current-owner.decorator.js';
import { OwnerAuthGuard } from '../auth/owner-auth.guard.js';
import type { AuthenticatedOwner } from '../auth/auth.types.js';
import { OrderResponseDto, OrdersListResponseDto } from '../openapi/response-models.js';
import { OrdersService } from './orders.service.js';
import {
  CreateOrderDto,
  GetOrdersQueryDto,
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

  @Get()
  @UseGuards(OwnerAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Owner-only список заказов с фильтрами и пагинацией' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['NEW', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'] })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'ISO 8601 createdAt lower bound' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'ISO 8601 createdAt upper bound' })
  @ApiOkResponse({ type: OrdersListResponseDto })
  @ApiBadRequestResponse({ type: ApiValidationErrorBodyDto, description: 'Некорректные query params' })
  @ApiUnauthorizedResponse({ type: ApiAuthErrorBodyDto, description: 'Не передан или недействителен Bearer token' })
  @ApiForbiddenResponse({ type: ApiAuthErrorBodyDto, description: 'Пользователь не является владельцем' })
  list(@Query() query: GetOrdersQueryDto) {
    return this.ordersService.list(query);
  }

  @Get(':id')
  @UseGuards(OwnerAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Получить заказ: снимок гостя, позиции, статусы, история' })
  @ApiParam({ name: 'id', description: 'Идентификатор заказа', type: String })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiUnauthorizedResponse({ type: ApiAuthErrorBodyDto, description: 'Не передан или недействителен Bearer token' })
  @ApiForbiddenResponse({ type: ApiAuthErrorBodyDto, description: 'Пользователь не является владельцем' })
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
  @UseGuards(OwnerAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Отменить ещё не отгруженный заказ и снять резерв' })
  @ApiParam({ name: 'id', description: 'Идентификатор заказа', type: String })
  @ApiBody({ type: ManualOrderLifecycleTransitionDto, required: false })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ type: ApiValidationErrorBodyDto, description: 'Некорректное тело запроса' })
  @ApiUnauthorizedResponse({ type: ApiAuthErrorBodyDto, description: 'Не передан или недействителен Bearer token' })
  @ApiForbiddenResponse({ type: ApiAuthErrorBodyDto, description: 'Пользователь не является владельцем' })
  @ApiConflictResponse({
    type: ApiBusinessConflictBodyDto,
    description: 'Недопустимый переход или нарушение инварианта склада',
  })
  @ApiNotFoundResponse({ type: ApiNotFoundErrorBodyDto, description: 'Заказ или склад не найдены' })
  cancel(
    @Param('id') id: string,
    @Body() dto: ManualOrderLifecycleTransitionDto = {},
    @CurrentOwner() owner: AuthenticatedOwner,
  ) {
    return this.ordersService.cancel(id, dto, owner.id);
  }

  @Patch(':id/invoice-sent')
  @UseGuards(OwnerAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Отметить, что счёт вручную отправлен' })
  @ApiParam({ name: 'id', description: 'Идентификатор заказа', type: String })
  @ApiBody({ type: ManualOrderLifecycleTransitionDto, required: false })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ type: ApiValidationErrorBodyDto, description: 'Некорректное тело запроса' })
  @ApiUnauthorizedResponse({ type: ApiAuthErrorBodyDto, description: 'Не передан или недействителен Bearer token' })
  @ApiForbiddenResponse({ type: ApiAuthErrorBodyDto, description: 'Пользователь не является владельцем' })
  @ApiConflictResponse({
    type: ApiBusinessConflictBodyDto,
    description: 'Недопустимый переход в жизненном цикле',
  })
  @ApiNotFoundResponse({ type: ApiNotFoundErrorBodyDto, description: 'Заказ не найден' })
  markInvoiceSent(
    @Param('id') id: string,
    @Body() dto: ManualOrderLifecycleTransitionDto = {},
    @CurrentOwner() owner: AuthenticatedOwner,
  ) {
    return this.ordersService.markInvoiceSent(id, dto, owner.id);
  }

  @Patch(':id/payment-confirmed')
  @UseGuards(OwnerAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Подтвердить ручную оплату' })
  @ApiParam({ name: 'id', description: 'Идентификатор заказа', type: String })
  @ApiBody({ type: ManualOrderLifecycleTransitionDto, required: false })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ type: ApiValidationErrorBodyDto, description: 'Некорректное тело запроса' })
  @ApiUnauthorizedResponse({ type: ApiAuthErrorBodyDto, description: 'Не передан или недействителен Bearer token' })
  @ApiForbiddenResponse({ type: ApiAuthErrorBodyDto, description: 'Пользователь не является владельцем' })
  @ApiConflictResponse({
    type: ApiBusinessConflictBodyDto,
    description: 'Недопустимый переход в жизненном цикле',
  })
  @ApiNotFoundResponse({ type: ApiNotFoundErrorBodyDto, description: 'Заказ не найден' })
  confirmPayment(
    @Param('id') id: string,
    @Body() dto: ManualOrderLifecycleTransitionDto = {},
    @CurrentOwner() owner: AuthenticatedOwner,
  ) {
    return this.ordersService.confirmPayment(id, dto, owner.id);
  }

  @Patch(':id/handoff-to-delivery')
  @UseGuards(OwnerAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Передать заказ в доставку, уменьшить onHand и reserved на складе',
  })
  @ApiParam({ name: 'id', description: 'Идентификатор заказа', type: String })
  @ApiBody({ type: ManualOrderLifecycleTransitionDto, required: false })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ type: ApiValidationErrorBodyDto, description: 'Некорректное тело запроса' })
  @ApiUnauthorizedResponse({ type: ApiAuthErrorBodyDto, description: 'Не передан или недействителен Bearer token' })
  @ApiForbiddenResponse({ type: ApiAuthErrorBodyDto, description: 'Пользователь не является владельцем' })
  @ApiConflictResponse({
    type: ApiBusinessConflictBodyDto,
    description: 'Недопустимый переход или нарушение инварианта склада',
  })
  @ApiNotFoundResponse({ type: ApiNotFoundErrorBodyDto, description: 'Заказ или склад не найдены' })
  handOffToDelivery(
    @Param('id') id: string,
    @Body() dto: ManualOrderLifecycleTransitionDto = {},
    @CurrentOwner() owner: AuthenticatedOwner,
  ) {
    return this.ordersService.handOffToDelivery(id, dto, owner.id);
  }

  @Patch(':id/delivered')
  @UseGuards(OwnerAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Подтвердить получение покупателем / доставку' })
  @ApiParam({ name: 'id', description: 'Идентификатор заказа', type: String })
  @ApiBody({ type: ManualOrderLifecycleTransitionDto, required: false })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ type: ApiValidationErrorBodyDto, description: 'Некорректное тело запроса' })
  @ApiUnauthorizedResponse({ type: ApiAuthErrorBodyDto, description: 'Не передан или недействителен Bearer token' })
  @ApiForbiddenResponse({ type: ApiAuthErrorBodyDto, description: 'Пользователь не является владельцем' })
  @ApiConflictResponse({
    type: ApiBusinessConflictBodyDto,
    description: 'Недопустимый переход в жизненном цикле',
  })
  @ApiNotFoundResponse({ type: ApiNotFoundErrorBodyDto, description: 'Заказ не найден' })
  confirmDelivered(
    @Param('id') id: string,
    @Body() dto: ManualOrderLifecycleTransitionDto = {},
    @CurrentOwner() owner: AuthenticatedOwner,
  ) {
    return this.ordersService.confirmDelivered(id, dto, owner.id);
  }

  @Post(':id/notifications/resend')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OwnerAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Повторно отправить актуальное email-уведомление по заказу' })
  @ApiParam({ name: 'id', description: 'Идентификатор заказа', type: String })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiUnauthorizedResponse({ type: ApiAuthErrorBodyDto, description: 'Не передан или недействителен Bearer token' })
  @ApiForbiddenResponse({ type: ApiAuthErrorBodyDto, description: 'Пользователь не является владельцем' })
  @ApiNotFoundResponse({ type: ApiNotFoundErrorBodyDto, description: 'Заказ не найден' })
  resendNotification(@Param('id') id: string) {
    return this.ordersService.resendNotification(id);
  }

  @Patch(':id/status')
  @UseGuards(OwnerAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Устаревший эндпоинт смены единого статуса' })
  @ApiParam({ name: 'id', description: 'Идентификатор заказа', type: String })
  @ApiBody({ type: UpdateOrderStatusDto })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ type: ApiValidationErrorBodyDto, description: 'Некорректное тело запроса' })
  @ApiUnauthorizedResponse({ type: ApiAuthErrorBodyDto, description: 'Не передан или недействителен Bearer token' })
  @ApiForbiddenResponse({ type: ApiAuthErrorBodyDto, description: 'Пользователь не является владельцем' })
  @ApiConflictResponse({
    type: ApiBusinessConflictBodyDto,
    description: 'Недопустимый переход или нарушение инварианта склада',
  })
  @ApiNotFoundResponse({ type: ApiNotFoundErrorBodyDto, description: 'Заказ или склад не найдены' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentOwner() owner: AuthenticatedOwner,
  ) {
    return this.ordersService.updateStatus(id, dto, owner.id);
  }
}
