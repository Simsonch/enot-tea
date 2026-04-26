# Test Strategy (MVP)

## Goal
Определить обязательные проверки для стабильного выпуска backend e-commerce сценариев (`catalog`, `orders`, `inventory`).

## Test Pyramid
- Unit: бизнес-правила сервисов (`OrdersService`, валидации, инварианты).
- HTTP contract tests: boundary-контракты endpoint-ов и форматы ошибок.
- Smoke manual/API checks: минимальный post-release контроль критичных сценариев.

## Mandatory Release-Gate Suite
Из корня репозитория (эквивалент шагов ниже):
- `pnpm ci:verify` — `typecheck` + `test` + `build` для `apps/api`, `db:validate`, экспорт OpenAPI в `packages/api-client/spec/openapi.json`, Orval-генерация `packages/api-client`, `tsc` для `@enot-tea/api-client`.

Пошагово (при отладке):
- `pnpm --filter "@enot-tea/api" typecheck`
- `pnpm --filter "@enot-tea/api" test` (включая `src/openapi/openapi.document.test.ts` — стабильный набор путей OpenAPI)
- `pnpm --filter "@enot-tea/api" build`
- `pnpm --filter "@enot-tea/api" db:validate`
- `pnpm openapi:export` и `pnpm api-client:gen` (или `pnpm api-client:regen`)
- `pnpm typecheck:api-client`

## Critical Business Flows to Cover
- Создание заказа (`POST /orders`) с проверкой `INSUFFICIENT_STOCK`.
- Получение заказа (`GET /orders/:id`) с `items` и `statusHistory`.
- Отмена заказа (`PATCH /orders/:id/cancel`) с корректным снятием `reserved`.
- Переходы статусов (`PATCH /orders/:id/status`) с проверкой допустимости переходов.
- Инварианты склада при `SHIPPED`: списание `onHand` и `reserved`.

## Error Contract Coverage
- `VALIDATION_ERROR` (400) — невалидные входные данные.
- `INVALID_ORDER_STATUS_TRANSITION` (409) — запрещенный переход статуса.
- `INVENTORY_INVARIANT_VIOLATION` (409) — нарушение складских инвариантов.
- `INSUFFICIENT_STOCK` (409) — нехватка доступного остатка.

## Quality Rules
- Тестируем наблюдаемое поведение, а не внутренние реализации.
- Для каждого измененного поведения есть happy path и негативный кейс.
- Тесты детерминированы и не зависят от побочных состояний окружения.
