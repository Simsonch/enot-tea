-- Цель: хранить метаданные попыток transactional email для Sprint 8 admin indicator/manual resend.
-- Влияние на данные: новая таблица не меняет существующие заказы и не хранит body письма или PII.

CREATE TABLE "NotificationAttempt" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NotificationAttempt_orderId_createdAt_idx" ON "NotificationAttempt"("orderId", "createdAt");
CREATE INDEX "NotificationAttempt_orderId_status_createdAt_idx" ON "NotificationAttempt"("orderId", "status", "createdAt");

ALTER TABLE "NotificationAttempt"
ADD CONSTRAINT "NotificationAttempt_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
