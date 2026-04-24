# Orders API Contract Matrix

## Goal
Зафиксировать единый контракт по `orders` endpoint-ам: успешные ответы, ошибки и side effects.

## Endpoints

### `POST /orders`
- Success:
  - `201 Created` + созданный заказ с `items`.
- Error contracts:
  - `400` + `VALIDATION_ERROR` — невалидный payload.
  - `404` — customer/product/inventory не найден.
  - `409` + `INSUFFICIENT_STOCK` — недостаточно доступного остатка.
- Side effects:
  - увеличение `reserved` по позициям заказа (в транзакции).

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

## Compatibility Notes
- `PATCH /orders/:id/cancel` сохраняется для backward compatibility.
- `PATCH /orders/:id/status` не принимает `CANCELLED` и `NEW`; отмена выполняется только через `cancel` endpoint.
