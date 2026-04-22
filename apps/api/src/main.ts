import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { formatValidationFieldErrors } from './common/validation-error-format.js';
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
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();