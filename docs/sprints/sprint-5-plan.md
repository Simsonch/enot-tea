# План спринта 5

## Цель

Привести backend и схему БД к целевому **MVP продаж** без UI: гостевой заказ (snapshot ФИО, email, адрес), раздельные статусы **обработки / оплаты / fulfillment**, полный **складской** контур с `StockMovement`, атомарный резерв, обновление **OpenAPI** и `@enot-tea/api-client`, тесты.

## Входит

- Проектирование DTO/enum-ов в соответствии с [guest-checkout-mvp-lifecycle](../architecture/guest-checkout-mvp-lifecycle.md) и [ADR 0005](../adr/0005-mvp-guest-checkout-order-lifecycle.md).
- Prisma: миграция `Order` (guest fields, nullable `customerId` или эквивалент), `PaymentStatus`, `FulfillmentStatus` (имена уточняются в миграции), истории переходов (расширение `OrderStatusHistory` или отдельные таблицы — по дизайну Sprint 5).
- `POST /orders` - принимает товары + snapshot гостя; снимок не перезаписывается из `User` при отсутствии логина.
- Эндпоинты/операции для **ручного** сценария: выставлен счет, оплата подтверждена, передано в доставку, получение подтверждено, отмена (согласовать с матрицей).
- Склад: `StockMovement` на релевантных шагах; `INSUFFICIENT_STOCK` / инварианты; тест **конкурентного** резерва.
- Документация: обновить [orders-api-contract-matrix](../architecture/orders-api-contract-matrix.md) и при необходимости [домен v1](../architecture/domain-model.md) после согласования.
- `pnpm openapi:export` + `pnpm api-client:gen` + `pnpm ci:verify`.

## Не входит

- `apps/storefront` и `apps/admin`.
- Провайдер email и письма (Sprint 8).
- Роли кроме подготовки **owner** auth (база может заложить `User`+пароль для владельца - минимальная, или отложить на Sprint 7 - зафиксировать в бэклоге S5-xxx).

## Зависимости

- [ADR 0005](../adr/0005-mvp-guest-checkout-order-lifecycle.md) принят.
- [Sprint 4 exit](sprint-4-backlog.md) (контракты и runbooks baseline).

## Риски

- Ломающие изменения API - требуют явного согласования; документ `orders-api-contract-matrix` и Orval must stay in sync.
- Миграция существующих заказов в dev/staging.
- Согласование момента списания `onHand` (один «каноничный» шаг — см. guest-checkout doc).

## Критерии готовности

- Guest `POST /orders` работает; GET возвращает snapshot и согласованные статусы.
- Склад и истории согласованы с тестами; negative/happy path покрыты.
- OpenAPI + generated client закоммичены без дрейфа; `pnpm ci:verify` зеленый.
- Матрица `orders` в docs и коде согласованы.

## Чеклист приёмки

- [x] `docs/sprints/sprint-5-backlog.md` - все P0 с owner и deliverable.
- [x] Обновлен `docs/architecture/orders-api-contract-matrix.md` (и при смене политики - ссылка на ADR 0003/0005).
- [x] `apps/api` тесты: сервис + HTTP + openapi paths при изменении.
- [x] `pnpm ci:verify` пройден локально/CI (2026-04-27).
