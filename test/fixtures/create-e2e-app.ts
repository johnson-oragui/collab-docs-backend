import {
  INestApplication,
  ModuleMetadata,
  ValidationPipe,
  ValidationPipeOptions,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ExpressAdapter } from '@nestjs/platform-express';
import { useContainer } from 'class-validator';
import express from 'express';

import { AppModule } from '@/app.module';
import { AllExceptionsFilter } from '@/commons/middlewares/http-exception.filter';
import { GmailSmtpService } from '@/gmail-smtp/gmail-smtp.service';
import { EmailProcessor } from '@/email/email.processor';
import { EmailOutboxDispatcherService } from '@/email/email-outbox-dispatcher.service';
import { registerGraphqlEnums } from '@/commons/grapgql/registered-enums';

registerGraphqlEnums();

export async function createE2eApp(
  metadata?: ModuleMetadata,
  validationPipeOptions: ValidationPipeOptions = {
    whitelist: true,
    forbidNonWhitelisted: false,
    forbidUnknownValues: true,
    transform: true,
  },
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
    })
    .overrideProvider(EmailProcessor)
    .useValue({
      process: jest.fn().mockResolvedValue(undefined),
      onCompleted: jest.fn().mockResolvedValue(undefined),
      onFailed: jest.fn().mockResolvedValue(undefined),
    })
    .overrideProvider(EmailOutboxDispatcherService)
    .useValue({
      dispatchPendingEmails: jest.fn().mockResolvedValue(undefined),
      dispatchBatch: jest.fn().mockResolvedValue(undefined),
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

  app.useGlobalPipes(new ValidationPipe(validationPipeOptions));

  app.useGlobalFilters(new AllExceptionsFilter());

  await app.init();

  return app;
}
