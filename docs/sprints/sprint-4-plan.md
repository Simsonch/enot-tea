# Sprint 4 Plan

## Goal
Подготовить платформу к запуску витрины и админки за счет:
- выравнивания документации с фактическим состоянием репозитория;
- формализации release/deploy/incident/recovery процессов;
- усиления контрактов `orders` и проверок тестами.

## Scope In
- Планирование и прозрачный backlog Sprint 4.
- Синхронизация `project-overview` и `local-dev` с фактической реализацией.
- Новые/обновленные runbook-документы для релиза и инцидентов.
- Документация API contract matrix по `orders`.
- Усиление тестов `orders` на backward-compatibility и контракт ошибок.
- Базовая test strategy и ADR по lifecycle/error-contract.

## Scope Out
- Реализация `apps/storefront` и `apps/admin` функционала.
- Изменение production инфраструктуры и CI/CD пайплайнов.
- Ломающее изменение текущих API контрактов.

## Dependencies
1. Описать цель и структуру Sprint 4 (`sprint-4-plan`, `sprint-4-backlog`).
2. Обновить базовую архитектурную и dev документацию.
3. Зафиксировать release/incident/recovery процессы.
4. После фиксации контрактов обновить тесты `orders`.
5. Финализировать test strategy и ADR.

## Risks
- Расхождение между архитектурными документами и фактическим кодом.
- Недостаточная детализация rollback/recovery для боевых инцидентов.
- Регрессии в `orders` при изменениях тестов/контрактных ожиданий.

## Definition of Done
- Все задачи Sprint 4 отражены в `docs/sprints/sprint-4-backlog.md` с owner, priority, dependencies.
- Актуальные документы не противоречат фактической структуре репозитория.
- Контракты `orders` зафиксированы в docs и покрыты тестами.
- Проверки `typecheck`, `test`, `build`, `db:validate` для `apps/api` проходят.

## Acceptance Checklist
- [ ] `docs/sprints/sprint-4-backlog.md` заполнен и согласован.
- [ ] `docs/project-overview.md` отражает `implemented/planned` статус модулей.
- [ ] `docs/runbooks/local-dev.md` разделен на актуальные инструкции и исторические итоги.
- [ ] Добавлен `docs/runbooks/release-process.md`.
- [ ] Обновлен `docs/runbooks/incident-response.md` (roles/escalation/postmortem).
- [ ] Добавлен `docs/runbooks/rollback-and-recovery.md`.
- [ ] Добавлен `docs/architecture/orders-api-contract-matrix.md`.
- [ ] Обновлены тесты `apps/api/src/orders/*.test.ts`.
- [ ] Добавлен `docs/testing/test-strategy.md`.
- [ ] Добавлены ADR по lifecycle и error-contract.
