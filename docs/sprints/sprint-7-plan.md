# Sprint 7 Plan

## Goal

**Админка владельца**: один тип пользователя (владелец) с полным доступом; список заказов, карточка заказа с гостевыми данными и позициями; **ручные** действия согласно [guest-checkout-mvp-lifecycle](../architecture/guest-checkout-mvp-lifecycle.md): выставлен счет, оплата подтверждена, передано в доставку, подтверждение получения, отмена; аутентификация для админ-операций.

## Scope In

- Создать `apps/admin` (stack по решению команды), workspace, `@enot-tea/api-client`.
- **Auth** для владельца: минимально (логин/сессия/JWT) - договоренность в реализации; только owner на старте.
- API: защищенные маршруты (если публичные - только read-only `GET` с фильтрацией по policy) - согласовать в Sprint 5/7, чтобы `POST` оплат/статусов не были открыты миру.
- UI: список заказов (фильтр по статусу/дате - P1), детализация, кнопки/формы ручных шагов, отображение `OrderStatusHistory` и критичных полей.
- OpenAPI/клиент: все новые protected endpoints сгенерированы.
- Runbook: обновить [local-dev-storefront-admin](../runbooks/local-dev-storefront-admin.md) с владельцем и сидом/учетной записью.
- Минимальный admin smoke: заказ -> счет -> оплата -> доставка -> завершен.

## Scope Out

- Роли manager/consultant, разграничение прав внутри админки.
- Чат.
- Email-отправка (Sprint 8) - в админке может быть **заглушка** "уведомление отправлено" только после S8.

## Dependencies

- Sprint 5-6: guest orders и публичный витринный поток.
- Стабильные API для list orders (если еще нет - добавить в S5/7 P0: `GET /orders` with pagination owner-only).

## Risks

- Список заказов без `GET /admin/orders` - потребуется endpoint (спланировать в S5 or S7 backlog).
- Секьюрность: не утекать гостевые PII в логи.

## Definition of Done

- Владелец проходит E2E ручного контура без SQL.
- Недопустимые переходы блокируются с теми же кодами, что в contract matrix.
- `pnpm` build admin; документация обновлена.

## Acceptance Checklist

- [ ] `docs/sprints/sprint-7-backlog.md` - P0 закрыты.
- [ ] `apps/admin` в workspace.
- [ ] Сид/superuser owner описан (без реальных паролей в репо).
