import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ExpressAdapter } from '@nestjs/platform-express';
import { useContainer } from 'class-validator';
import express from 'express';

import { AppModule } from '@/app.module';
import { AllExceptionsFilter } from '@/commons/middlewares/http-exception.filter';

export async function createE2eApp(): Promise<INestApplication> {
  const expressApp = express();

  expressApp.set('trust proxy', true);

  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication(
    new ExpressAdapter(expressApp),
  );

  const configService = app.get(ConfigService);

  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN', '')?.split(','),
    methods: 'GET,POST,PATCH,PUT,DELETE',
    credentials: true,
    allowedHeaders: [
      'Accept',
      'Authorization',
      'Content-Type',
      'X-REFRESH-TOKEN',
    ],
    exposedHeaders: [
      'x-request-id',
      'X-REFRESH-TOKEN',
      'X-REQUEST-ID',
    ],
  });

  app.setGlobalPrefix('');
  app.enableVersioning();

  useContainer(app.select(AppModule), {
    fallbackOnErrors: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      forbidUnknownValues: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  await app.init();

  return app;
}