import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { mkdir } from 'node:fs/promises';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { formatValidationFieldErrors } from './common/validation-error-format.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import { buildOpenApiDocument } from './openapi/build-document.js';
import { AppModule } from './app.module.js';
import { appConfig } from './common/app.config.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(helmet());
  app.enableCors({
    origin: appConfig.runtime.corsAllowedOrigins,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86_400,
  });
  app.useGlobalFilters(new HttpExceptionFilter(appConfig.runtime.isProduction));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) =>
        new BadRequestException({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Входные данные не прошли проверку.',
          errors: formatValidationFieldErrors(errors),
        }),
    }),
  );

  const { storageDir, baseUrl } = appConfig.productImage;
  await mkdir(storageDir, { recursive: true });
  const staticPrefix = baseUrl.startsWith('/') ? baseUrl : `/${baseUrl}`;
  const normalizedPrefix = staticPrefix.endsWith('/') ? staticPrefix : `${staticPrefix}/`;
  app.useStaticAssets(storageDir, {
    prefix: normalizedPrefix,
    index: false,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  });

  if (appConfig.runtime.swaggerEnabled) {
    const document = buildOpenApiDocument(app);
    SwaggerModule.setup('api', app, document, {
      customSiteTitle: 'API Enot Tea',
    });
  }

  await app.listen(appConfig.runtime.port);
}
bootstrap();
