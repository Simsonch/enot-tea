# ADR 0004: API Error Contract Standard

## Status
Accepted

## Context
В API используются структурированные ошибки, но единый стандарт на уровне архитектурных решений не был явно зафиксирован в ADR. Для стабильной интеграции с будущими `storefront/admin` нужен общий и предсказуемый формат.

## Decision
- Для ошибок API использовать стабильную JSON-структуру:
  - `statusCode`: HTTP status code;
  - `code`: доменный/контрактный код ошибки;
  - `message`: человекочитаемое описание;
  - `errors[]` или `details` при необходимости.
- Для validation-ошибок использовать код `VALIDATION_ERROR`.
- Для бизнес-конфликтов заказов использовать коды:
  - `INSUFFICIENT_STOCK`,
  - `INVALID_ORDER_STATUS_TRANSITION`,
  - `INVENTORY_INVARIANT_VIOLATION`.
- Изменения error-contract выполняются только backward-compatible путем (деприкация, переходный период, документирование).

## Consequences
- Плюсы:
  - единообразная обработка ошибок клиентами;
  - проще писать contract-тесты;
  - ниже риск поломки интеграций.
- Ограничения:
  - для новых доменных модулей требуется заранее резервировать/описывать новые `code`.

## References
- `docs/architecture/orders-api-contract-matrix.md`
- `apps/api/src/orders/orders.service.ts`
- `apps/api/src/common/validation-error-format.ts`
