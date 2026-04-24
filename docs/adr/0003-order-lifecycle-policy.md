# ADR 0003: Order Lifecycle Policy

## Status
Accepted

## Context
В Sprint 3 реализован расширенный lifecycle заказа (`NEW -> CONFIRMED -> PACKED -> SHIPPED -> DELIVERED`, отмена через `CANCELLED`) с инвариантами склада и аудитом переходов. До Sprint 4 правила были зафиксированы в feature-doc, но не в ADR-слое.

## Decision
- Каноничная матрица переходов:
  - `NEW -> CONFIRMED|CANCELLED`
  - `CONFIRMED -> PACKED|CANCELLED`
  - `PACKED -> SHIPPED|CANCELLED`
  - `SHIPPED -> DELIVERED`
- `PATCH /orders/:id/status` принимает только `CONFIRMED|PACKED|SHIPPED|DELIVERED`.
- Для отмены используется отдельный `PATCH /orders/:id/cancel` (backward compatibility сохраняется).
- Для каждого успешного перехода обязательна запись в `OrderStatusHistory`.
- На переходе в `SHIPPED` обязательно списывать `onHand` и `reserved` в одной транзакции.

## Consequences
- Плюсы:
  - предсказуемое и проверяемое поведение order pipeline;
  - прозрачная аудируемость переходов;
  - сниженный риск рассинхронизации inventory.
- Ограничения:
  - добавление новых статусов требует обновления матрицы, тестов и контракта docs.

## References
- `docs/architecture/order-status-lifecycle-sprint3.md`
- `docs/architecture/orders-api-contract-matrix.md`
- `apps/api/src/orders/orders.service.ts`
