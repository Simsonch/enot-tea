# Модель домена v1 (MVP)

## Целевой retail MVP (после Sprint 5+)

Описание гостевого checkout, раздельных `Order` / `Payment` / `Fulfillment` статусов и складских инвариантов при резерве и отгрузке: [Guest checkout and MVP lifecycle](guest-checkout-mvp-lifecycle.md), [ADR 0005: MVP guest checkout and order lifecycle](../adr/0005-mvp-guest-checkout-order-lifecycle.md).

До Sprint 5 каноничным для **текущей реализации API** остается legacy single `OrderStatus` (см. [ADR 0003](../adr/0003-order-lifecycle-policy.md)). Target MVP после Sprint 5 — guest checkout со snapshot покупателя и отдельными статусами обработки заказа, оплаты и fulfillment (см. [ADR 0005](../adr/0005-mvp-guest-checkout-order-lifecycle.md)).

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

- При создании заказа: проверка `available = onHand - reserved` и увеличение `reserved` выполняются атомарно на каждую позицию заказа; успешный резерв пишет `StockMovement` с `deltaReserved > 0`.
- При отмене заказа: уменьшаем `reserved` и пишем `StockMovement` с `deltaReserved < 0`.
- При отгрузке (`SHIPPED`): уменьшаем `onHand` и `reserved` в одной транзакции и пишем `StockMovement` с отрицательными `deltaOnHand`/`deltaReserved`.
- `onHand` списывается не при создании заказа, а при отгрузке из статуса `PACKED -> SHIPPED`.
- `Product.isActive = false` не может быть оформлен в заказ; API возвращает бизнес-конфликт.

## Примечания

- Цены хранятся в минимальных единицах (`priceMinor`, `totalMinor`).
- Для аудита переходов используем `OrderStatusHistory`; первая запись `NEW` создается при `POST /orders`.
- `changedById` остается `null` до появления auth владельца/оператора; код не подставляет технического пользователя.
- `StockMovement` связан с `InventoryItem` и, для order flow, с `Order`/`OrderItem`.
