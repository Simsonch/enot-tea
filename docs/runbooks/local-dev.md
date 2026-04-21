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
- `pnpm --filter "@enot-tea/api" start:dev`
- `pnpm --filter "@enot-tea/api" db:generate`
- `pnpm --filter "@enot-tea/api" db:migrate -- --name <name>`
- `pnpm --filter "@enot-tea/api" db:studio`
- `pnpm --filter "@enot-tea/api" exec prisma validate --schema apps/api/prisma/schema.prisma`

### Проверка API
- `GET /` -> `API is running`
- `GET /health/db` -> `{"status":"ok","db":"up"}`

### Примечания
- `pnpm --filter "@enot-tea/api" db:pull` применяйте для непустой БД (database-first сценарий).
- Проект использует ESM/NodeNext; локальные импорты в TS-файлах оформляются с суффиксом `.js`.
- Prisma Client — generated-артефакт, вручную не редактируется.
- В `apps/api` включен `postinstall: prisma generate`; при ошибках типов Prisma можно явно выполнить `pnpm --filter "@enot-tea/api" db:generate`.

## Основные команды
- `pnpm install` — установить зависимости всего workspace.
- `pnpm -r list --depth -1` — проверить, что пакеты workspace обнаружены.
- `pnpm --filter "@enot-tea/api" db:generate` — сгенерировать Prisma Client.
- `pnpm --filter "@enot-tea/api" typecheck` — проверка типов API.
- `pnpm --filter "@enot-tea/api" build` — сборка API.

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
- `Planned`: реализация backend-ядра MVP в `apps/api` по шагам.
- Фокус Sprint 2:
  - `products`: чтение каталога товаров с базовой пагинацией;
  - `orders`: создание заказа с позициями;
  - `inventory`: резервирование остатков при создании заказа.
- Контрольные артефакты Sprint 2:
  - `docs/runbooks/local-dev.md` (актуальный контракт и команды проверки),
  - `apps/api/prisma/schema.prisma` и миграции в `apps/api/prisma/migrations`,
  - модули `apps/api/src/products/*` и `apps/api/src/orders/*`.

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

### Чеклист готовности к старту
- [x] Цели и scope MVP согласованы.
- [x] Доменные сущности и статусы заказа зафиксированы.
- [x] Базовые правила разработки и DoD определены.
- [x] Технический стек и версии утверждены для старта БД (PostgreSQL в Docker Compose).
- [x] Базовая структура монорепозитория утверждена (`apps/*` + `packages/*`).
- [x] Рабочие команды запуска/тестов/миграций подтверждены для `apps/api` (TypeScript + Prisma).
- [x] Env-шаблон для `apps/api` утвержден (`apps/api/.env.example`).

### Чеклист готовности к завершению Sprint 2
- [ ] Репозиторий инициализирован локально (`nvm use`, `pnpm install`, workspace обнаружен).
- [ ] Реализован `GET /products` с валидацией query-параметров.
- [ ] Реализован `POST /orders` с валидацией входного payload.
- [ ] Проверка и обновление остатков выполняются безопасно (транзакционно).
- [ ] Ошибки валидации и нехватки остатков возвращаются в понятном формате.
- [ ] Пройдены `typecheck`, `build`, тесты и `prisma validate`.
- [ ] Runbook отражает фактические команды и шаги проверки.

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
