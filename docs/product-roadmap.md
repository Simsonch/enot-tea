# Дорожная карта продукта: запуск MVP продаж Enot Tea

Документ фиксирует целевой MVP, пользовательский flow, архитектурные принципы и план по спринтам 5–9. Статус **реализации** — см. `docs/project-overview.md` и бэклоги `docs/sprints/sprint-*-backlog.md`.

## Целевой MVP (продажи)

- Клиент **без регистрации** оформляет заказ: ФИО, email, адрес доставки (телефон — опционально).
- **Онлайн-оплаты нет**: оплата подтверждается **вручную** владельцем после выставления счета вне API.
- Заказ приходит **в админку владельца**; на старте **только роль владельца** с полным доступом. Разделение owner/manager/consultant — после MVP.
- Операционный цикл: **гость оформил** → **на обработке** → **счет выставлен** → **оплата подтверждена** → **передано в доставку** → **получение подтверждено** → заказ **выполнен** (история). Отмена возможна согласно политике.
- **Email-уведомления** клиенту по ключевым изменениям статуса (и событиям вроде «счет выставлен» / «заказ отменен»).
- **Склад**: полный контур резерва, списания, аудит `StockMovement`, защита от гонок при резервировании.
- **OpenAPI-first**: изменения API → экспорт в `packages/api-client/spec/openapi.json` → Orval → `pnpm ci:verify` без дрейфа.

## Пользовательский flow (MVP)

1. Клиент: витрина, корзина, оформление как гость (данные в заказе).
2. API: создание заказа, резерв остатков, запись истории/движений склада.
3. Владелец: админка, просмотр списка и карточки заказа, ручные шаги обработки и оплаты, доставка, завершение.
4. Система: отправка email на зарегистрированный в заказе email (гостя).

## Архитектурные решения (сводка)

| Решение | Суть |
|--------|------|
| Guest checkout | Snapshot покупателя и доставки **в `Order`**, без обязательного `User` при гостевом сценарии. Подробнее: [guest-checkout-mvp-lifecycle](architecture/guest-checkout-mvp-lifecycle.md), [ADR 0005](adr/0005-mvp-guest-checkout-order-lifecycle.md). |
| Статусы | Раздельно: `OrderStatus` (обработка), `PaymentStatus` (счет/оплата), `FulfillmentStatus` (доставка/получение). |
| ADR 0003 | Текущий одно-`OrderStatus` pipeline в коде; целевой MVP-путь после реализации Sprint 5 обновит матрицу и [orders-api-contract-matrix](architecture/orders-api-contract-matrix.md). |
| Безопасность | Секреты в env, в логи не писать email/адрес/персональные данные целиком; админ-операции только с аутентификацией владельца (Sprint 7). |

## Спринты (план)

| Спринт | Фокус | Документы |
|--------|--------|------------|
| 5 | Backend/domain: guest-заказ, enum-ы статусов, склад, OpenAPI, тесты | [sprint-5-plan](sprints/sprint-5-plan.md), [sprint-5-backlog](sprints/sprint-5-backlog.md) |
| 6 | Витрина: каталог, корзина, checkout | [sprint-6-plan](sprints/sprint-6-plan.md), [sprint-6-backlog](sprints/sprint-6-backlog.md) |
| 7 | Админка владельца: список, карточка, ручные переходы, защита API | [sprint-7-plan](sprints/sprint-7-plan.md), [sprint-7-backlog](sprints/sprint-7-backlog.md) |
| 8 | Email, release hardening, smoke, runbooks | [sprint-8-plan](sprints/sprint-8-plan.md), [sprint-8-backlog](sprints/sprint-8-backlog.md) |
| 9 | Post-MVP: роли, чат, онлайн-оплата, аккаунты | ниже, кратко |

## Sprint 9 (post-MVP, кратко)

- Роли manager/consultant, чат, онлайн-оплата, привязка guest-заказов к будущим аккаунтам — в отдельных ADR и бэклоге после запуска продаж.

## Риски и контроль

- **Oversell** — атомарное резервирование + тесты конкурентных заказов (Sprint 5).
- **Историчность** — снимок гостя в заказе, не перезапись при будущем `User`.
- **API drift** — после каждого изменения public API: `pnpm api-client:regen` и `pnpm ci:verify`.
- **Email** — сбой отправки не должен нарушать инварианты заказа/склада; ретраи/ручной доввод (Sprint 8).

## Минимальные release gates

- Backend: `pnpm ci:verify`, миграции с нуля, OpenAPI/клиент без незакоммиченного diff.
- Storefront/Admin: smoke сценарии по runbook.
- Email: sandox/provider, шаблоны, smoke.
- Склад: `onHand`, `reserved`, `StockMovement` согласованы после create/cancel/ship/deliver.

## Ссылки

- [Обзор проекта](project-overview.md)
- [OpenAPI и api-client](architecture/openapi-and-api-client.md)
- [Test strategy](testing/test-strategy.md)
- [Release process](runbooks/release-process.md)
