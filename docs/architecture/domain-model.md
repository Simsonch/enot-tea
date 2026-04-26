# Модель домена v1 (MVP)

## Retail MVP (Sprint 5+)

Описание гостевого checkout, раздельных `Order` / `Payment` / `Fulfillment` статусов и складских инвариантов при резерве и отгрузке: [Guest checkout and MVP lifecycle](guest-checkout-mvp-lifecycle.md), [ADR 0005: MVP guest checkout and order lifecycle](../adr/0005-mvp-guest-checkout-order-lifecycle.md).

Начиная со Sprint 5, публичный order flow следует [ADR 0005](../adr/0005-mvp-guest-checkout-order-lifecycle.md): guest checkout со snapshot покупателя и отдельными статусами обработки заказа, оплаты и fulfillment. Legacy single `OrderStatus` endpoint остается только для ограниченной совместимости и не является основным контрактом нового MVP flow.

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
- Ручной MVP flow использует три измерения:
  - `Order.status`: `NEW -> CONFIRMED -> PACKED -> SHIPPED -> DELIVERED`, либо `CANCELLED` до отгрузки.
  - `PaymentStatus`: `PENDING -> INVOICE_SENT -> PAID`.
  - `FulfillmentStatus`: `RESERVED -> HANDED_TO_CARRIER -> DELIVERED`.

## Правила склада

- При создании заказа: проверка `available = onHand - reserved` и увеличение `reserved` выполняются атомарно на каждую позицию заказа; успешный резерв пишет `StockMovement` с `deltaReserved > 0`.
- При отмене заказа: уменьшаем `reserved` и пишем `StockMovement` с `deltaReserved < 0`.
- При передаче в доставку / отгрузке (`PATCH /orders/:id/handoff-to-delivery`, состояние `PACKED / PAID / RESERVED -> SHIPPED / PAID / HANDED_TO_CARRIER`): уменьшаем `onHand` и `reserved` в одной транзакции и пишем `StockMovement` с отрицательными `deltaOnHand`/`deltaReserved`.
- `onHand` списывается не при создании заказа и не при подтверждении доставки, а в точке handoff-to-delivery.
- `Product.isActive = false` не может быть оформлен в заказ; API возвращает бизнес-конфликт.

## Примечания

- Цены хранятся в минимальных единицах (`priceMinor`, `totalMinor`).
- Для аудита переходов используем `OrderStatusHistory`; первая запись `NEW` создается при `POST /orders`.
- `changedById` остается `null` до появления auth владельца/оператора; код не подставляет технического пользователя.
- `StockMovement` связан с `InventoryItem` и, для order flow, с `Order`/`OrderItem`.
