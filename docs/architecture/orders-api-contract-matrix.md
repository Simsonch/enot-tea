# Orders API Contract Matrix

## Goal
Зафиксировать единый контракт по `orders` endpoint-ам: успешные ответы, коды ошибок, бизнес-ограничения и side effects.

## Scope
- API модуля `apps/api` для `orders`.
- Контракты синхронизированы с реализацией `OrdersService` и текущими HTTP/service тестами.
- Матрица является опорной для backward-compatible изменений.

## Domain Rules (Canonical)
- Жизненный цикл статусов:
  - `NEW -> CONFIRMED | CANCELLED`
  - `CONFIRMED -> PACKED | CANCELLED`
  - `PACKED -> SHIPPED | CANCELLED`
  - `SHIPPED -> DELIVERED`
- `PATCH /orders/:id/status` принимает только `CONFIRMED | PACKED | SHIPPED | DELIVERED`.
- Отмена выполняется через `PATCH /orders/:id/cancel` (endpoint сохранен для backward compatibility).
- Все успешные переходы статусов обязаны писать запись в `OrderStatusHistory`.

## Endpoints

### `POST /orders`
- Success:
  - `201 Created` + созданный заказ с `items` и финальным `totalMinor`.
- Error contracts:
  - `400` + `VALIDATION_ERROR` — невалидный payload.
  - `404` — `customer`/`product`/`inventory` не найден.
  - `409` + `INSUFFICIENT_STOCK` — недостаточно доступного остатка.
- Side effects:
  - увеличение `reserved` по позициям заказа (в транзакции).
  - статус нового заказа: `NEW`.

### `GET /orders/:id`
- Success:
  - `200 OK` + заказ с `items` и `statusHistory`.
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
  - запись в `OrderStatusHistory` (`fromStatus`, `toStatus`, `comment`).

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
  - для каждого успешного перехода создается запись в `OrderStatusHistory`.

## Error Contract Shape
- Для validation и business errors используется стабильная JSON-структура:
  - `statusCode`
  - `code`
  - `message`
  - `errors[]` или `details` (по необходимости)
- Ключевые коды для `orders`:
  - `VALIDATION_ERROR`
  - `INSUFFICIENT_STOCK`
  - `INVALID_ORDER_STATUS_TRANSITION`
  - `INVENTORY_INVARIANT_VIOLATION`

## Compatibility Notes
- `PATCH /orders/:id/cancel` сохраняется для backward compatibility.
- `PATCH /orders/:id/status` не принимает `CANCELLED` и `NEW`; отмена выполняется только через `cancel` endpoint.
- Изменения в этой матрице допускаются только backward-compatible способом.

## References
- `docs/adr/0003-order-lifecycle-policy.md`
- `docs/adr/0004-api-error-contract-standard.md`
- `apps/api/src/orders/orders.service.ts`
- `apps/api/src/orders/orders.controller.http.test.ts`
- `apps/api/src/orders/orders.service.test.ts`
