# Процесс релиза (MVP)

## Цель
Стандартизировать выпуск изменений для `apps/api` и задать единые release gates до расширения на витрину и админку.

## Текущая область
- `apps/api` — в текущем спринте обязательный контур релиза.
- `apps/storefront`, `apps/admin` — planned; при появлении включаются в те же этапы.

## Роли
- Release Owner: координирует релиз и принимает go/no-go.
- Backend Owner: подтверждает техническую готовность `apps/api`.
- QA Owner: подтверждает прохождение release-gate проверок.
- Incident Commander (on-call): принимает управление при проблемах после релиза.

## Поток релиза (сквозной)
1. **Plan**: зафиксировать scope релиза, окно релиза, ответственных и rollback owner.
2. **Verify**: пройти обязательные release gates и pre-release checklist.
3. **Go/No-Go**: провести короткий checkpoint и принять решение о rollout.
4. **Rollout**: выкатить артефакт и выполнить post-release smoke.
5. **Observe**: мониторить сервис в окне наблюдения.
6. **Close**: закрыть релиз или эскалировать инцидент/rollback.

## Ворота релиза (обязательны, из корня репозитория)
- `pnpm ci:verify` — агрегирует проверки API, Prisma, экспорт OpenAPI и генерацию пакета `@enot-tea/api-client` (см. `docs/architecture/openapi-and-api-client.md`).
- Раздельно (эквивалент `ci:verify` для `apps/api` + артефакты контракта):
  - `pnpm --filter "@enot-tea/api" typecheck`
  - `pnpm --filter "@enot-tea/api" test`
  - `pnpm --filter "@enot-tea/api" build`
  - `pnpm --filter "@enot-tea/api" db:validate`
  - `pnpm openapi:export` и `pnpm api-client:gen` (или `pnpm api-client:regen`)
  - `pnpm typecheck:api-client`

## Критерии входа (перед выкатыванием)
- [ ] Scope релиза и change list зафиксированы.
- [ ] Назначены Release Owner, Backend Owner, QA Owner.
- [ ] Обновлены релевантные docs (`project-overview`, runbooks, контракты API) при изменении поведения.
- [ ] Проверено отсутствие breaking changes в публичных API.
- [ ] Для изменений поведения обновлены тесты.
- [ ] Для email-уведомлений выбран режим `EMAIL_PROVIDER`: `log` для controlled skip/sandbox или `resend` с секретами только в окружении.
- [ ] Подготовлен rollback plan (версия/коммит, порядок отката, owner).
- [ ] Зафиксировано окно наблюдения после релиза и ответственные.
- [ ] Все команды из Release Gates пройдены успешно.

## Контрольная точка go/no-go
Решение `go` принимается, если одновременно выполняются условия:
- Release Gates пройдены без ошибок.
- Нет блокирующих дефектов уровня `SEV-1`/`SEV-2`.
- Rollback plan подтвержден и выполним.
- Ответственные на окно наблюдения подтверждены.

Иначе решение `no-go`: релиз переносится, фиксируется причина и план корректирующих действий.

## Шаги выкатывания
1. Зафиксировать релизный артефакт (commit/tag/версия).
2. Выполнить деплой в целевое окружение по стандарту команды.
3. Выполнить post-release smoke:
   - `GET /health/db` возвращает `{"status":"ok","db":"up"}`;
   - `GET /products` возвращает `200`;
   - критичный `orders` сценарий не деградировал.
   - email smoke для Sprint 8:
     - в sandbox создать тестовый заказ и пройти P0 lifecycle: создан, счет выставлен, оплата подтверждена, передан в доставку, выполнен, отменен на отдельном тестовом заказе;
     - проверить доставку письма на sandbox-ящик для каждого P0-шаблона или зафиксировать controlled skip, если окружение использует `EMAIL_PROVIDER=log`;
     - проверить `NotificationAttempt` для тестовых заказов: успешные попытки имеют `status='SUCCESS'`, сбои provider фиксируются как `status='FAILED'` без body письма;
     - в логах проверить только `orderId` и event (`order-created`, `invoice-issued`, `payment-confirmed`, `in-delivery`, `completed`, `cancelled`), без body письма и персональных данных.
4. Зафиксировать результат smoke в release notes/канале релиза.

## Email manual recovery
- Если provider вернул ошибку, заказ и склад не откатываются: статус заказа считается источником правды.
- Найти запись по `orderId` и event в `NotificationAttempt` или логах `OrderNotificationsService`/`MailerService`; не копировать body письма и email клиента в release notes или incident notes.
- Для ручного resend в MVP использовать кнопку "Переотправить уведомление" в admin order detail. Если admin недоступна, отправить письмо вручную из sandbox/provider console по актуальному шаблону и `orderId`.
- Если сбой массовый, переключить окружение на `EMAIL_PROVIDER=log`, продолжить критичный order flow и открыть follow-up на provider/retry. Инварианты склада проверять по `docs/runbooks/rollback-and-recovery.md`.

## Точки решения об откате
### Условия немедленного отката
- API недоступен после rollout.
- Критичный endpoint (`POST /orders`, `PATCH /orders/:id/status`, `GET /health/db`) стабильно не проходит smoke.
- Наблюдается устойчивый скачок `5xx` или контрактных бизнес-ошибок, влияющий на оформление/обработку заказов.
- Подтвержден риск нарушения инвариантов `orders`/`inventory`.

### Когда допустим forward-fix
- Влияние ограничено и не затрагивает критичный order flow.
- Есть безопасный фикс в пределах согласованного короткого окна.
- Incident Commander и Release Owner явно согласовали стратегию.

Если хотя бы один критерий для forward-fix не выполняется, выбирать rollback.

## Окно наблюдения
- Минимум 30 минут после rollout для MVP-релиза.
- Отслеживать:
  - доступность health endpoint;
  - error rate (`4xx/5xx`, отдельно контрактные ошибки `orders`);
  - latency ключевых API;
  - успешность критичного order flow.

## Критерии выхода
- Release Gates и post-release smoke пройдены.
- В окне наблюдения нет деградации критичных сценариев.
- Решение `release closed` зафиксировано Release Owner.
- При инциденте запущен процесс из `docs/runbooks/incident-response.md`.
- Для rollback/recovery используется `docs/runbooks/rollback-and-recovery.md`.
