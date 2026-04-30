# Откат и восстановление

## Цель
Дать единый порядок отката релиза и восстановления после сбоев для backend MVP (`apps/api` + PostgreSQL).

## Область
- Применяется к production-инцидентам и неуспешным релизам в контуре `apps/api`.
- Покрывает rollback приложения, восстановление БД из backup и проверки консистентности.
- Процесс эскалации и коммуникаций определяется `docs/runbooks/incident-response.md`.
- Решения go/no-go и release-gates определяются `docs/runbooks/release-process.md`.

## Роли
- Incident Commander (IC): принимает решение rollback/restore и подтверждает выход из инцидента.
- Ops Driver: выполняет технические шаги rollback/restore и фиксирует таймлайн.
- Domain Owner (`orders`/`inventory`): подтверждает бизнес-консистентность после восстановления.
- Communications Owner: публикует статус и подтверждает завершение recovery.

## Когда применять
- После неуспешного релиза с критичным влиянием на заказы/доступность.
- При нарушении инвариантов данных (`orders`, `inventory`).
- При необходимости восстановить БД из backup.

## Предусловия
- Инцидент зарегистрирован, назначены роли IC/Ops/Domain/Comms.
- Определены последняя стабильная версия приложения и доступные backup points.
- Зафиксировано окно работ и ожидаемый риск воздействия.

## Откат приложения
1. Остановить текущий rollout и зафиксировать версию, с которой возникла деградация.
2. Определить целевой rollback-артефакт (последняя стабильная версия).
3. Выполнить откат приложения на целевой артефакт.
4. Запустить минимальный smoke-check:
   - `GET /health/db`;
   - `GET /products`;
   - `POST /orders`;
   - `PATCH /orders/:id/status` (один валидный переход);
   - `PATCH /orders/:id/cancel` (для отдельного заказа).
5. Если smoke-check не проходит, эскалировать до DB Recovery flow.
6. Сообщить промежуточный статус по процессу из `docs/runbooks/incident-response.md`.

## Точки решения
- Выбирать **app rollback only**, если:
  - проблема ограничена версией приложения;
  - после rollback smoke-check стабилен;
  - нет признаков повреждения данных.
- Переходить к **DB recovery**, если:
  - rollback приложения не восстановил критичные сценарии;
  - подтверждено нарушение инвариантов данных;
  - есть риск/факт неконсистентного состояния `orders`/`inventory`.

## Сценарий восстановления БД
1. Подтвердить момент сбоя и выбрать recovery point (timestamp/backup id).
2. Перевести сервис в безопасный режим (остановить запись или ограничить трафик записи).
3. Восстановить БД из проверенного backup согласно инфраструктурному регламенту.
4. Выполнить валидацию схемы:
   - `pnpm --filter "@enot-tea/api" db:validate`
5. Выполнить consistency checks (раздел ниже).
6. Повторить smoke-check API после восстановления.
7. Вернуть обычный режим трафика только после подтверждения IC и Domain Owner.

## Проверки согласованности (обязательны)
- Складские инварианты:
  - нет отрицательных `reserved` или `onHand`;
  - нет записей, где `reserved > onHand`.
- Инварианты заказов:
  - нет заказов в `SHIPPED`, где соответствующие списания склада не отражены;
  - для каждого заказа переходы в `OrderStatusHistory` соответствуют допустимой матрице статусов.
- Контракты API:
  - ключевые endpoint-ы доступны;
  - ошибки API возвращают ожидаемые контрактные коды (`VALIDATION_ERROR`, `INSUFFICIENT_STOCK`, `INVALID_ORDER_STATUS_TRANSITION`, `INVENTORY_INVARIANT_VIOLATION`).

### SQL-процедура проверки склада
Выполнять read-only после restore/rollback и перед возвратом записи. Любая строка в результате требует ручной сверки Domain Owner.

```sql
-- 1. Отрицательные или невозможные остатки.
SELECT id, "productId", "onHand", reserved
FROM "InventoryItem"
WHERE "onHand" < 0 OR reserved < 0 OR reserved > "onHand";

-- 2. Reserved должен соответствовать незавершенным заказам, которые ещё не переданы в доставку.
WITH expected_reserved AS (
  SELECT
    oi."productId",
    COALESCE(SUM(oi.quantity), 0) AS expected
  FROM "OrderItem" oi
  JOIN "Order" o ON o.id = oi."orderId"
  WHERE o.status IN ('NEW', 'CONFIRMED', 'PACKED')
    AND o."fulfillmentStatus" = 'RESERVED'
  GROUP BY oi."productId"
)
SELECT i.id, i."productId", i.reserved, COALESCE(er.expected, 0) AS expected
FROM "InventoryItem" i
LEFT JOIN expected_reserved er ON er."productId" = i."productId"
WHERE i.reserved <> COALESCE(er.expected, 0);

-- 3. Для SHIPPED/DELIVERED заказов должны быть StockMovement списания ORDER_SHIP.
SELECT o.id AS "orderId", o.status, o."fulfillmentStatus"
FROM "Order" o
WHERE o.status IN ('SHIPPED', 'DELIVERED')
  AND NOT EXISTS (
    SELECT 1
    FROM "StockMovement" sm
    WHERE sm."orderId" = o.id
      AND sm.reason = 'ORDER_SHIP'
      AND sm."deltaOnHand" < 0
      AND sm."deltaReserved" < 0
  );

-- 4. Сиротские складские движения по заказам не должны появляться после восстановления.
SELECT sm.id, sm."orderId", sm."orderItemId", sm.reason
FROM "StockMovement" sm
LEFT JOIN "Order" o ON o.id = sm."orderId"
LEFT JOIN "OrderItem" oi ON oi.id = sm."orderItemId"
WHERE (sm."orderId" IS NOT NULL AND o.id IS NULL)
   OR (sm."orderItemId" IS NOT NULL AND oi.id IS NULL);
```

## Проверка после восстановления
- Проверить метрики на окне наблюдения:
  - доступность API;
  - error rate `4xx/5xx` и долю контрактных ошибок `orders`;
  - latency критичных endpoint-ов.
- Убедиться, что новые инцидентные алерты не срабатывают повторно.

## Критерии выхода
- Сервис стабилен в окне наблюдения.
- Критичные проверки прошли без регрессий.
- Принято явное решение IC о закрытии recovery.
- Сформирован postmortem с action items и сроками.
