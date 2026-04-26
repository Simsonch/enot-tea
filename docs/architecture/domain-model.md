# Модель домена v1 (MVP)

## Целевой retail MVP (после Sprint 5+)

Описание гостевого checkout, раздельных `Order` / `Payment` / `Fulfillment` статусов и складских инвариантов при резерве и отгрузке: [Guest checkout and MVP lifecycle](guest-checkout-mvp-lifecycle.md), [ADR 0005: MVP guest checkout and order lifecycle](../adr/0005-mvp-guest-checkout-order-lifecycle.md).

Пока код и миграции не обновлены, каноничным для **текущей реализации API** остается одно-enum `OrderStatus` (см. [ADR 0003](../adr/0003-order-lifecycle-policy.md)).

## Основные сущности

- User
- Role
- UserRole
- Product
- InventoryItem
- StockMovement
- Order
- OrderItem
- OrderStatusHistory
- ChatSession
- ChatMessage

## Жизненный цикл статусов заказа

- `NEW` -> `CONFIRMED` -> `PACKED` -> `SHIPPED` -> `DELIVERED`
- Путь отмены: `NEW|CONFIRMED|PACKED` -> `CANCELLED`

## Правила склада

- При создании заказа: увеличиваем `reserved`.
- При отмене заказа: уменьшаем `reserved`.
- При отгрузке: уменьшаем `onHand` и уменьшаем `reserved`.

## Примечания

- Цены хранятся в минимальных единицах (`priceMinor`, `totalMinor`).
- Для аудита переходов используем `OrderStatusHistory`.
