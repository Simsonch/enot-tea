# Sprint 4 Backlog

## Priorities
- `P0`: обязательные задачи Sprint 4.
- `P1`: высокий приоритет при наличии емкости.
- `P2`: подготовка следующего спринта.

## Tasks

| ID | Priority | Task | Owner | Dependencies | Deliverable |
| --- | --- | --- | --- | --- | --- |
| S4-001 | P0 | Сформировать и зафиксировать Sprint 4 plan/backlog | Architect | - | `docs/sprints/sprint-4-plan.md`, `docs/sprints/sprint-4-backlog.md` |
| S4-002 | P0 | Синхронизировать обзор проекта с текущей реализацией (`implemented/planned`) | Architect | S4-001 | `docs/project-overview.md` |
| S4-003 | P0 | Разделить `local-dev` на актуальные инструкции и исторические итоги спринтов | Tech Lead | S4-001 | `docs/runbooks/local-dev.md` |
| S4-004 | P0 | Описать процесс релиза с gate/checklist/rollback decision points | Tech Lead | S4-002, S4-003 | `docs/runbooks/release-process.md` |
| S4-005 | P0 | Расширить incident-response ролями, эскалацией и postmortem | Tech Lead | S4-004 | `docs/runbooks/incident-response.md` |
| S4-006 | P0 | Зафиксировать API contract matrix по `orders` | Backend Lead | S4-002 | `docs/architecture/orders-api-contract-matrix.md` |
| S4-007 | P0 | Усилить HTTP/service тесты `orders` для `status/cancel` контрактов | Backend Lead | S4-006 | `apps/api/src/orders/orders.controller.http.test.ts`, `apps/api/src/orders/orders.service.test.ts` |
| S4-008 | P1 | Добавить runbook rollback/recovery (app + DB restore + consistency check) | Tech Lead | S4-004, S4-005 | `docs/runbooks/rollback-and-recovery.md` |
| S4-009 | P1 | Зафиксировать test strategy и release-gate test suite | QA Lead | S4-007 | `docs/testing/test-strategy.md` |
| S4-010 | P1 | Создать ADR: lifecycle policy и error contract standard | Architect | S4-006 | `docs/adr/0003-order-lifecycle-policy.md`, `docs/adr/0004-api-error-contract-standard.md` |
| S4-011 | P2 | Подготовить onboarding runbook для storefront/admin local-dev | Frontend Lead | S4-002, S4-003 | `docs/runbooks/local-dev-storefront-admin.md` |

## Status
- [x] `S4-001` выполнена: Sprint 4 plan/backlog зафиксированы в целевых документах.
- [x] `S4-005` выполнена: `incident-response` расширен ролями, эскалацией и postmortem-политикой.

## Release Gate for Sprint 4 Exit
- [ ] Все `P0` задачи закрыты.
- [ ] Пройдены `pnpm --filter "@enot-tea/api" typecheck`, `test`, `build`, `db:validate`.
- [ ] Документы runbook и ADR связаны ссылками и не конфликтуют по терминологии.
- [ ] Контракт `orders` задокументирован и подтвержден тестами.

## Notes
- Оценки (S/M/L) не добавляются по текущему решению.
- Любые изменения публичных API выполняются только через отдельное согласование.
