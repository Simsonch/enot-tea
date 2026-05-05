import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { appConfig } from '../common/app.config.js';

type SaveProductImageInput = {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
};

type SaveProductImageResult = {
  relativePath: string;
  publicUrl: string;
};

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
};

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly storageDir = appConfig.productImage.storageDir;
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = this.normalizeBaseUrl(appConfig.productImage.baseUrl);
    void this.ensureStorageDir();
  }

  async saveProductImage(input: SaveProductImageInput): Promise<SaveProductImageResult> {
    const extension = this.getExtension(input);
    const fileName = `${randomUUID()}${extension}`;
    const relativePath = fileName;
    const absolutePath = resolve(this.storageDir, relativePath);

    await writeFile(absolutePath, input.buffer);

    const publicUrl = `${this.baseUrl}/${relativePath}`;
    return { relativePath, publicUrl };
  }

  async delete(relativePath: string): Promise<void> {
    const absolutePath = resolve(this.storageDir, relativePath);
    try {
      await unlink(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      throw error;
    }
  }

  private async ensureStorageDir() {
    try {
      await mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Не удалось подготовить каталог для хранения файлов: ${this.storageDir}`, err.stack);
      throw error;
    }
  }

  private getExtension({ mimeType }: SaveProductImageInput) {
    const normalizedMimeType = mimeType.toLowerCase();
    if (MIME_EXTENSION_MAP[normalizedMimeType]) {
      return MIME_EXTENSION_MAP[normalizedMimeType];
    }
    return '.bin';
  }

  private normalizeBaseUrl(value: string) {
    const prefixed = value.startsWith('/') ? value : `/${value}`;
    return prefixed.endsWith('/') ? prefixed.slice(0, -1) : prefixed;
  }
}
