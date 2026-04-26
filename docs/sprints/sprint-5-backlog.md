# Бэклог спринта 5

## Приоритеты

- `P0`: обязательно для exit Sprint 5.
- `P1`: по емкости.
- `P2`: задел под следующий спринт.

## Задачи

| ID | Priority | Task | Owner | Dependencies | Deliverable |
|----|----------|------|-------|--------------|-------------|
| S5-001 | P0 | Prisma: Order guest snapshot, nullable customerId, PaymentStatus, FulfillmentStatus, миграция | Backend Lead | - | `apps/api/prisma/schema.prisma`, `prisma/migrations/*` |
| S5-002 | P0 | OrdersService: create guest order, reserve, движения `StockMovement` | Backend Lead | S5-001 | `apps/api/src/orders/*` |
| S5-003 | P0 | Переходы: invoice sent, payment confirmed, handoff to delivery, delivered, cancel - матрица + история | Backend Lead | S5-001 | сервис + тесты |
| S5-004 | P0 | Конкурентный тест резерва (два заказа на последний available) | Backend Lead | S5-002 | `orders.service.test.ts` |
| S5-005 | P0 | HTTP contract tests: guest payload, коды ошибок, backward-compat where applicable | Backend Lead | S5-002 | `orders.controller.http.test.ts` |
| S5-006 | P0 | OpenAPI export + Orval; обновить contract matrix | Backend Lead | S5-002 | `spec/openapi.json`, `packages/api-client/*`, [orders-api-contract-matrix](../architecture/orders-api-contract-matrix.md) |
| S5-007 | P1 | Dокументировать точку списания onHand (ADR note или абзац в guest-checkout) | Architect | S5-003 | [guest-checkout-mvp-lifecycle](../architecture/guest-checkout-mvp-lifecycle.md) / ADR 0005 заметка |
| S5-008 | P2 | Сид или скрипт владельца (если договоренность «минимум auth в S5») | Backend Lead | S5-001 | по решению команды |

## Статус

- [ ] Все P0 запланированы и назначены.
- [ ] `pnpm ci:verify` - green.

## Ворота релиза: выход из спринта 5

- [ ] `pnpm --filter @enot-tea/api` typecheck, test, build, db:validate.
- [ ] `pnpm api-client:regen` + нет uncommitted diff в spec/generated.
- [ ] Доки matrix и ADR 0003/0005 согласованы с фактом в коде.

## Примечания

- Ломающие публичные API - только с явной меткой в PR и обновлением matrix.
