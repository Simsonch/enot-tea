# Orders API Contract Matrix

## Goal
Зафиксировать единый контракт по `orders` endpoint-ам: успешные ответы, коды ошибок, бизнес-ограничения и side effects.

## Scope
- API модуля `apps/api` для `orders`.
- Контракты синхронизированы с реализацией `OrdersService` и текущими HTTP/service тестами.
- Матрица отражает Sprint 5 / S5-001 baseline из [ADR 0005](../adr/0005-mvp-guest-checkout-order-lifecycle.md): guest checkout snapshot, nullable `customerId`, отдельные `paymentStatus` и `fulfillmentStatus`.

## Domain Rules (Canonical)
- Жизненный цикл статусов:
  - `NEW -> CONFIRMED | CANCELLED`
  - `CONFIRMED -> PACKED | CANCELLED`
  - `PACKED -> SHIPPED | CANCELLED`
  - `SHIPPED -> DELIVERED`
- `PATCH /orders/:id/status` принимает только `CONFIRMED | PACKED | SHIPPED | DELIVERED`.
- Отмена выполняется через `PATCH /orders/:id/cancel` (endpoint сохранен для backward compatibility).
- Все успешные переходы статусов обязаны писать запись в `OrderStatusHistory`.
- `OrderStatusHistory` хранит историю трех измерений через `statusDimension = ORDER | PAYMENT | FULFILLMENT`; в S5-001 реализована схема, а payment/fulfillment endpoint-ы добавляются следующими задачами Sprint 5.
- `changedById` в `OrderStatusHistory` остается `null`, пока в API нет auth владельца/оператора.
- `Product.isActive = false` нельзя оформить в заказ.
- Списание `onHand` происходит при переходе `PACKED -> SHIPPED`; создание заказа только резервирует `reserved`.
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
  - `200 OK` + заказ в статусе `CANCELLED`.
- Error contracts:
  - `404` — заказ не найден.
  - `409` + `INVALID_ORDER_STATUS_TRANSITION` — отмена из недопустимого статуса.
  - `409` + `INVENTORY_INVARIANT_VIOLATION` — неконсистентный `reserved` при снятии резерва.
- Side effects:
  - `reserved = reserved - quantity` для каждой позиции.
  - запись `StockMovement` с `reason = ORDER_CANCEL_RELEASE`, `deltaReserved = -quantity`, в той же транзакции.
  - запись в `OrderStatusHistory` (`fromStatus`, `toStatus`, `comment`, `changedById = null`).

### `PATCH /orders/:id/status`
- Allowed `toStatus`:
  - `CONFIRMED`, `PACKED`, `SHIPPED`, `DELIVERED`.
- Success:
  - `200 OK` + обновленный заказ с `items` и `statusHistory`.
- Error contracts:
  - `400` + `VALIDATION_ERROR` — отсутствует/некорректный `toStatus`.
  - `404` — заказ не найден.
  - `409` + `INVALID_ORDER_STATUS_TRANSITION` — переход запрещен матрицей статусов.
  - `409` + `INVENTORY_INVARIANT_VIOLATION` — нарушение инвариантов при `SHIPPED`.
- Side effects:
  - при `SHIPPED`: `onHand = onHand - quantity`, `reserved = reserved - quantity`.
  - при `SHIPPED`: запись `StockMovement` с `reason = ORDER_SHIP`, отрицательными `deltaOnHand`/`deltaReserved`, в той же транзакции.
  - для каждого успешного перехода создается запись в `OrderStatusHistory` (`changedById = null` до auth владельца).

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

## Compatibility Notes
- `PATCH /orders/:id/cancel` сохраняется для backward compatibility.
- `PATCH /orders/:id/status` не принимает `CANCELLED` и `NEW`; отмена выполняется только через `cancel` endpoint.
- `POST /orders` изменен по ADR 0005: вместо обязательного `customerId` публичный контракт требует snapshot покупателя/доставки и допускает guest checkout без аккаунта.

## References
- `docs/adr/0003-order-lifecycle-policy.md`
- `docs/adr/0005-mvp-guest-checkout-order-lifecycle.md`
- `docs/adr/0004-api-error-contract-standard.md`
- `apps/api/src/orders/orders.service.ts`
- `apps/api/src/orders/orders.controller.http.test.ts`
- `apps/api/src/orders/orders.service.test.ts`
