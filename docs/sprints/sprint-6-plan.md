# План спринта 6

## Цель

**Публичная витрина**: каталог, корзина, оформление заказа **без регистрации** с полями ФИО, email, адрес (телефон опционально), отображение успеха и понятных ошибок API, использование `@enot-tea/api-client` по контракту Sprint 5.

## Входит

- Создать `apps/storefront` в монорепозитории (стек: по решению команды, согласованный с [ADR 0001](../adr/0001-monorepo-structure.md) и `pnpm-workspace.yaml`).
- Подключение workspace-зависимости ` "@enot-tea/api-client": "workspace:*" `.
- Страницы/экраны: листинг товаров (из `GET /products`), корзина (клиентское состояние), checkout-форма, thank-you/номер заказа после `POST /orders`.
- Обработка ошибок: `VALIDATION_ERROR` (400), `INSUFFICIENT_STOCK` (409), сетевые сбои.
- Env: `API_BASE_URL` / proxy для `fetch` origin (см. [openapi-and-api-client](../architecture/openapi-and-api-client.md)).
- Документация: обновить [local-dev-storefront-admin](../runbooks/local-dev-storefront-admin.md) или аналогичный runbook.
- Минимальный smoke: вручную по чек-листу или e2e-скелет (если выбран Playwright/др.) - зафиксировать в [test-strategy](../testing/test-strategy.md) при появлении тестов фронта.

## Не входит

- Личный кабинет, история заказов гостя.
- Онлайн-оплата.
- Админка (Sprint 7).
- Email (Sprint 8).

## Зависимости

- Sprint 5: стабильный `POST /orders` с guest payload и `pnpm ci:verify` по api-client.

## Риски

- CORS/прокси в dev: зафиксировать в runbook.
- Несоответствие DTO: реген Orval и типы из корня.

## Критерии готовности

- С гостя через UI проходит: каталог -> корзина -> checkout -> созданный заказ (id/подтверждение).
- Негативные кейсы не ломают UI (сообщения пользователю).
- `pnpm` build storefront в CI (когда pipeline расширен) или минимальная verify-команда в `package.json` monorepo.

## Чеклист приёмки

- [x] `docs/sprints/sprint-6-backlog.md` - P0 закрыты.
- [x] `apps/storefront` в workspace.
- [x] Runbook dev обновлен.
