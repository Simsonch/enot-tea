import { resolve } from 'node:path';

const DEFAULT_PRODUCT_IMAGE_STORAGE_DIR = './storage/products';
const DEFAULT_PRODUCT_IMAGE_BASE_URL = '/uploads/products';
const DEFAULT_PRODUCT_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MiB
const DEFAULT_CORS_ALLOWED_ORIGINS = ['http://localhost:3100', 'http://localhost:3200'];
const DEFAULT_LOGIN_THROTTLE_LIMIT = 5;
const DEFAULT_LOGIN_THROTTLE_TTL_MS = 60_000;
const DEFAULT_ORDER_CREATE_THROTTLE_LIMIT = 20;
const DEFAULT_ORDER_CREATE_THROTTLE_TTL_MS = 60_000;
const DEFAULT_GLOBAL_THROTTLE_LIMIT = 120;
const DEFAULT_GLOBAL_THROTTLE_TTL_MS = 60_000;

export type ProductImageConfig = {
  storageDir: string;
  baseUrl: string;
  maxSizeBytes: number;
  allowedMimeTypes: string[];
};

export type AppConfig = {
  runtime: {
    isProduction: boolean;
    port: number;
    swaggerEnabled: boolean;
    corsAllowedOrigins: string[];
  };
  throttling: {
    global: {
      limit: number;
      ttlMs: number;
    };
    authLogin: {
      limit: number;
      ttlMs: number;
    };
    orderCreate: {
      limit: number;
      ttlMs: number;
    };
  };
  productImage: ProductImageConfig;
};

function resolveStorageDir(pathValue: string | undefined) {
  return resolve(process.cwd(), pathValue ?? DEFAULT_PRODUCT_IMAGE_STORAGE_DIR);
}

function parseNumberEnv(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseCsvEnv(value: string | undefined, fallback: string[]) {
  const parsed = (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return parsed.length > 0 ? parsed : fallback;
}

function getRequiredJwtSecret(isProduction: boolean) {
  const secret = process.env.JWT_SECRET;
  if (isProduction && !secret) {
    throw new Error('JWT_SECRET is required when NODE_ENV=production.');
  }
  return secret;
}

const isProduction = process.env.NODE_ENV === 'production';
const swaggerEnabled = process.env.SWAGGER_DISABLE !== '1' && !isProduction;
getRequiredJwtSecret(isProduction);

export const appConfig: AppConfig = {
  runtime: {
    isProduction,
    port: Number.parseInt(process.env.PORT ?? '', 10) || 3000,
    swaggerEnabled,
    corsAllowedOrigins: parseCsvEnv(process.env.CORS_ALLOWED_ORIGINS, DEFAULT_CORS_ALLOWED_ORIGINS),
  },
  throttling: {
    global: {
      limit: parseNumberEnv(process.env.THROTTLE_GLOBAL_LIMIT, DEFAULT_GLOBAL_THROTTLE_LIMIT),
      ttlMs: parseNumberEnv(process.env.THROTTLE_GLOBAL_TTL_MS, DEFAULT_GLOBAL_THROTTLE_TTL_MS),
    },
    authLogin: {
      limit: parseNumberEnv(process.env.THROTTLE_AUTH_LOGIN_LIMIT, DEFAULT_LOGIN_THROTTLE_LIMIT),
      ttlMs: parseNumberEnv(process.env.THROTTLE_AUTH_LOGIN_TTL_MS, DEFAULT_LOGIN_THROTTLE_TTL_MS),
    },
    orderCreate: {
      limit: parseNumberEnv(process.env.THROTTLE_ORDER_CREATE_LIMIT, DEFAULT_ORDER_CREATE_THROTTLE_LIMIT),
      ttlMs: parseNumberEnv(process.env.THROTTLE_ORDER_CREATE_TTL_MS, DEFAULT_ORDER_CREATE_THROTTLE_TTL_MS),
    },
  },
  productImage: {
    storageDir: resolveStorageDir(process.env.PRODUCT_IMAGE_STORAGE_DIR),
    baseUrl: process.env.PRODUCT_IMAGE_BASE_URL ?? DEFAULT_PRODUCT_IMAGE_BASE_URL,
    maxSizeBytes: parseNumberEnv(process.env.PRODUCT_IMAGE_MAX_SIZE_BYTES, DEFAULT_PRODUCT_IMAGE_MAX_SIZE_BYTES),
    allowedMimeTypes: parseCsvEnv(process.env.PRODUCT_IMAGE_ALLOWED_MIME_TYPES, ['image/png', 'image/jpeg']),
  },
};
