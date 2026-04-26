# Enot Tea

Enot Tea — монорепозиторий электронной коммерции: витрина чая и операционный контур заказов для владельца. Реализованный backend в `apps/api` отдаёт каталог, заказы, склад, health, OpenAPI и сгенерированный контракт клиента API.

## Локальная настройка

Требования:
- Node.js `24.15.0` (`.nvmrc`)
- `pnpm` `10.33.0`
- Docker Desktop для локальной PostgreSQL

Типовой сценарий:

```bash
pnpm install
docker compose up -d postgres
cp apps/api/.env.example apps/api/.env
pnpm --filter @enot-tea/api db:migrate
pnpm start:back:dev
```

Руководства и архитектура:
- Локальная разработка: `docs/runbooks/local-dev.md`
- Релиз: `docs/runbooks/release-process.md`
- Обзор проекта: `docs/project-overview.md`
- OpenAPI и клиент API: `docs/architecture/openapi-and-api-client.md`

## Проверка

Основной gate из корня репозитория:

```bash
pnpm ci:verify
```

Запускает проверку типов и тесты API, сборку, валидацию схемы Prisma, экспорт OpenAPI, генерацию Orval и проверку типов пакета `@enot-tea/api-client`.
