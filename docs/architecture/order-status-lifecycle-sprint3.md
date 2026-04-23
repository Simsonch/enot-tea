# Спецификация Sprint 3: lifecycle заказа

## Цель
Зафиксировать фактические правила переходов статусов заказа и поведение склада в реализации Sprint 3.

## Разрешенные переходы

- `NEW -> CONFIRMED`
- `NEW -> CANCELLED`
- `CONFIRMED -> PACKED`
- `CONFIRMED -> CANCELLED`
- `PACKED -> SHIPPED`
- `PACKED -> CANCELLED`
- `SHIPPED -> DELIVERED`

Все остальные переходы считаются недопустимыми.

## Контракт ошибок смены статуса

- `400` + `VALIDATION_ERROR`: неверный payload (например, отсутствует `toStatus`).
- `404`: заказ не найден.
- `409` + `INVALID_ORDER_STATUS_TRANSITION`: запрошен недопустимый переход `fromStatus -> toStatus`.
- `409` + `INVENTORY_INVARIANT_VIOLATION`: переход нарушает инварианты склада.

## Инварианты склада

### На переходе в `SHIPPED`
- Для каждой позиции заказа:
  - `onHand = onHand - quantity`
  - `reserved = reserved - quantity`
- Изменения выполняются в одной транзакции вместе со сменой статуса.
- Перед обновлением проверяется, что `onHand >= quantity` и `reserved >= quantity`.

### На переходе в `CANCELLED`
- Для каждой позиции заказа:
  - `reserved = reserved - quantity`
- `onHand` не изменяется.

## Аудит переходов

Для каждого успешного перехода должна создаваться запись в `OrderStatusHistory`:
- `fromStatus`
- `toStatus`
- `comment` (если передан или вычислен системой)
- `createdAt` (автоматически БД)

## API-контракт Sprint 3

`PATCH /orders/:id/status`

Request body:
- `toStatus`: целевой статус заказа (`CONFIRMED | PACKED | SHIPPED | DELIVERED`).
- `comment?`: опциональный комментарий к переходу.

Ограничения:
- `toStatus = CANCELLED|NEW` недопустимы для этого endpoint и возвращают `400` с `VALIDATION_ERROR`.
- Для отмены используется отдельный endpoint `PATCH /orders/:id/cancel`.

Response:
- `200`: обновленный заказ с `items` и `statusHistory`.

Совместимость:
- `PATCH /orders/:id/cancel` сохраняется для обратной совместимости и использует те же правила переходов.
