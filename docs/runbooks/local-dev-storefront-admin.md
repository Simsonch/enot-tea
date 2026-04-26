# Локальная разработка: витрина и админка (планируется)

## Цель
Дать безопасный onboarding-процесс для `apps/storefront` и `apps/admin` до начала активной frontend-разработки, не создавая ложного впечатления, что приложения уже реализованы.

## Текущее состояние реализации
- `apps/storefront` — `planned` (папка создана, production-ready UI не реализован).
- `apps/admin` — `planned` (папка создана, production-ready UI не реализован).
- Каноничный backend-контур для интеграции уже реализован в `apps/api`.

## Предпосылки
- Выполнен базовый setup из `docs/runbooks/local-dev.md`:
  - `nvm use` (Node `24.15.0`);
  - `pnpm install`;
  - запуск локальной PostgreSQL при необходимости backend-проверок.
- Прочитан `docs/project-overview.md` (границы MVP и статус модулей).
- Прочитан `docs/architecture/orders-api-contract-matrix.md` (контракты `orders`).

## Чеклист готовности workspace
- [ ] В `apps/storefront` и `apps/admin` присутствуют директории приложений.
- [ ] В `pnpm-workspace.yaml` включены `apps/*` и `packages/*`.
- [ ] Команда `pnpm -r list --depth -1` выполняется успешно.
- [ ] Backend API доступен локально через `pnpm start:back:dev`.
- [ ] Подтверждены базовые API endpoint-ы (`GET /health/db`, `GET /products`).

## Рекомендуемый онбординг
1. Подтвердить backend-контракт как единственный source of truth для UI-интеграции:
   - `docs/architecture/orders-api-contract-matrix.md`;
   - `docs/adr/0003-order-lifecycle-policy.md`;
   - `docs/adr/0004-api-error-contract-standard.md`.
2. Зафиксировать frontend scope первого шага:
   - storefront: read flow каталога и базовый checkout UX (без production-критериев);
   - admin: просмотр заказов и управление статусами в пределах текущего API.
3. Определить контрактные mock-сценарии на основе актуальных response/error кодов API.
4. Перед реализацией UI зафиксировать отдельный sprint backlog для frontend-задач.

## Бэкенд-эндпоинты для интеграции с фронтендом
- `GET /products?limit=&offset=&isActive=`
- `POST /orders`
- `GET /orders/:id`
- `PATCH /orders/:id/cancel`
- `PATCH /orders/:id/status`

### Ключевые коды ошибок для UI
- `VALIDATION_ERROR` (`400`)
- `INSUFFICIENT_STOCK` (`409`)
- `INVALID_ORDER_STATUS_TRANSITION` (`409`)
- `INVENTORY_INVARIANT_VIOLATION` (`409`)

## Вне scope этого runbook
- Не описывает production deployment storefront/admin.
- Не фиксирует финальный UI stack и сборочные команды приложений (до отдельного согласования).
- Не заменяет release/incident/rollback runbooks.

## Критерии передачи в фронтенд-спринт
- Согласован frontend sprint backlog с owner и приоритетами.
- Определен минимальный UI contract-test набор для `catalog/orders`.
- Подтверждено отсутствие противоречий с `project-overview`, ADR и API contract matrix.

## Ссылки
- `docs/project-overview.md`
- `docs/runbooks/local-dev.md`
- `docs/architecture/orders-api-contract-matrix.md`
- `docs/adr/0003-order-lifecycle-policy.md`
- `docs/adr/0004-api-error-contract-standard.md`
