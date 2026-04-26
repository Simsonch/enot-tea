import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * One place to build the OpenAPI document (runtime, export script, and tests)
 * to avoid configuration drift.
 */
export function buildOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Enot Tea API')
    .setDescription('MVP HTTP API: health, product catalog, and order lifecycle.')
    .setVersion('1.0.0')
    .addServer('http://localhost:3000', 'Local development')
    .build();

  return SwaggerModule.createDocument(app, config);
}
