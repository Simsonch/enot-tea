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
6. Убедиться, что запуск и проверки выполняются для фактически реализованного `apps/api`.
7. Использовать этот runbook как каноничный источник актуальных локальных команд.
8. Учитывать статус модулей:
   - `apps/api` — `implemented`;
   - `apps/storefront` — `planned`;
   - `apps/admin` — `planned`;
   - `packages/shared` — `planned`.

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

### OpenAPI и клиент для фронтенда (`@nestjs/swagger` + Orval)
- Swagger UI: с поднятым API откройте `http://localhost:3000/api` (отключение: `SWAGGER_DISABLE=1`).
- Экспорт спецификации в репозиторий: `pnpm openapi:export` (пишет `packages/api-client/spec/openapi.json`, без подключения к БД).
- Генерация типобезопасного fetch-клиента: `pnpm api-client:gen` (пакет `packages/api-client`).
- Оба шага: `pnpm api-client:regen`. Подробности: `docs/architecture/openapi-and-api-client.md`.

### Проверка API
- `GET /` -> `Служба API запущена`
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
- `pnpm ci:verify` — полный gate: API + OpenAPI export + Orval + typecheck `@enot-tea/api-client` (см. `docs/testing/test-strategy.md`).

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

## Архив спринтов
- Исторические итоги и чеклисты Sprint 1-3 вынесены в отдельный документ: [`local-dev-sprint-history.md`](./local-dev-sprint-history.md).

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
