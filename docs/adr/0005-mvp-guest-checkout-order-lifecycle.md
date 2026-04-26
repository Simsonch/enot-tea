# ADR 0005: MVP — гостевой checkout и раздельные статусы заказа, оплаты, fulfillment

## Статус

Accepted (решение зафиксировано; реализация в коде — по спринтам 5+).

## Контекст

- Целевой MVP: продажи **без** онлайн-оплаты и **без** регистрации клиента; оформление **как гость** (ФИО, email, адрес доставки).
- Админка на старте: **только владелец**; ручная выставка счета и подтверждение оплаты, затем доставка и подтверждение получения; email-уведомления клиенту.
- В текущей схеме (до Sprint 5) `Order` связан с `User` по `customerId`, что не отражает гостевой сценарий.
- [ADR 0003](0003-order-lifecycle-policy.md) описывает **один** `OrderStatus` с переходами `NEW → … → DELIVERED`; для MVP-операционного цикла с ручной оплатой и отдельной доставкой этого **недостаточно** — нужна явная модель **оплаты** и **fulfillment** без смешивания в одном enum.

## Решение

1. **Guest checkout (snapshot)**
   - В заказе хранить **снимок** данных покупателя и доставки: как минимум `customerFullName`, `customerEmail`, `shippingAddress` (и при необходимости `customerPhone`), независимо от будущей регистрации.
   - Поле `customerId` к `User` — **опционально** (nullable) для сценария гостя; при появлении аккаунтов — возможна привязка post-factum.

2. **Три независимых измерения состояния (рекомендуемая целевая модель)**
   - `OrderStatus` — обработка заявки владельцем (прием, обработка, готовность к отгрузке, отмена).
   - `PaymentStatus` — ожидание счета, счет выставлен, оплата подтверждена (всё **вручную** в MVP).
   - `FulfillmentStatus` — зарезервировано, передано в доставку, доставлено/получение подтверждено, при необходимости отгрузка со склада.

3. **Каноничные правила** по переходам, матрицу ошибок и публичные endpoint-ы согласовать в `docs/architecture/orders-api-contract-matrix.md` и тестах **одновременно** с реализацией Sprint 5 (не «документы отдельно от кода»).

4. **Склад**
   - Резерв при создании заказа, снятие резерва при отмене, списание `onHand`+`reserved` при передаче в доставку/отгрузке — по политике, зафиксированной в [guest-checkout-mvp-lifecycle](../architecture/guest-checkout-mvp-lifecycle.md):
     - **Записывать** `StockMovement` на релевантных шагах (create, cancel, ship/deliver по выбранной политике).
   - Защита от **гонок** при резерве: атомарные обновления/условия в транзакции (деталь — в implementation + тесты конкуренции).
   - До внедрения guest checkout текущий API уже использует эту складскую политику для legacy single `OrderStatus`: `POST /orders` атомарно увеличивает `reserved`, `CANCELLED` снимает резерв, `SHIPPED` списывает `onHand` и `reserved`, а `StockMovement` связывается с `Order`/`OrderItem`.

5. **OpenAPI / `@enot-tea/api-client`**
   - Любое изменение публичного API — обновление OpenAPI, Orval, `pnpm ci:verify` (см. [openapi-and-api-client](../architecture/openapi-and-api-client.md)).

6. **Связь с ADR 0003**
   - Для **нового** MVP-пути после внедрения Sprint 5 матрица **одного** `OrderStatus` из ADR 0003 **заменяется или дополняется** документированной матрицей трёх статусов; ADR 0003 оставляем как исторический baseline до миграции, либо помечаем в том ADR ссылку на этот ADR при полном переключении кода.
   - Это не backward-compatible-only изменение: `POST /orders` для guest checkout меняет публичный контракт с `customerId` на snapshot покупателя/доставки и требует синхронного обновления OpenAPI, client generation, docs и тестов.

## Последствия

- **Плюсы:** соответствие бизнес-процессу, явная ручная оплата, проще E2E и runbooks, меньше «магии» в одном статусе.
- **Риски:** миграция схемы и API; нужна поэтапная миграция данных для существующих заказов (если есть).
- **Владелец:** до появления UI админки ручной контур владельца — только через API/скрипты; целевой UI — Sprint 7.

## Ссылки

- [Guest checkout and MVP lifecycle (деталь)](../architecture/guest-checkout-mvp-lifecycle.md)
- [Product roadmap](../product-roadmap.md)
- [Order lifecycle policy (legacy single-status)](0003-order-lifecycle-policy.md)
- `docs/architecture/orders-api-contract-matrix.md`
- `apps/api/src/orders/orders.service.ts`
