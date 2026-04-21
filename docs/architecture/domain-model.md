# Модель домена v1 (MVP)

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
