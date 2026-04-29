# Бэклог спринта 7

## Приоритеты

- `P0`: owner auth, list/detail, ручной pipeline.
- `P1`: фильтры, удобство, телефон/адрес формат.
- `P2`: a11y, метрики UI.

## Задачи

| ID | Priority | Task | Owner | Dependencies | Deliverable |
|----|----------|------|-------|--------------|-------------|
| S7-000 | P0 | Backend: `GET /orders` (owner), query params - если отсутствует в S5 | Backend Lead | S5 | API + тесты + OpenAPI (или явный подзадача в S5) |
| S7-001 | P0 | Скелет `apps/admin`, workspace | Frontend Lead | S5 | `apps/admin/*` |
| S7-002 | P0 | Владелец: login + guard на клиенте/куки/токен | Full-stack | S7-001, auth design | `apps/api` (если новые маршруты) + `apps/admin` |
| S7-003 | P0 | Список заказов, пагинация | Frontend Lead | S7-000, S7-001 | UI |
| S7-004 | P0 | Карточка заказа: гость, items, текущие статусы, история | Frontend Lead | S7-000 | UI |
| S7-005 | P0 | Действия: invoice, paid, handoff, delivered, cancel - вызовы API | Frontend Lead | S5, S7-004 | UI |
| S7-006 | P0 | Ошибки 409/400 маппинг в UI | Frontend Lead | S7-005 | UI |
| S7-007 | P0 | Orval + обновленный spec | Backend Lead | S7-000 + S5 | `packages/api-client` |
| S7-008 | P1 | Runbook: логин владельца, local-dev | Tech Lead | S7-002 | [local-dev-storefront-admin](../runbooks/local-dev-storefront-admin.md) |
| S7-009 | P1 | E2E smoke admin (опц.) | QA | S7-005 | тест/чек-лист |

## Статус

- [x] P0 завершен: owner auth, protected orders API, `apps/admin`, OpenAPI/api-client.
- [x] P1 завершен: фильтры status/date, runbook local-dev, admin smoke checklist.
- [x] S7-009 закрыт в docs-only формате: ручной smoke зафиксирован в runbook.

## Ворота релиза: выход из спринта 7

- [x] E2E happy path на staging/local по чек-листу описан в `docs/runbooks/local-dev-storefront-admin.md`.
- [x] Публичные write-endpoints к заказам защищены owner-only, кроме `POST /orders` для guest checkout.
- [x] P0 в backlog `done`.

## Примечания

- Секреты владельца только в env, не в git.
