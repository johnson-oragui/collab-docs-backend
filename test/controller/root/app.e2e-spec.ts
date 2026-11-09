import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../../src/app.module';
import { createHttpClient } from '@/test/fixtures/helpers/http-request';
import { createE2eApp } from '@/test/fixtures/create-e2e-app';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof createHttpClient>;

  beforeAll(async () => {
    app = await createE2eApp();
    http = createHttpClient(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET)', async () => {
    return http
      .get('/')
      .expect(200)
      .expect({ message: 'Collab Docs says Hello!' });
  });
});
