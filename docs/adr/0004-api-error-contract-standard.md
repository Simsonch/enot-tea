# ADR 0004: стандарт контракта ошибок API

## Статус
Accepted

## Контекст
В API используются структурированные ошибки, но единый стандарт на уровне архитектурных решений не был явно зафиксирован в ADR. Для стабильной интеграции с будущими `storefront/admin` нужен общий и предсказуемый формат.

## Решение
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

## Контроль
- Error-contract должен быть согласован между:
  - `docs/architecture/orders-api-contract-matrix.md`;
  - API boundary (`ValidationPipe`, Nest exceptions);
  - HTTP/service тестами `orders`.
- Для любого нового доменного `code` обязательны:
  - описание в contract docs;
  - минимум один негативный тест на код и HTTP status;
  - подтверждение отсутствия breaking change для текущих клиентов.

## Последствия
- Плюсы:
  - единообразная обработка ошибок клиентами;
  - проще писать contract-тесты;
  - ниже риск поломки интеграций.
- Ограничения:
  - для новых доменных модулей требуется заранее резервировать/описывать новые `code`.

## Ссылки
- `docs/architecture/orders-api-contract-matrix.md`
- `apps/api/src/orders/orders.service.ts`
- `apps/api/src/common/validation-error-format.ts`
- `apps/api/src/orders/orders.controller.http.test.ts`
- `apps/api/src/orders/orders.service.test.ts`
