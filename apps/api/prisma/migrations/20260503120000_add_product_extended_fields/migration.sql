-- Цель: расширить каталог товаров дополнительными атрибутами и хранением изображений.
-- Влияние на данные: только nullable-колонки без значения по умолчанию; существующие записи не затрагиваются.

ALTER TABLE "Product"
  ADD COLUMN "productType" TEXT,
  ADD COLUMN "category" TEXT,
  ADD COLUMN "discountPercent" INTEGER,
  ADD COLUMN "promotionLabel" TEXT,
  ADD COLUMN "discountedPriceMinor" INTEGER,
  ADD COLUMN "imagePath" TEXT,
  ADD COLUMN "imageUrl" TEXT;
