/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import express from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './commons/middlewares/http-exception.filter';
import { ExpressAdapter } from '@nestjs/platform-express';
import { useContainer } from 'class-validator';

async function bootstrap() {
  try {
    const expressApp = express();
    expressApp.set('trust proxy', true);
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
      {
        bufferLogs: true,
        logger: ['log', 'error', 'warn', 'debug', 'verbose'],
      },
    );

    app.enableCors({
      origin: '*',
      methods: 'GET,POST,PATCH,PUT,DELETE',
      credentials: true,
      allowedHeaders: 'Content-Type, Accept, Authorization',
      exposedHeaders: ['x-request-id'],
    });
    app.setGlobalPrefix('');
    app.enableVersioning();

    // Enable DI for class-validator
    useContainer(app.select(AppModule), { fallbackOnErrors: true });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
        transform: true,
      }),
    );

    app.useGlobalFilters(new AllExceptionsFilter());

    app.enableShutdownHooks();

    const config = new DocumentBuilder()
      .setTitle('CollabDocs API')
      .setDescription('The Backend API for Collaborative Documentation')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        'bearer',
      )
      // .addGlobalParameters({
      //   name: 'x-request-id',
      //   in: 'header',
      //   required: false,
      //   description: 'Unique ID for tracing requests',
      // })
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
      useGlobalPrefix: true,
    });

    const configService = app.get(ConfigService);

    process.on('unhandledRejection', (reason) => {
      console.error('Unhandled Rejection at:', reason);
    });

    process.on('uncaughtException', (err) => {
      console.error('Uncaught Exception thrown:', err);
      process.exit(1);
    });

    const port = configService.get<number>('PORT') || 7005;
    await app.listen(port);
    console.log(`Application is running on: PORT: ${port}`);
  } catch (error) {
    console.error(`Application failed to start: ${(error as Error).message}`);
    process.exit(1);
  }
}
bootstrap().catch((err) => {
  console.error('Critical failure during boot:', err);
  process.exit(1);
});
