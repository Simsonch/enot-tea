# Orders API Contract Matrix

## Goal
Зафиксировать единый контракт по `orders` endpoint-ам: успешные ответы, коды ошибок, бизнес-ограничения и side effects.

## Scope
- API модуля `apps/api` для `orders`.
- Контракты синхронизированы с реализацией `OrdersService` и текущими HTTP/service тестами.
- Матрица отражает Sprint 5 / S5-006 release gate из [ADR 0005](../adr/0005-mvp-guest-checkout-order-lifecycle.md): guest checkout snapshot, nullable `customerId`, отдельные `paymentStatus` и `fulfillmentStatus`.
- ADR 0005 меняет публичный контракт `POST /orders`; это не backward-compatible-only изменение.

## Domain Rules (Canonical)
- Ручной MVP lifecycle валидируется как матрица трех статусов:
  - `NEW / PENDING / RESERVED -> CONFIRMED / INVOICE_SENT / RESERVED` (`PATCH /orders/:id/invoice-sent`)
  - `CONFIRMED / INVOICE_SENT / RESERVED -> PACKED / PAID / RESERVED` (`PATCH /orders/:id/payment-confirmed`)
  - `PACKED / PAID / RESERVED -> SHIPPED / PAID / HANDED_TO_CARRIER` (`PATCH /orders/:id/handoff-to-delivery`)
  - `SHIPPED / PAID / HANDED_TO_CARRIER -> DELIVERED / PAID / DELIVERED` (`PATCH /orders/:id/delivered`)
  - `NEW|CONFIRMED|PACKED` до отгрузки (`fulfillmentStatus = RESERVED`, текущий `paymentStatus` сохраняется) -> `CANCELLED` (`PATCH /orders/:id/cancel`)
- `PATCH /orders/:id/status` остается legacy single-status endpoint-ом и принимает только `CONFIRMED | PACKED | SHIPPED | DELIVERED`.
- Legacy `PATCH /orders/:id/status` меняет только `Order.status`; `paymentStatus` и `fulfillmentStatus` остаются текущими значениями заказа.
- Отмена выполняется через `PATCH /orders/:id/cancel`.
- Все успешные значимые переходы обязаны писать запись в `OrderStatusHistory`.
- `OrderStatusHistory` хранит историю трех измерений через `statusDimension = ORDER | PAYMENT | FULFILLMENT`.
- `changedById` в `OrderStatusHistory` остается `null`, пока в API нет auth владельца/оператора.
- `Product.isActive = false` нельзя оформить в заказ.
- Каноничное списание `onHand` и `reserved` происходит на `PATCH /orders/:id/handoff-to-delivery`; создание заказа только резервирует `reserved`.
- Новый заказ получает defaults: `status = NEW`, `paymentStatus = PENDING`, `fulfillmentStatus = RESERVED`.

## Endpoints

### `POST /orders`
- Request:
  - обязательные snapshot-поля: `customerFullName`, `customerEmail`, `shippingAddress`.
  - опциональные поля: `customerPhone`, `customerId`.
  - `customerId` используется только для привязки к существующему `User`; guest checkout работает без него.
- Success:
  - `201 Created` + созданный заказ с snapshot-полями, `items`, финальным `totalMinor`, `status`, `paymentStatus`, `fulfillmentStatus`.
- Error contracts:
  - `400` + `VALIDATION_ERROR` — невалидный payload.
  - `404` — `customer` не найден, если передан `customerId`; `product`/`inventory` не найден.
  - `409` + `INSUFFICIENT_STOCK` — недостаточно доступного остатка.
  - `409` + `PRODUCT_INACTIVE` — товар найден, но `Product.isActive = false`.
- Side effects:
  - атомарное условное увеличение `reserved` по позициям заказа: проверка доступного остатка и инкремент выполняются одним `UPDATE ... WHERE onHand - reserved >= quantity` на позицию.
  - запись `StockMovement` с `reason = ORDER_RESERVE`, `deltaReserved = quantity`, связанная с `Order`/`OrderItem`.
  - начальная запись в `OrderStatusHistory` (`statusDimension = ORDER`, `fromStatus = null`, `toStatus = NEW`, `changedById = null`).
  - статусы нового заказа: `status = NEW`, `paymentStatus = PENDING`, `fulfillmentStatus = RESERVED`.

### `GET /orders/:id`
- Success:
  - `200 OK` + заказ со snapshot-полями, `items`, `status`, `paymentStatus`, `fulfillmentStatus` и `statusHistory`.
- Error contracts:
  - `404` — заказ не найден.
- Side effects:
  - нет.

### `PATCH /orders/:id/cancel`
- Success:
  - `200 OK` + заказ в статусе `CANCELLED`; текущий `paymentStatus` сохраняется, `fulfillmentStatus` остается `RESERVED` для допустимого pre-shipment cancellation.
- Error contracts:
  - `400` + `VALIDATION_ERROR` — невалидный optional payload (`comment`).
  - `404` — заказ не найден.
  - `409` + `INVALID_ORDER_STATUS_TRANSITION` — отмена из недопустимого статуса.
  - `409` + `INVENTORY_INVARIANT_VIOLATION` — неконсистентный `reserved` при снятии резерва.
- Side effects:
  - если заказ еще не отгружен (`fulfillmentStatus = RESERVED`): `reserved = reserved - quantity` для каждой позиции.
  - если заказ еще не отгружен: запись `StockMovement` с `reason = ORDER_CANCEL_RELEASE`, `deltaReserved = -quantity`, в той же транзакции.
  - запись в `OrderStatusHistory` (`fromStatus`, `toStatus`, `comment`, `changedById = null`).

### `PATCH /orders/:id/invoice-sent`
- Success:
  - `200 OK` + заказ со статусами `status = CONFIRMED`, `paymentStatus = INVOICE_SENT`, `fulfillmentStatus = RESERVED`.
- Error contracts:
  - `400` + `VALIDATION_ERROR` — невалидный optional payload (`comment`).
  - `404` — заказ не найден.
  - `409` + `INVALID_ORDER_STATUS_TRANSITION` — текущая комбинация не `NEW / PENDING / RESERVED`.
- Side effects:
  - записи в `OrderStatusHistory` для `ORDER` и `PAYMENT`.

### `PATCH /orders/:id/payment-confirmed`
- Success:
  - `200 OK` + заказ со статусами `status = PACKED`, `paymentStatus = PAID`, `fulfillmentStatus = RESERVED`.
- Error contracts:
  - `400` + `VALIDATION_ERROR` — невалидный optional payload (`comment`).
  - `404` — заказ не найден.
  - `409` + `INVALID_ORDER_STATUS_TRANSITION` — текущая комбинация не `CONFIRMED / INVOICE_SENT / RESERVED`.
- Side effects:
  - записи в `OrderStatusHistory` для `ORDER` и `PAYMENT`.

### `PATCH /orders/:id/handoff-to-delivery`
- Success:
  - `200 OK` + заказ со статусами `status = SHIPPED`, `paymentStatus = PAID`, `fulfillmentStatus = HANDED_TO_CARRIER`.
- Error contracts:
  - `400` + `VALIDATION_ERROR` — невалидный optional payload (`comment`).
  - `404` — заказ или inventory row не найден.
  - `409` + `INVALID_ORDER_STATUS_TRANSITION` — текущая комбинация не `PACKED / PAID / RESERVED`.
  - `409` + `INVENTORY_INVARIANT_VIOLATION` — нарушение инвариантов склада.
- Side effects:
  - `onHand = onHand - quantity`, `reserved = reserved - quantity`.
  - запись `StockMovement` с `reason = ORDER_SHIP`, отрицательными `deltaOnHand`/`deltaReserved`, в той же транзакции.
  - записи в `OrderStatusHistory` для `ORDER` и `FULFILLMENT`.

### `PATCH /orders/:id/delivered`
- Success:
  - `200 OK` + заказ со статусами `status = DELIVERED`, `paymentStatus = PAID`, `fulfillmentStatus = DELIVERED`.
- Error contracts:
  - `400` + `VALIDATION_ERROR` — невалидный optional payload (`comment`).
  - `404` — заказ не найден.
  - `409` + `INVALID_ORDER_STATUS_TRANSITION` — текущая комбинация не `SHIPPED / PAID / HANDED_TO_CARRIER`.
- Side effects:
  - записи в `OrderStatusHistory` для `ORDER` и `FULFILLMENT`.

### `PATCH /orders/:id/status`
- Allowed `toStatus`:
  - `CONFIRMED`, `PACKED`, `SHIPPED`, `DELIVERED`.
- Success:
  - `200 OK` + обновленный заказ с `items`, `paymentStatus`, `fulfillmentStatus` и `statusHistory`.
- Error contracts:
  - `400` + `VALIDATION_ERROR` — отсутствует/некорректный `toStatus`.
  - `404` — заказ не найден.
  - `409` + `INVALID_ORDER_STATUS_TRANSITION` — переход запрещен матрицей статусов.
  - `409` + `INVENTORY_INVARIANT_VIOLATION` — нарушение инвариантов при `SHIPPED`.
- Side effects:
  - legacy behavior: при `SHIPPED`: `onHand = onHand - quantity`, `reserved = reserved - quantity`.
  - при `SHIPPED`: запись `StockMovement` с `reason = ORDER_SHIP`, отрицательными `deltaOnHand`/`deltaReserved`, в той же транзакции.
  - для каждого успешного перехода создается запись в `OrderStatusHistory` с `statusDimension = ORDER` (`changedById = null` до auth владельца).

## Error Contract Shape
- Для validation и business errors используется стабильная JSON-структура:
  - `statusCode`
  - `code`
  - `message`
  - `errors[]` или `details` (по необходимости)
- Ключевые коды для `orders`:
  - `VALIDATION_ERROR`
  - `INSUFFICIENT_STOCK`
  - `PRODUCT_INACTIVE`
  - `INVALID_ORDER_STATUS_TRANSITION`
  - `INVENTORY_INVARIANT_VIOLATION`
- `404` сейчас использует стандартную NestJS not-found форму: `statusCode`, `message`, `error`.

## ADR 0005 Contract Notes
- `POST /orders` изменен по ADR 0005: вместо обязательного `customerId` публичный контракт требует snapshot покупателя/доставки и допускает guest checkout без аккаунта.
- `PATCH /orders/:id/cancel` является каноничным endpoint-ом отмены для Sprint 5 order flow.
- `PATCH /orders/:id/status` оставлен только как legacy single-status endpoint; он не принимает `CANCELLED` и `NEW`, а отмена выполняется через `cancel` endpoint.

## References
- `docs/adr/0003-order-lifecycle-policy.md`
- `docs/adr/0005-mvp-guest-checkout-order-lifecycle.md`
- `docs/adr/0004-api-error-contract-standard.md`
- `apps/api/src/orders/orders.service.ts`
- `apps/api/src/orders/orders.controller.http.test.ts`
- `apps/api/src/orders/orders.service.test.ts`
