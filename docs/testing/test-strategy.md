# Test Strategy (MVP)

## Goal
Определить обязательные проверки для стабильного выпуска backend e-commerce сценариев (`catalog`, `orders`, `inventory`).

## Scope
- Текущий обязательный контур: `apps/api`.
- Основной фокус Sprint 4: контракт и регрессии в `orders`.
- Документ синхронизирован с release gates из `docs/runbooks/release-process.md`.

## Test Pyramid
- Unit: бизнес-правила сервисов (`OrdersService`, валидации, инварианты).
- HTTP contract tests: boundary-контракты endpoint-ов и форматы ошибок.
- Smoke manual/API checks: минимальный post-release контроль критичных сценариев.

<<<<<<< HEAD
=======
<<<<<<< HEAD
## Mandatory Release-Gate Suite (from repo root)
=======
>>>>>>> 57f2fac (Добавил генерацию api клиента для фронта)
## Mandatory Release-Gate Suite
Из корня репозитория (эквивалент шагов ниже):
- `pnpm ci:verify` — `typecheck` + `test` + `build` для `apps/api`, `db:validate`, экспорт OpenAPI в `packages/api-client/spec/openapi.json`, Orval-генерация `packages/api-client`, `tsc` для `@enot-tea/api-client`.

Пошагово (при отладке):
<<<<<<< HEAD
=======
>>>>>>> 93ff425 (Добавил генерацию api клиента для фронта)
>>>>>>> 57f2fac (Добавил генерацию api клиента для фронта)
- `pnpm --filter "@enot-tea/api" typecheck`
- `pnpm --filter "@enot-tea/api" test` (включая `src/openapi/openapi.document.test.ts` — стабильный набор путей OpenAPI)
- `pnpm --filter "@enot-tea/api" build`
- `pnpm --filter "@enot-tea/api" db:validate`
- `pnpm openapi:export` и `pnpm api-client:gen` (или `pnpm api-client:regen`)
- `pnpm typecheck:api-client`

## Release-Gate Coverage Map
- `typecheck`:
  - проверка типов и совместимости TS-контрактов.
- `test`:
  - `apps/api/src/orders/orders.service.test.ts`;
  - `apps/api/src/orders/orders.controller.http.test.ts`;
  - `apps/api/src/common/validation-error-format.test.ts`.
- `build`:
  - проверка сборки NestJS-приложения и модульных импортов.
- `db:validate`:
  - проверка `prisma/schema.prisma` и Prisma-конфига.

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

## Minimum Regression Policy
- Любое изменение поведения `orders` требует:
  - минимум 1 happy-path тест;
  - минимум 1 negative-case тест;
  - обновление matrix/docs при изменении публичного контракта.
- Изменения статусных переходов должны сопровождаться:
  - тестами допустимых переходов;
  - тестами блокировки недопустимых переходов;
  - тестами побочных эффектов на складе (`onHand`, `reserved`).

## Execution Cadence
- На каждый PR в `apps/api`:
  - минимум `typecheck` + таргетные тесты затронутого модуля.
- Перед merge в release-ветку:
  - полный mandatory release-gate suite.
- После деплоя:
  - smoke-проверки из `docs/runbooks/release-process.md`.

## Quality Rules
- Тестируем наблюдаемое поведение, а не внутренние реализации.
- Для каждого измененного поведения есть happy path и негативный кейс.
- Тесты детерминированы и не зависят от побочных состояний окружения.

## Ownership
- QA Owner: подтверждает прохождение release-gate suite перед релизом.
- Backend Owner: поддерживает актуальность unit/HTTP contract tests для `orders`.
- Release Owner: принимает go/no-go только при подтвержденном прохождении mandatory suite.
