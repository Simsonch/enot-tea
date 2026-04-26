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

## Release Flow (End-to-End)
1. **Plan**: зафиксировать scope релиза, окно релиза, ответственных и rollback owner.
2. **Verify**: пройти обязательные release gates и pre-release checklist.
3. **Go/No-Go**: провести короткий checkpoint и принять решение о rollout.
4. **Rollout**: выкатить артефакт и выполнить post-release smoke.
5. **Observe**: мониторить сервис в окне наблюдения.
6. **Close**: закрыть релиз или эскалировать инцидент/rollback.

## Release Gates (Mandatory, from repo root)
- `pnpm ci:verify` — агрегирует проверки API, Prisma, экспорт OpenAPI и генерацию пакета `@enot-tea/api-client` (см. `docs/architecture/openapi-and-api-client.md`).
- Раздельно (эквивалент `ci:verify` для `apps/api` + артефакты контракта):
  - `pnpm --filter "@enot-tea/api" typecheck`
  - `pnpm --filter "@enot-tea/api" test`
  - `pnpm --filter "@enot-tea/api" build`
  - `pnpm --filter "@enot-tea/api" db:validate`
  - `pnpm openapi:export` и `pnpm api-client:gen` (или `pnpm api-client:regen`)
  - `pnpm typecheck:api-client`

## Entry Criteria (Before Rollout)
- [ ] Scope релиза и change list зафиксированы.
- [ ] Назначены Release Owner, Backend Owner, QA Owner.
- [ ] Обновлены релевантные docs (`project-overview`, runbooks, контракты API) при изменении поведения.
- [ ] Проверено отсутствие breaking changes в публичных API.
- [ ] Для изменений поведения обновлены тесты.
- [ ] Подготовлен rollback plan (версия/коммит, порядок отката, owner).
- [ ] Зафиксировано окно наблюдения после релиза и ответственные.
- [ ] Все команды из Release Gates пройдены успешно.

## Go/No-Go Checkpoint
Решение `go` принимается, если одновременно выполняются условия:
- Release Gates пройдены без ошибок.
- Нет блокирующих дефектов уровня `SEV-1`/`SEV-2`.
- Rollback plan подтвержден и выполним.
- Ответственные на окно наблюдения подтверждены.

Иначе решение `no-go`: релиз переносится, фиксируется причина и план корректирующих действий.

## Rollout Steps
1. Зафиксировать релизный артефакт (commit/tag/версия).
2. Выполнить деплой в целевое окружение по стандарту команды.
3. Выполнить post-release smoke:
   - `GET /health/db` возвращает `{"status":"ok","db":"up"}`;
   - `GET /products` возвращает `200`;
   - критичный `orders` сценарий не деградировал.
4. Зафиксировать результат smoke в release notes/канале релиза.

## Rollback Decision Points
### Trigger conditions for immediate rollback
- API недоступен после rollout.
- Критичный endpoint (`POST /orders`, `PATCH /orders/:id/status`, `GET /health/db`) стабильно не проходит smoke.
- Наблюдается устойчивый скачок `5xx` или контрактных бизнес-ошибок, влияющий на оформление/обработку заказов.
- Подтвержден риск нарушения инвариантов `orders`/`inventory`.

### When forward-fix is acceptable
- Влияние ограничено и не затрагивает критичный order flow.
- Есть безопасный фикс в пределах согласованного короткого окна.
- Incident Commander и Release Owner явно согласовали стратегию.

Если хотя бы один критерий для forward-fix не выполняется, выбирать rollback.

## Observation Window
- Минимум 30 минут после rollout для MVP-релиза.
- Отслеживать:
  - доступность health endpoint;
  - error rate (`4xx/5xx`, отдельно контрактные ошибки `orders`);
  - latency ключевых API;
  - успешность критичного order flow.

## Exit Criteria
- Release Gates и post-release smoke пройдены.
- В окне наблюдения нет деградации критичных сценариев.
- Решение `release closed` зафиксировано Release Owner.
- При инциденте запущен процесс из `docs/runbooks/incident-response.md`.
- Для rollback/recovery используется `docs/runbooks/rollback-and-recovery.md`.
