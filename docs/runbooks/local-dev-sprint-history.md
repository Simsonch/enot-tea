# История спринтов локальной разработки (архив)

Этот документ хранит исторические итоги по Sprint 1-3. Актуальные инструкции локальной разработки находятся в [`local-dev.md`](./local-dev.md).

## Предусловия старта разработки (Sprint 1)

### Что было готово
- Определены цели и границы MVP в `docs/project-overview.md`.
- Зафиксирована базовая модель домена в `docs/architecture/domain-model.md`.
- Описаны минимальные практики наблюдаемости и реагирования на инциденты.
- Зафиксированы базовые правила разработки в `.cursor/rules`.

### Статус Sprint 1
- `Done`: базовый контур локальной разработки и backend-каркаса подтвержден.
- Контрольные артефакты:
  - `docs/runbooks/local-dev.md`
  - `docs/adr/0002-db-contract-first.md`
  - `apps/api/.env.example`

## Исторические итоги Sprint 2

### Статус Sprint 2
- `Done`: backend-ядро MVP в `apps/api` (каталог, заказы, резерв/снятие резерва) доставлено.
- Фокус Sprint 2:
  - `products`: чтение каталога товаров с базовой пагинацией (`GET /products`);
  - `orders`: создание, получение и отмена заказа (`POST /orders`, `GET /orders/:id`, `PATCH /orders/:id/cancel`);
  - `inventory`: резервирование при создании и снятие резерва при отмене заказа.
- Контрольные артефакты Sprint 2:
  - `docs/runbooks/local-dev.md` (актуальный на тот момент контракт и команды проверки),
  - `apps/api/prisma/schema.prisma` и миграции в `apps/api/prisma/migrations`,
  - модули `apps/api/src/products/*` и `apps/api/src/orders/*`.

### Чеклист готовности к завершению Sprint 2
- [x] Репозиторий и настройка workspace по разделу [«Настройка»](./local-dev.md#настройка).
- [x] Реализован `GET /products` с валидацией query-параметров.
- [x] Реализован `POST /orders` с валидацией входного payload.
- [x] Реализован `GET /orders/:id` (получение заказа с `items` и `statusHistory`).
- [x] Реализован `PATCH /orders/:id/cancel` (отмена заказа с учетом допустимых статусов).
- [x] Проверка и обновление остатков выполняются безопасно (транзакционно), включая снятие резерва при отмене.
- [x] Ошибки валидации и нехватки остатков возвращаются в понятном формате.
- [x] Пройдены `typecheck` и тесты API.
- [x] Пройдены `build` и `prisma validate` (`db:validate`).
- [x] Runbook отражает фактические команды и шаги проверки.

### Итог Sprint 2
В `apps/api` доставлены read API каталога и сквозной поток заказа: `GET /products` с пагинацией и фильтрами query; `POST /orders`, `GET /orders/:id`, `PATCH /orders/:id/cancel` с позициями и `statusHistory`. Остатки и резервы обновляются в транзакциях: при создании заказа растет `reserved` и проверяется инвариант по `onHand`/`available`; при отмене снимается резерв. На границе API стабильны ответы об ошибках: `VALIDATION_ERROR` (`400`) и `INSUFFICIENT_STOCK` (`409`).

Код и данные: модули [`apps/api/src/products/`](../../apps/api/src/products), [`apps/api/src/orders/`](../../apps/api/src/orders), схема и миграции — [`apps/api/prisma/schema.prisma`](../../apps/api/prisma/schema.prisma), [`apps/api/prisma/migrations/`](../../apps/api/prisma/migrations).

## Исторические итоги Sprint 3

### Статус Sprint 3
- `Done`: lifecycle заказа после создания/отмены до этапов отгрузки и доставки доставлен.
- Фокус Sprint 3:
  - `orders`: переходы статусов `CONFIRMED -> PACKED -> SHIPPED -> DELIVERED`;
  - валидация допустимых переходов и блокировка недопустимых переходов;
  - `inventory`: при `SHIPPED` обновлять остатки (`decrement onHand` и `decrement reserved`);
  - аудит переходов в `OrderStatusHistory`;
  - тесты на happy path, negative cases, `not found` и inventory edge cases.
- Контрольные артефакты Sprint 3:
  - `docs/runbooks/local-dev.md` (фактические на тот момент команды и ручные проверки),
  - `docs/architecture/order-status-lifecycle-sprint3.md` (матрица переходов и API-контракт),
  - модули `apps/api/src/orders/*`,
  - при изменениях схемы: `apps/api/prisma/schema.prisma` и миграции в `apps/api/prisma/migrations`.

### Чеклист готовности к завершению Sprint 3
- [x] Реализованы endpoint-ы смены статуса заказа.
- [x] Валидируются допустимые переходы статусов.
- [x] На `SHIPPED` корректно обновляются `onHand`/`reserved`.
- [x] Переходы пишутся в `statusHistory`.
- [x] Пройдены `typecheck`/`test`/`build`/`db:validate`.
- [x] Runbook обновлен фактическими шагами проверки.

### Итог Sprint 3
В `apps/api` доставлен lifecycle заказа после создания/отмены до этапов отгрузки и доставки: `CONFIRMED -> PACKED -> SHIPPED -> DELIVERED`, включая API-операции смены статуса и проверку допустимости переходов.

На уровне контрактов и инвариантов гарантируется корректность последовательности переходов, запись аудита в `OrderStatusHistory` и согласованное обновление склада на этапе `SHIPPED` (`decrement onHand` и `decrement reserved`) в транзакции.

### Проверено в Sprint 3
- Команды проверки:
  - `pnpm --filter "@enot-tea/api" typecheck` — пройдено успешно.
  - `pnpm --filter "@enot-tea/api" test` — пройдено успешно.
  - `pnpm --filter "@enot-tea/api" build` — пройдено успешно.
  - `pnpm --filter "@enot-tea/api" db:validate` — пройдено успешно.
- Сводка тестов:
  - service tests: `10` (`apps/api/src/orders/orders.service.test.ts`);
  - HTTP contract tests: `5` (`apps/api/src/orders/orders.controller.http.test.ts`);
  - common validation tests: `1` (`apps/api/src/common/validation-error-format.test.ts`).

## Исторический changelog (до Sprint 4)
- API возвращает структурированную ошибку валидации `VALIDATION_ERROR` (`400`) с полями `code`, `message`, `errors[]`.
- API возвращает структурированную ошибку нехватки остатка `INSUFFICIENT_STOCK` (`409`) с полями `code`, `message`, `details`.
- Синхронизированы команды запуска backend: root-скрипт `start:back:dev` и runbook используют одно имя.
- Исправлена опечатка в команде запуска в runbook (удалена лишняя кавычка).
- Повторная проверка после корректировок: `pnpm --filter @enot-tea/api typecheck` и `pnpm --filter @enot-tea/api test` проходят успешно.
- В `apps/api` добавлена зависимость `dotenv` для `prisma.config` (и `prisma validate` / `db:validate`); подтверждены `build` и валидация схемы.
