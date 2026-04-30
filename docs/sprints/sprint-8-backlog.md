# Бэклог спринта 8

## Приоритеты

- `P0`: провайдер, отправка, минимальные шаблоны, не ломать домен.
- `P1`: ретраи, логирование, админ-индикатор "email failed".
- `P2`: preview шаблонов в dev.

## Задачи

| ID | Priority | Task | Owner | Dependencies | Deliverable |
|----|----------|------|-------|--------------|-------------|
| S8-001 | P0 | Выбор провайдера, env vars, документация | Tech Lead | - | `docs/runbooks/...` или `docs/architecture/` |
| S8-002 | P0 | `Mailer`/adapter в `apps/api` (или sidecar - по решению) | Backend Lead | S8-001 | `apps/api/src/*` |
| S8-003 | P0 | Триггеры на смене статусов/событиях (из Sprint 5 design) | Backend Lead | S5, S7 | hooks в OrdersService/слой domain events |
| S8-004 | P0 | Шаблоны писем (создан, счет, оплата, доставка, done, cancel) | Backend Lead / UX copy | S8-002 | шаблоны + snapshot тест id при необходимости |
| S8-005 | P0 | Policy: сбой email -> запись, retry, без rollback заказа | Backend Lead | S8-002 | код + тесты |
| S8-006 | P0 | Runbook: smoke post-deploy с email | Tech Lead | S8-004 | [release-process](../runbooks/release-process.md) |
| S8-007 | P1 | Admin: индикатор/кнопка "переотправить уведомление" (если договоренность) | Full-stack | S7, S8-003 | UI + endpoint опц. |
| S8-008 | P1 | Consistency check складов runbook (ссылка на SQL/процедуру) | Backend Lead | S5 | runbook |
| S8-009 | P2 | E2E: mock провайдера | QA | S8-003 | тесты |

## Статус

- [x] P0 implementation завершен в коде, тестах и runbook.
- [x] S8-007 admin manual resend/indicator завершен.
- [x] S8-008 warehouse consistency runbook завершен.
- [x] S8-009 mock-provider HTTP smoke coverage завершен.
- [x] Sandbox delivery gate: controlled skip для локального/staging контура с `EMAIL_PROVIDER=log`; инструкция smoke/resend зафиксирована в runbook.

## Ворота релиза: выход из спринта 8

- [x] Sandbox письмо доставляется на тестовый ящик для каждого P0-шаблона (или controlled skip через `EMAIL_PROVIDER=log` + mock-provider HTTP smoke).
- [x] API gates зеленые: `typecheck`, `test`, `build`, `db:validate`.
- [x] Нет секретов в git, `.env.example` обновлен без значений.
- [x] Admin/API client gates зеленые для ручного resend UI.

## Примечания

- Запрещено логировать body письма с персональными данными.
