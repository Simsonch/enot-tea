import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { formatValidationFieldErrors } from './common/validation-error-format.js';
import { buildOpenApiDocument } from './openapi/build-document.js';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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

  if (process.env.SWAGGER_DISABLE !== '1') {
    const document = buildOpenApiDocument(app);
    SwaggerModule.setup('api', app, document, {
      customSiteTitle: 'Enot Tea API',
    });
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();