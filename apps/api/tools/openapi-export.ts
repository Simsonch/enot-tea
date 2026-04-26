import 'reflect-metadata';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Must be set before any module that runs Prisma onModuleInit is loaded. */
process.env.OPENAPI_EXPORT = '1';

const __dirname = dirname(fileURLToPath(import.meta.url));
/** `tools` lives under `apps/api/tools` → monorepo root is three levels up. */
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
