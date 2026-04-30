# Гостевой checkout и жизненный цикл MVP (Enot Tea)

Сопровождает [ADR 0005: MVP guest checkout и раздельные статусы](../adr/0005-mvp-guest-checkout-order-lifecycle.md). Начиная со Sprint 5, документ описывает фактический публичный order flow backend API и должен обновляться вместе с OpenAPI/client generation.

## 1. Guest checkout

### Данные в заказе (snapshot, обязательные для публичного `POST /orders`)

| Поле (логическое) | Назначение |
|-------------------|------------|
| `customerFullName` | ФИО получателя/плательщика |
| `customerEmail`    | Доставка статусов по email, уникальность в рамках заказа не требуется |
| `shippingAddress`  | Адрес доставки (строка или структурировано — на усмотрение DTO) |

Опционально: `customerPhone`.

### Пользователь `User`

- Гостевой заказ **не** обязан иметь `customerId` → FK на `User` **nullable** или отдельная модель guest-only order.
- Для **владельца** админки — отдельные учетные записи; клиенты MVP не аутентифицируются.

## 2. Три измерения статуса

### 2.1 `OrderStatus` (обработка заявки владельцем)

Фактический Sprint 5 enum/path:

- `NEW` — заказ поступил и товар зарезервирован.
- `CONFIRMED` — владелец выставил счет.
- `PACKED` — оплата подтверждена, заказ готов к передаче в доставку.
- `SHIPPED` — заказ передан в доставку, склад списан.
- `DELIVERED` — владелец подтвердил получение клиентом.
- `CANCELLED` — отмена (с политикой возврата резерва).

### 2.2 `PaymentStatus` (только ручной контур)

- `PENDING` — ожидает счет или действий.
- `INVOICE_SENT` — владелец зафиксировал, что счет выставлен (вручную).
- `PAID` — владелец подтвердил оплату.
- `REFUNDED` / `PAYMENT_FAILED` — post-MVP или редкие сценарии, при необходимости.

**Онлайн-оплаты в MVP нет** — внешний платёжный шлюз не подключается.

### 2.3 `FulfillmentStatus` (склад / доставка / получение)

- `RESERVED` — товар зарезервирован (см. склад).
- `HANDED_TO_CARRIER` — передан в доставку (как в UI владельца).
- `DELIVERED` — владелец подтвердил получение клиентом.
- `RETURNED` — post-MVP.

Согласованность: переходы **на бэкенде** валидируются матрицей; недопустимые комбинации — код ошибки в духе существующего `INVALID_ORDER_STATUS_TRANSITION` (детализация в contract matrix).

## 3. Складские инварианты

### 3.1 Определения

- `onHand` — физически на складе.
- `reserved` — зарезервировано под незавершенные заказы.
- `available = onHand - reserved` (логически; в БД храним `onHand` и `reserved`).

### 3.2 События и ожидаемое влияние (MVP, целевая политика)

| Событие | `reserved` | `onHand` | `StockMovement` |
|---------|------------|----------|-----------------|
| Создание заказа (успех) | +qty по позициям | без изменений | да (reason: e.g. `ORDER_RESERVE`) |
| Отмена заказа до отгрузки | -qty | без изменений | да (`ORDER_CANCEL_RELEASE`) |
| Передача в доставку (`PATCH /orders/:id/handoff-to-delivery`, когда со склада уходит товар) | -qty | -qty | да (`ORDER_SHIP`) |
| Подтверждение доставки клиенту | без изменения остатков | без изменения | нет, или лог-запись без дельты (на усмотрение) |

**Важно:** каноничная точка списания `onHand` — `PATCH /orders/:id/handoff-to-delivery` (`PACKED / PAID / RESERVED -> SHIPPED / PAID / HANDED_TO_CARRIER`). `POST /orders` только резервирует `reserved`, а `PATCH /orders/:id/delivered` не меняет склад.

### 3.3 Конкуренция

- Проверка `available` и инкремент `reserved` должны быть **атомарными** (транзакция + `UPDATE ... WHERE` с условием на достаточный `available` или эквивалент).
- Покрыто сервисным тестом параллельного создания заказов на последний остаток.

## 4. Аудит

- `OrderStatusHistory` — **все** значимые переходы (по `OrderStatus`, и при отдельных endpoint — по `Payment`/`Fulfillment` если вынесены в отдельные таблицы/истории).
- Sprint 5 implementation choice: использовать одну расширенную `OrderStatusHistory` с `statusDimension = ORDER | PAYMENT | FULFILLMENT` и отдельными from/to полями для каждого измерения. Новые таблицы истории не добавлять, пока не появится отдельная потребность в разных политиках хранения/доступа.
- Владелец-инициатор: `changedById` (после появления auth владельца в Sprint 7).
- `StockMovement` — привязка к `orderId` / `orderItemId` / `inventoryItemId` по схеме Sprint 5.

## 5. Email (контракт к Sprint 8)

- Триггеры: смена статусов, по которым бизнес обещал письмо (создан заказ, счет, оплата, в доставке, выполнен, отмена).
- Сбой email: заказ **не** откатывать; повтор/очередь/ручной resend в runbook (см. [sprint-8-plan](../sprints/sprint-8-plan.md)).
- Реализация Sprint 8: отправка best-effort после успешной транзакции заказа; провайдер выбирается через env (`EMAIL_PROVIDER=log|resend`), секреты провайдера хранятся только в окружении.
- Логи email-контура содержат только correlation `orderId` и event type; body письма и персональные данные не логируются.
- `NotificationAttempt` хранит только метаданные попытки (`orderId`, event, status, errorMessage, createdAt) для admin-индикатора и ручного resend; email/body письма в таблицу не пишутся.

## 6. Связанные документы

- [Product roadmap](../product-roadmap.md)
- [Domain model v1](domain-model.md) — отражает Sprint 5 guest checkout lifecycle и legacy single-status compatibility endpoint.
- [Orders API contract matrix](orders-api-contract-matrix.md) — обновляется вместе с реализацией.
