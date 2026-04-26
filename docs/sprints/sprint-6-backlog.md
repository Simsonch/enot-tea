# Бэклог спринта 6

## Приоритеты

- `P0`: витрина и happy-path checkout.
- `P1`: UX и доступность, базовая обработка ошибок.
- `P2`: e2e автоматизация.

## Задачи

| ID | Priority | Task | Owner | Dependencies | Deliverable |
|----|----------|------|-------|--------------|-------------|
| S6-001 | P0 | Скелет `apps/storefront`, workspace, scripts `dev`/`build` | Frontend Lead | S5 exit | `apps/storefront/*`, root `package.json` / pnpm |
| S6-002 | P0 | Каталог: список товаров с `getProducts` / аналог из api-client | Frontend Lead | S6-001 | UI |
| S6-003 | P0 | Корзина: локальное состояние, итоги, переход в checkout | Frontend Lead | S6-002 | UI |
| S6-004 | P0 | Checkout: поля guest, submit `POST /orders` | Frontend Lead | S5 exit, S6-003 | UI + wire API |
| S6-005 | P0 | Страница успеха, отображение id заказа | Frontend Lead | S6-004 | UI |
| S6-006 | P0 | Маппинг ошибок `VALIDATION_ERROR`, `INSUFFICIENT_STOCK` | Frontend Lead | S6-004 | UI |
| S6-007 | P1 | Proxy/env для API в dev | DevOps / FE | S6-001 | `vite.config` / `next.config` / docs |
| S6-008 | P1 | Обновить [local-dev-storefront-admin](../runbooks/local-dev-storefront-admin.md) | Tech Lead | S6-001 | runbook |
| S6-009 | P2 | Smoke e2e (опционально) | QA / FE | S6-005 | e2e job или docs |

## Статус

- [ ] P0 не завершен.

## Ворота релиза: выход из спринта 6

- [ ] Ручной happy path задокументирован.
- [ ] Сборка storefront без ошибок.
- [ ] Все P0 в backlog закрыты или явно отложены с причиной.

## Примечания

- Не класть секреты в фронт; API URL - из env.
