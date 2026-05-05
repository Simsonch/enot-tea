import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStorageService } from './file-storage.service.js';
import { appConfig } from '../common/app.config.js';

test('FileStorageService сохраняет и удаляет изображение товара', async (t) => {
  const tmpRoot = await mkdtemp(join(tmpdir(), 'product-images-'));
  const previousConfig = {
    ...appConfig.productImage,
    allowedMimeTypes: [...appConfig.productImage.allowedMimeTypes],
  };

  appConfig.productImage.storageDir = tmpRoot;
  appConfig.productImage.baseUrl = '/uploads/test-products';

  t.after(async () => {
    appConfig.productImage.storageDir = previousConfig.storageDir;
    appConfig.productImage.baseUrl = previousConfig.baseUrl;
    appConfig.productImage.maxSizeBytes = previousConfig.maxSizeBytes;
    appConfig.productImage.allowedMimeTypes = [...previousConfig.allowedMimeTypes];
    await rm(tmpRoot, { recursive: true, force: true });
  });

  const service = new FileStorageService();

  const payload = Buffer.from('image-data');
  const result = await service.saveProductImage({
    buffer: payload,
    originalName: 'preview.png',
    mimeType: 'image/png',
  });

  assert.equal(result.publicUrl.startsWith('/uploads/test-products/'), true);
  const saved = await readFile(join(tmpRoot, result.relativePath));
  assert.equal(saved.equals(payload), true);

  await service.delete(result.relativePath);
  await assert.rejects(readFile(join(tmpRoot, result.relativePath)));
});
