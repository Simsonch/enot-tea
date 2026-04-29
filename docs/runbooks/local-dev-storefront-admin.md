# Локальная разработка: витрина и админка

## Цель
Дать быстрый и предсказуемый onboarding для локального запуска `apps/storefront` и будущей `apps/admin`.

## Текущее состояние реализации
- `apps/storefront` — реализован MVP-поток гостевого checkout: каталог, корзина, checkout, thank-you.
- `apps/admin` — `planned`.
- Backend-контур для интеграции — `apps/api`.

## Предпосылки
- Выполнен базовый setup из `docs/runbooks/local-dev.md`:
  - `nvm use` (Node `24.15.0`);
  - `pnpm install`;
  - запуск локальной PostgreSQL при необходимости backend-проверок.
- Прочитан `docs/project-overview.md` (границы MVP и статус модулей).
- Прочитан `docs/architecture/orders-api-contract-matrix.md` (контракты `orders`).

## Быстрый старт storefront
1. В одном терминале запустите API:
   - `pnpm start:back:dev`
2. Во втором терминале создайте локальный env:
   - `cp apps/storefront/.env.example apps/storefront/.env.local`
3. Запустите storefront:
   - `pnpm --filter @enot-tea/storefront dev`
4. Откройте `http://localhost:3100`.

## Runtime-конфиг storefront
- `API_BASE_URL` — базовый URL API для dev rewrites Next.js.
- Если не задано, storefront использует `http://localhost:3000`.
- Запросы к `/products` и `/orders` проксируются через Next rewrites, поэтому на клиенте не требуется ручная настройка CORS.

## Чеклист smoke (гостевой checkout)
- [ ] На `/` отображается каталог товаров из `GET /products`.
- [ ] Добавление товара увеличивает корзину и корректно считает total.
- [ ] На `/checkout` форма отправляет `POST /orders` и ведёт на `thank-you/:orderId`.
- [ ] Для `VALIDATION_ERROR` (400) отображаются ошибки полей.
- [ ] Для `INSUFFICIENT_STOCK` (409) показывается понятное сообщение без потери корзины.
- [ ] При сетевом сбое отображается fallback-сообщение и доступен повторный submit.

## Рекомендуемый онбординг
1. Подтвердить backend-контракт как source of truth:
   - `docs/architecture/orders-api-contract-matrix.md`;
   - `docs/adr/0003-order-lifecycle-policy.md`;
   - `docs/adr/0004-api-error-contract-standard.md`.
2. Для изменений API перед проверкой storefront обновлять клиент:
   - `pnpm api-client:regen`
3. Для регрессии storefront использовать smoke checklist выше.

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
- Не заменяет release/incident/rollback runbooks.

## Критерии готовности локальной среды
- API и storefront одновременно запускаются локально без ручного CORS workaround.
- Smoke checkout проходит по чеклисту.

## Ссылки
- `docs/project-overview.md`
- `docs/runbooks/local-dev.md`
- `docs/architecture/orders-api-contract-matrix.md`
- `docs/adr/0003-order-lifecycle-policy.md`
- `docs/adr/0004-api-error-contract-standard.md`
