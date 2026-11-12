import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
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
    return await request(app.getHttpServer())
      .get('/')
      .set('User-Agent', 'Root-user')
      .expect(200)
      .expect({ message: 'Collab Docs says Hello!' });
  });
});
