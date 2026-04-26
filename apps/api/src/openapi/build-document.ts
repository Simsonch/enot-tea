import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Единая точка сборки OpenAPI-документа (runtime, скрипт экспорта, тесты),
 * чтобы конфигурация не расходилась.
 */
export function buildOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('API Enot Tea')
    .setDescription(
      'HTTP API для MVP: проверка работоспособности, каталог товаров и жизненный цикл заказа.',
    )
    .setVersion('1.0.0')
    .addServer('http://localhost:3000', 'Локальная разработка')
    .build();

  return SwaggerModule.createDocument(app, config);
}
