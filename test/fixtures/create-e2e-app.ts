import {
  INestApplication,
  ModuleMetadata,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ExpressAdapter } from '@nestjs/platform-express';
import { useContainer } from 'class-validator';
import express from 'express';

import { AppModule } from '@/app.module';
import { AllExceptionsFilter } from '@/commons/middlewares/http-exception.filter';
import { GmailSmtpService } from '@/gmail-smtp/gmail-smtp.service';

export async function createE2eApp(
  metadata?: ModuleMetadata,
): Promise<INestApplication> {
  const expressApp = express();

  expressApp.set('trust proxy', true);

  const moduleBuilder = Test.createTestingModule({
    imports: [AppModule, ...(metadata?.imports ? metadata.imports : [])],
    providers: [...(metadata?.providers ? metadata.providers : [])],
    exports: [...(metadata?.exports ? metadata.exports : [])],
    controllers: [...(metadata?.controllers ? metadata.controllers : [])],
  })
    .overrideProvider(GmailSmtpService)
    .useValue({
      verifyConnection: jest.fn().mockResolvedValue(undefined),
      send: jest.fn().mockResolvedValue(undefined),
    });

  const moduleFixture = await moduleBuilder.compile();

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
    exposedHeaders: ['x-request-id', 'X-REFRESH-TOKEN', 'X-REQUEST-ID'],
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
