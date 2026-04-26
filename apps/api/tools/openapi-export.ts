import 'reflect-metadata';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Нужно задать до загрузки любого модуля, где Prisma вызывает onModuleInit. */
process.env.OPENAPI_EXPORT = '1';

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Каталог `tools` в `apps/api/tools` — корень монорепо на три уровня выше. */
const specPath = resolve(__dirname, '../../../packages/api-client/spec/openapi.json');

const { NestFactory } = await import('@nestjs/core');
const { AppModule } = await import('../src/app.module.js');
const { buildOpenApiDocument } = await import('../src/openapi/build-document.js');

const app = await NestFactory.create(AppModule, { logger: false });
try {
  const document = buildOpenApiDocument(app);
  mkdirSync(dirname(specPath), { recursive: true });
  writeFileSync(specPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
} finally {
  await app.close();
}
