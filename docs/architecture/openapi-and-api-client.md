# OpenAPI и типобезопасный frontend-клиент

## Цель
- Источник правды по публичному HTTP-контракту: **OpenAPI 3** (генерация из NestJS через `@nestjs/swagger`).
- Типобезопасные вызовы с витрины/админки: **Orval** → пакет `@enot-tea/api-client`.

## Где что лежит
| Артефакт | Путь |
| --- | --- |
| Swagger UI (локально) | `http://localhost:3000/api` (при `SWAGGER_DISABLE` не равном `1`) |
| OpenAPI JSON (экспорт для Orval) | `packages/api-client/spec/openapi.json` |
| Сгенерированный клиент | `packages/api-client/src/generated/api.ts` |
| Экспорт без поднятого HTTP | `pnpm --filter @enot-tea/api openapi:export` |
| Регенерация клиента | `pnpm api-client:gen` |
| Оба шага подряд | `pnpm api-client:regen` |

## Рабочий процесс при изменении API
1. Внести изменения в контроллеры/DTO и при необходимости в тесты.
2. Выполнить `pnpm api-client:regen` из корня репозитория.
3. Закоммитить вместе с кодом обновлённые `spec/openapi.json` и `src/generated/*`.
4. CI (`.github/workflows/ci.yml`) выполняет `pnpm ci:verify` и **`git diff --exit-code`**: незакоммиченный дрейф спецификации/клиента ломает сборку.

## Переменные окружения
| Переменная | Назначение |
| --- | --- |
| `OPENAPI_EXPORT=1` | Внутренний флаг: Prisma **не** подключается к БД при экспорте OpenAPI (см. `PrismaService`). Не нужно задавать вручную для обычного `openapi:export`. |
| `SWAGGER_DISABLE=1` | Отключить Swagger UI в runtime (например, production). JSON по-прежнему можно получить через `openapi:export` в CI. |

## Потребители `@enot-tea/api-client`
- Добавьте зависимость workspace: `"@enot-tea/api-client": "workspace:*"`.
- Orval генерирует относительные URL (`/products`, `/orders/:id`), поэтому frontend-приложение само выбирает origin: через прокси, `fetch`-обёртку или runtime-конфиг окружения.
- Plain-text liveness endpoint `GET /` намеренно исключен из OpenAPI-клиента: он остается доступным в runtime, но не генерируется Orval, чтобы клиент не пытался парсить текст как JSON.

## Проверки
- Контракт OpenAPI: тест `apps/api/src/openapi/openapi.document.test.ts` (ключевые пути и заголовок документа).
- Полный gate: `pnpm ci:verify` (см. `docs/testing/test-strategy.md` и `docs/runbooks/release-process.md`).
