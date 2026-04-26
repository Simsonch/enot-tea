# ADR 0003: Order Lifecycle Policy

## Status
Accepted

## Context
В Sprint 3 реализован расширенный lifecycle заказа (`NEW -> CONFIRMED -> PACKED -> SHIPPED -> DELIVERED`, отмена через `CANCELLED`) с инвариантами склада и аудитом переходов. До Sprint 4 правила были зафиксированы в feature-doc, но не в ADR-слое. После принятия [ADR 0005](0005-mvp-guest-checkout-order-lifecycle.md) этот ADR описывает **legacy single-status реализацию до Sprint 5**.

## Decision
- Каноничная матрица переходов:
  - `NEW -> CONFIRMED|CANCELLED`
  - `CONFIRMED -> PACKED|CANCELLED`
  - `PACKED -> SHIPPED|CANCELLED`
  - `SHIPPED -> DELIVERED`
- `PATCH /orders/:id/status` принимает только `CONFIRMED|PACKED|SHIPPED|DELIVERED`.
- Для отмены используется отдельный `PATCH /orders/:id/cancel` (backward compatibility сохраняется).
- Для каждого успешного перехода обязательна запись в `OrderStatusHistory`; начальная запись `NEW` создается при `POST /orders`.
- `changedById` не заполняется искусственно до появления auth владельца/оператора.
- На переходе в `SHIPPED` обязательно списывать `onHand` и `reserved` в одной транзакции.
- При создании заказа резерв выполняется атомарно условным обновлением `reserved`, без отдельного read-then-increment.
- Успешные reserve/cancel/ship операции пишут `StockMovement` в той же транзакции, что и изменение остатков.

## Enforcement
- Контракт lifecycle должен оставаться согласованным между:
  - `docs/architecture/orders-api-contract-matrix.md`;
  - `apps/api/src/orders/orders.service.ts`;
  - HTTP/service тестами `orders`.
- Любое изменение матрицы переходов выполняется только вместе с обновлением:
  - API contract docs;
  - тестов (`orders.controller.http.test.ts`, `orders.service.test.ts`);
  - связанных ADR/документов.

## Consequences
- Плюсы:
  - предсказуемое и проверяемое поведение order pipeline;
  - прозрачная аудируемость переходов;
  - сниженный риск рассинхронизации inventory.
- Ограничения:
  - добавление новых статусов требует обновления матрицы, тестов и контракта docs.
  - guest checkout и отдельные статусы обработки/оплаты/fulfillment из ADR 0005 являются target MVP после Sprint 5 и заменяют/дополняют эту single-status модель отдельным контрактным изменением.

## References
- `docs/architecture/order-status-lifecycle-sprint3.md`
- `docs/architecture/orders-api-contract-matrix.md`
- `apps/api/src/orders/orders.service.ts`
- `apps/api/src/orders/orders.controller.http.test.ts`
- `apps/api/src/orders/orders.service.test.ts`
