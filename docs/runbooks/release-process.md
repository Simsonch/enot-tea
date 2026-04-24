# Release Process (MVP)

## Goal
Стандартизировать выпуск изменений для `apps/api` и задать единые release gates до расширения на витрину и админку.

## Current Scope
- `apps/api` — в текущем спринте обязательный контур релиза.
- `apps/storefront`, `apps/admin` — planned; при появлении включаются в те же этапы.

## Roles
- Release Owner: координирует релиз и принимает go/no-go.
- Backend Owner: подтверждает техническую готовность `apps/api`.
- QA Owner: подтверждает прохождение release-gate проверок.
- Incident Commander (on-call): принимает управление при проблемах после релиза.

## Release Gates (Mandatory)
Запускать из корня репозитория:
- `pnpm --filter "@enot-tea/api" typecheck`
- `pnpm --filter "@enot-tea/api" test`
- `pnpm --filter "@enot-tea/api" build`
- `pnpm --filter "@enot-tea/api" db:validate`

## Pre-release Checklist
- [ ] Обновлены релевантные docs (`project-overview`, runbooks, контракты API).
- [ ] Проверено отсутствие breaking changes в публичных API.
- [ ] Для изменений поведения обновлены тесты.
- [ ] Подготовлен rollback plan (версия/коммит, порядок отката, owner).
- [ ] Уточнен период наблюдения после релиза и ответственные.

## Rollout Steps
1. Подтвердить прохождение release gates.
2. Зафиксировать релизный артефакт (commit/tag/версия).
3. Выполнить деплой в целевое окружение по стандарту команды.
4. Запустить post-release smoke:
   - `GET /health/db` возвращает `{"status":"ok","db":"up"}`;
   - `GET /products` возвращает `200`;
   - критичный `orders` сценарий не деградировал.
5. В течение окна наблюдения отслеживать error rate, успешность создания заказов и latency.

## Rollback Decision Points
- Немедленный rollback:
  - недоступен API;
  - скачок 5xx/ошибок бизнес-контрактов;
  - деградация критичного заказа (`POST /orders`, `PATCH /orders/:id/status`).
- Forward-fix допускается только если:
  - влияние ограничено;
  - есть быстрый безопасный фикс;
  - Incident Commander и Release Owner согласовали стратегию.

## Post-release
- Закрыть релиз после окна наблюдения и зафиксировать результат.
- При инциденте выполнить процесс из `docs/runbooks/incident-response.md`.
- Для rollback/recovery использовать `docs/runbooks/rollback-and-recovery.md`.
