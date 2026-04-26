-- Цель: поддержать snapshot для guest checkout и разделить жизненный цикл заказа на статусы заказа, оплаты и fulfillment.
-- Влияние на данные: существующие заказы заполняются из связанного User до того, как snapshot-поля станут обязательными;
-- существующие строки истории статусов классифицируются как история ORDER.

-- Создание enum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'INVOICE_SENT', 'PAID', 'REFUNDED', 'PAYMENT_FAILED');

-- Создание enum
CREATE TYPE "FulfillmentStatus" AS ENUM ('RESERVED', 'HANDED_TO_CARRIER', 'DELIVERED', 'RETURNED');

-- Создание enum
CREATE TYPE "OrderStatusDimension" AS ENUM ('ORDER', 'PAYMENT', 'FULFILLMENT');

-- Изменение таблицы
ALTER TABLE "Order"
ADD COLUMN "customerFullName" TEXT,
ADD COLUMN "customerEmail" TEXT,
ADD COLUMN "customerPhone" TEXT,
ADD COLUMN "shippingAddress" TEXT,
ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "fulfillmentStatus" "FulfillmentStatus" NOT NULL DEFAULT 'RESERVED',
ALTER COLUMN "customerId" DROP NOT NULL;

-- Заполнение существующих legacy-заказов из связанного покупателя.
UPDATE "Order" AS o
SET
  "customerFullName" = COALESCE(
    NULLIF(
      btrim(concat_ws(' ', NULLIF(u."firstName", ''), NULLIF(u."lastName", ''))),
      ''
    ),
    u."email"
  ),
  "customerEmail" = u."email",
  "shippingAddress" = 'Legacy order: shipping address was not captured before guest checkout'
FROM "User" AS u
WHERE o."customerId" = u."id"
  AND (
    o."customerFullName" IS NULL
    OR o."customerEmail" IS NULL
    OR o."shippingAddress" IS NULL
  );

-- Останавливаем миграцию, если в staging есть заказы, которые нельзя детерминированно мигрировать.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Order"
    WHERE "customerFullName" IS NULL
      OR "customerEmail" IS NULL
      OR "shippingAddress" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot backfill guest checkout snapshot for existing orders without linked users';
  END IF;
END $$;

-- Изменение таблицы
ALTER TABLE "Order"
ALTER COLUMN "customerFullName" SET NOT NULL,
ALTER COLUMN "customerEmail" SET NOT NULL,
ALTER COLUMN "shippingAddress" SET NOT NULL;

-- Изменение таблицы
ALTER TABLE "OrderStatusHistory"
ADD COLUMN "statusDimension" "OrderStatusDimension" NOT NULL DEFAULT 'ORDER',
ADD COLUMN "fromPaymentStatus" "PaymentStatus",
ADD COLUMN "toPaymentStatus" "PaymentStatus",
ADD COLUMN "fromFulfillmentStatus" "FulfillmentStatus",
ADD COLUMN "toFulfillmentStatus" "FulfillmentStatus",
ALTER COLUMN "toStatus" DROP NOT NULL;

-- Проверяем, что каждая строка истории записывает ровно одно измерение статуса.
ALTER TABLE "OrderStatusHistory"
ADD CONSTRAINT "OrderStatusHistory_dimension_status_check" CHECK (
  (
    "statusDimension" = 'ORDER'
    AND "toStatus" IS NOT NULL
    AND "fromPaymentStatus" IS NULL
    AND "toPaymentStatus" IS NULL
    AND "fromFulfillmentStatus" IS NULL
    AND "toFulfillmentStatus" IS NULL
  )
  OR (
    "statusDimension" = 'PAYMENT'
    AND "fromStatus" IS NULL
    AND "toStatus" IS NULL
    AND "toPaymentStatus" IS NOT NULL
    AND "fromFulfillmentStatus" IS NULL
    AND "toFulfillmentStatus" IS NULL
  )
  OR (
    "statusDimension" = 'FULFILLMENT'
    AND "fromStatus" IS NULL
    AND "toStatus" IS NULL
    AND "fromPaymentStatus" IS NULL
    AND "toPaymentStatus" IS NULL
    AND "toFulfillmentStatus" IS NOT NULL
  )
);

-- Создание индекса
CREATE INDEX "Order_paymentStatus_createdAt_idx" ON "Order"("paymentStatus", "createdAt");

-- Создание индекса
CREATE INDEX "Order_fulfillmentStatus_createdAt_idx" ON "Order"("fulfillmentStatus", "createdAt");

-- Создание индекса
CREATE INDEX "Order_customerEmail_createdAt_idx" ON "Order"("customerEmail", "createdAt");

-- Создание индекса
CREATE INDEX "OrderStatusHistory_orderId_statusDimension_createdAt_idx" ON "OrderStatusHistory"("orderId", "statusDimension", "createdAt");
