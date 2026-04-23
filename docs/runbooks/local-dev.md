# Локальная разработка

## Требования
- Git
- Доступ к репозиторию
- Node.js `24.15.0` (LTS, зафиксировано в `.nvmrc`)
- `pnpm` `10.33.0` (зафиксировано в root `package.json`)
- Docker Desktop (для запуска локальной PostgreSQL через Docker Compose)

## Настройка
1. Клонировать репозиторий.
2. Перейти в корень проекта и инициализировать runtime:
   - `nvm use`
   - `node -v` -> `v24.15.0`
   - `pnpm -v` -> `10.33.0`
3. Установить зависимости workspace:
   - `pnpm install`
   - `pnpm -r list --depth -1`
   - Проверить, что в списке есть `@enot-tea/api`.
4. Прочитать `docs/project-overview.md` и `docs/architecture/domain-model.md`.
5. Проверить актуальные правила в `.cursor/rules`.
6. Подтвердить технические решения Sprint 1 (TBD):
   - runtime и пакетный менеджер;
   - структура приложений и команды запуска;
   - формат env-файлов;
   - CI-минимум.
7. После утверждения Sprint 1 заполнить этот runbook конкретными командами.
8. Поддерживать базовую структуру монорепозитория:
   - `apps/api`
   - `apps/storefront`
   - `apps/admin`
   - `packages/shared`

## Локальная БД (PostgreSQL через Docker)

### Предпосылки
- Docker Desktop установлен и запущен.
- В корне репозитория есть `docker-compose.yml`.

### Запуск БД
- `docker compose up -d postgres`
- `docker compose ps`
- `docker compose logs --tail=50 postgres`

### Проверка подключения
- `docker exec -it enot-tea-postgres psql -U enot -d enot_tea_dev -c "select 1;"`
- `docker exec -it enot-tea-postgres psql -U enot -d enot_tea_dev -c "select current_database(), current_user, now();"`

### Остановка и перезапуск
- `docker compose stop postgres`
- `docker compose start postgres`
- `docker compose restart postgres`
- `docker compose down`

### Сброс локальных данных (осторожно)
- `docker compose down -v`
- Команда удаляет контейнеры и volume с данными БД.

## `apps/api`: NestJS + Prisma + TypeScript

### Рабочая директория
- `cd apps/api`

### Переменные окружения
- `cp .env.example .env`
- Обязательные переменные:
  - `DATABASE_URL` для PostgreSQL подключения
  - `PORT` для HTTP сервера NestJS
  - `NODE_ENV` для режима окружения

### Базовые команды
- `pnpm --filter "@enot-tea/api" typecheck`
- `pnpm --filter "@enot-tea/api" build`
- `pnpm start:back:dev`
- `pnpm --filter "@enot-tea/api" db:generate`
- `pnpm --filter "@enot-tea/api" db:migrate -- --name <name>`
- `pnpm --filter "@enot-tea/api" db:studio`
- `pnpm --filter "@enot-tea/api" db:validate` (валидация `prisma/schema.prisma` через `prisma.config` пакета)

### Проверка API
- `GET /` -> `API is running`
- `GET /health/db` -> `{"status":"ok","db":"up"}`
- `GET /products?limit=20&offset=0&isActive=true` -> `200` и список товаров с пагинацией
- `POST /orders` -> `201` и созданный заказ с позициями
- `GET /orders/:id` -> `200` и заказ с `items` + `statusHistory`
- `PATCH /orders/:id/cancel` -> `200` и заказ со статусом `CANCELLED`
- `PATCH /orders/:id/status` c body `{"toStatus":"CONFIRMED|PACKED|SHIPPED|DELIVERED","comment?":"..."}` -> `200` и обновленный заказ
- `PATCH /orders/:id/status` c body `{"toStatus":"CANCELLED|NEW"}` -> `400` и `VALIDATION_ERROR` (отмена выполняется только через `PATCH /orders/:id/cancel`)
- `GET /orders/:id` для несуществующего `id` -> `404`
- `PATCH /orders/:id/cancel` из неотменяемого статуса -> `409`
- `PATCH /orders/:id/status` с недопустимым переходом -> `409` и `INVALID_ORDER_STATUS_TRANSITION`

### Smoke-сценарий заказа
1. Создать заказ через `POST /orders`.
2. Перевести заказ в `CONFIRMED` через `PATCH /orders/:id/status`.
3. Перевести заказ в `PACKED` через `PATCH /orders/:id/status`.
4. Перевести заказ в `SHIPPED` через `PATCH /orders/:id/status` и проверить изменения `onHand`/`reserved`.
5. Перевести заказ в `DELIVERED` через `PATCH /orders/:id/status`.
6. Проверить в `GET /orders/:id`, что в `statusHistory` есть последовательность переходов.
7. Проверить недопустимый переход (например, `CONFIRMED -> SHIPPED`) и убедиться, что API возвращает `409`.
8. Создать отдельный заказ и отменить через `PATCH /orders/:id/cancel`, затем повторить отмену и убедиться, что API возвращает `409`.
9. Запросить несуществующий `orderId` и убедиться, что API возвращает `404`.

### Примечания
- `pnpm --filter "@enot-tea/api" db:pull` применяйте для непустой БД (database-first сценарий).
- Проект использует ESM/NodeNext; локальные импорты в TS-файлах оформляются с суффиксом `.js`.
- Prisma Client — generated-артефакт, вручную не редактируется.
- В `apps/api` включен `postinstall: prisma generate`; при ошибках типов Prisma можно явно выполнить `pnpm --filter "@enot-tea/api" db:generate`.

## Основные команды
- `pnpm install` — установить зависимости всего workspace.
- `pnpm -r list --depth -1` — проверить, что пакеты workspace обнаружены.
- `pnpm start:back:dev` — запустить backend в watch-режиме.
- `pnpm --filter "@enot-tea/api" db:generate` — сгенерировать Prisma Client.
- `pnpm --filter "@enot-tea/api" typecheck` — проверка типов API.
- `pnpm --filter "@enot-tea/api" test` — запуск unit-тестов API.
- `pnpm --filter "@enot-tea/api" build` — сборка API.
- `pnpm --filter "@enot-tea/api" db:validate` — проверка схемы Prisma.

## Типовые проблемы
- Проблема: в runbook есть команда, которой нет в проекте.
  - Причина: стек или структура еще не зафиксированы.
  - Решение: не выполнять такую команду, пометить как `TBD`, согласовать в Sprint 1 и обновить runbook.
- Проблема: документы противоречат друг другу по терминам или процессу.
  - Причина: несогласованные правки между `docs/*`.
  - Решение: выровнять формулировки в `project-overview`, `domain-model`, ADR и runbook до начала реализации.
- Проблема: неясно, можно ли начинать кодить.
  - Причина: отсутствуют зафиксированные техрешения (стек, команды, env, инфраструктура).
  - Решение: пройти чеклист предусловий старта разработки (ниже).

## Предусловия старта разработки

### Что уже готово
- Определены цели и границы MVP в `docs/project-overview.md`.
- Зафиксирована базовая модель домена в `docs/architecture/domain-model.md`.
- Описаны минимальные практики наблюдаемости и реагирования на инциденты.
- Зафиксированы базовые правила разработки в `.cursor/rules`.

### Статус Sprint 1
- `Done`: базовый контур локальной разработки и backend каркаса подтвержден.
- Контрольные артефакты:
  - `docs/runbooks/local-dev.md`
  - `docs/adr/0002-db-contract-first.md`
  - `apps/api/.env.example`

### Статус Sprint 2
- `Done`: backend-ядро MVP в `apps/api` (каталог, заказы, резерв/снятие резерва) доставлено; краткое резюме — в разделе **Итог Sprint 2** ниже.
- Фокус Sprint 2:
  - `products`: чтение каталога товаров с базовой пагинацией (`GET /products`);
  - `orders`: создание, получение и отмена заказа (`POST /orders`, `GET /orders/:id`, `PATCH /orders/:id/cancel`);
  - `inventory`: резервирование при создании и снятие резерва при отмене заказа.
- Контрольные артефакты Sprint 2:
  - `docs/runbooks/local-dev.md` (актуальный контракт и команды проверки),
  - `apps/api/prisma/schema.prisma` и миграции в `apps/api/prisma/migrations`,
  - модули `apps/api/src/products/*` и `apps/api/src/orders/*`.

### Статус Sprint 3
- `Done`: lifecycle заказа после создания/отмены до этапов отгрузки и доставки доставлен.
- Фокус Sprint 3:
  - `orders`: переходы статусов `CONFIRMED -> PACKED -> SHIPPED -> DELIVERED`;
  - валидация допустимых переходов и блокировка недопустимых переходов;
  - `inventory`: при `SHIPPED` обновлять остатки (`decrement onHand` и `decrement reserved`);
  - аудит переходов в `OrderStatusHistory`;
  - тесты на happy path, negative cases, `not found` и inventory edge cases.
- Контрольные артефакты Sprint 3:
  - `docs/runbooks/local-dev.md` (фактические команды и ручные проверки Sprint 3),
  - `docs/architecture/order-status-lifecycle-sprint3.md` (матрица переходов и API-контракт),
  - модули `apps/api/src/orders/*`,
  - при изменениях схемы: `apps/api/prisma/schema.prisma` и миграции в `apps/api/prisma/migrations`.

### Что нужно утвердить до начала реализации
- Финальный стек и версии (`apps/api`, `apps/storefront`, `apps/admin`, БД, инструменты).
- Структуру репозитория и naming-конвенции модулей.
- Формат и обязательные переменные окружения.
- Политику локального запуска инфраструктуры и CI-минимум.

### Что войдет в первый технический спринт
- Создание каркаса приложений и рабочих команд запуска.
- Подключение БД, миграций и seed-данных.
- Подготовка минимального API-каркаса и первого сквозного сценария.
- Обновление этого runbook конкретными проверенными командами.

### Что войдет во второй технический спринт
- Инициализация репозитория как первый шаг спринта:
  - клонирование репозитория и переход в директорию проекта;
  - `nvm use` и проверка версий Node/pnpm;
  - `pnpm install` и проверка workspace через `pnpm -r list --depth -1`;
  - проверка базовой структуры (`apps/*`, `packages/*`);
  - первичная проверка локального окружения и доступности Docker.
- Уточнение минимального API-контракта для `GET /products` и `POST /orders`.
- Подготовка/актуализация Prisma-миграций для ядра заказа и остатков.
- Реализация сервисов и контроллеров `products` и `orders` в `apps/api`.
- Добавление проверок складского инварианта `onHand - reserved >= quantity`.
- Добавление базовых тестов (happy path + граничный/ошибочный сценарий).
- Обновление runbook фактическими командами проверки Sprint 2.

### Что войдет в третий технический спринт
- Реализация endpoint-ов смены статуса заказа для шагов `CONFIRMED`, `PACKED`, `SHIPPED`, `DELIVERED`.
- Валидация допустимых переходов статусов и запрет недопустимых переходов.
- Обновление склада при `SHIPPED`: `decrement onHand` и `decrement reserved` в рамках транзакции.
- Логирование каждого перехода в `OrderStatusHistory` с фиксацией `fromStatus` и `toStatus`.
- Добавление и актуализация тестов: happy path, negative cases, `not found`, inventory edge cases.
- Обновление runbook фактическими командами и ручными проверками Sprint 3.

### Чеклист готовности к старту
- [x] Цели и scope MVP согласованы.
- [x] Доменные сущности и статусы заказа зафиксированы.
- [x] Базовые правила разработки и DoD определены.
- [x] Технический стек и версии утверждены для старта БД (PostgreSQL в Docker Compose).
- [x] Базовая структура монорепозитория утверждена (`apps/*` + `packages/*`).
- [x] Рабочие команды запуска/тестов/миграций подтверждены для `apps/api` (TypeScript + Prisma).
- [x] Env-шаблон для `apps/api` утвержден (`apps/api/.env.example`).

### Чеклист готовности к завершению Sprint 2
- [x] Репозиторий и настройка workspace по разделу [«Настройка»](#настройка) (процедурный критерий для разработчика).
- [x] Реализован `GET /products` с валидацией query-параметров.
- [x] Реализован `POST /orders` с валидацией входного payload.
- [x] Реализован `GET /orders/:id` (получение заказа с `items` и `statusHistory`).
- [x] Реализован `PATCH /orders/:id/cancel` (отмена заказа с учетом допустимых статусов).
- [x] Проверка и обновление остатков выполняются безопасно (транзакционно), включая снятие резерва при отмене.
- [x] Ошибки валидации и нехватки остатков возвращаются в понятном формате.
- [x] Пройдены `typecheck` и тесты API.
- [x] Пройдены `build` и `prisma validate` (скрипт `db:validate` и команды `apps/api` в этом runbook).
- [x] Runbook отражает фактические команды и шаги проверки.

### Чеклист готовности к завершению Sprint 3
- [x] Реализованы endpoint-ы смены статуса заказа.
- [x] Валидируются допустимые переходы статусов.
- [x] На `SHIPPED` корректно обновляются `onHand`/`reserved`.
- [x] Переходы пишутся в `statusHistory`.
- [x] Пройдены `typecheck`/`test`/`build`/`db:validate`.
- [x] Runbook обновлен фактическими шагами проверки.

### Итог Sprint 2

В `apps/api` доставлены read API каталога и сквозной поток заказа: `GET /products` с пагинацией и фильтрами query; `POST /orders`, `GET /orders/:id`, `PATCH /orders/:id/cancel` с позициями и `statusHistory`. Остатки и резервы обновляются в транзакциях: при создании заказа растёт `reserved` и проверяется инвариант по `onHand`/`available`; при отмене снимается резерв. На границе API стабильны ответы об ошибках: `VALIDATION_ERROR` (400) и `INSUFFICIENT_STOCK` (409).

Код и данные: модули [`apps/api/src/products/`](../../apps/api/src/products), [`apps/api/src/orders/`](../../apps/api/src/orders), схема и миграции — [`apps/api/prisma/schema.prisma`](../../apps/api/prisma/schema.prisma), [`apps/api/prisma/migrations/`](../../apps/api/prisma/migrations). Каноничные проверки: `pnpm --filter "@enot-tea/api" typecheck`, `test`, `build`, `db:validate` (из корня репозитория).

### Итог Sprint 3

В `apps/api` доставлен lifecycle заказа после создания/отмены до этапов отгрузки и доставки: `CONFIRMED -> PACKED -> SHIPPED -> DELIVERED`, включая API-операции смены статуса и проверку допустимости переходов.

На уровне контрактов и инвариантов гарантируется корректность последовательности переходов, запись аудита в `OrderStatusHistory` и согласованное обновление склада на этапе `SHIPPED` (`decrement onHand` и `decrement reserved`) в транзакции.

Каноничные проверки:
- `pnpm --filter "@enot-tea/api" typecheck`
- `pnpm --filter "@enot-tea/api" test`
- `pnpm --filter "@enot-tea/api" build`
- `pnpm --filter "@enot-tea/api" db:validate`

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

## Короткий changelog по фиче
- API возвращает структурированную ошибку валидации `VALIDATION_ERROR` (`400`) с полями `code`, `message`, `errors[]`.
- API возвращает структурированную ошибку нехватки остатка `INSUFFICIENT_STOCK` (`409`) с полями `code`, `message`, `details`.
- Синхронизированы команды запуска backend: root-скрипт `start:back:dev` и runbook используют одно имя.
- Исправлена опечатка в команде запуска в runbook (удалена лишняя кавычка).
- Повторная проверка после корректировок: `pnpm --filter @enot-tea/api typecheck` и `pnpm --filter @enot-tea/api test` проходят успешно.
- В `apps/api` добавлена зависимость `dotenv` для `prisma.config` (и чистого `prisma validate` / `db:validate`); подтверждены `build` и валидация схемы.

### Ручная проверка контрактов ошибок
- Ошибка валидации (`400`, `VALIDATION_ERROR`): отправить `POST /orders` с пустым `customerId` или некорректным `items`.
- Ошибка нехватки остатков (`409`, `INSUFFICIENT_STOCK`): отправить `POST /orders` с `quantity`, превышающим `available` остаток.
- Ошибка недопустимого перехода (`409`, `INVALID_ORDER_STATUS_TRANSITION`): отправить `PATCH /orders/:id/status` с переходом, который не разрешен текущим `status` заказа (например, `CONFIRMED -> SHIPPED`).
- Ошибка инварианта склада (`409`, `INVENTORY_INVARIANT_VIOLATION`): выполнить `PATCH /orders/:id/status` в `SHIPPED` при состоянии остатков, где `onHand < quantity` или `reserved < quantity`.

### Troubleshooting (monorepo + pnpm)
- Проблема: `No projects matched the filters`.
  - Причина: не настроен/пустой `pnpm-workspace.yaml` или неверный filter.
  - Решение:
    - проверить `pnpm-workspace.yaml` (`apps/*`, `packages/*`);
    - проверить имя пакета в `apps/api/package.json` (`@enot-tea/api`);
    - выполнить `pnpm -r list --depth -1`.
- Проблема: `command not found (nest/tsc)`.
  - Причина: отсутствуют зависимости пакета (`node_modules` не установлены).
  - Решение:
    - выполнить `pnpm install` из корня;
    - повторить `pnpm --filter "@enot-tea/api" typecheck` и `pnpm --filter "@enot-tea/api" build`.
- Проблема: Prisma type/export errors (`PrismaClient` not exported, `$queryRaw` not found).
  - Причина: Prisma Client не сгенерирован после установки/изменений.
  - Решение:
    - выполнить `pnpm --filter "@enot-tea/api" db:generate`;
    - повторить `pnpm --filter "@enot-tea/api" typecheck`.
