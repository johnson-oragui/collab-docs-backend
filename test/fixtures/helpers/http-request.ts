import { INestApplication } from '@nestjs/common';
import request from 'supertest';

export const E2E_USER_AGENT = 'collab-docs-e2e-tests';

export function createHttpClient(app: INestApplication) {
  const server = app.getHttpServer();

  return {
    get(path: string) {
      return request(server)
        .get(path.startsWith("/api/v1/") ? path: `/api/v1/${path}`)
        .set('User-Agent', E2E_USER_AGENT);
    },

    post(path: string) {
      return request(server)
        .post(path.startsWith("/api/v1/") ? path: `/api/v1/${path}`)
        .set('User-Agent', E2E_USER_AGENT);
    },

    patch(path: string) {
      return request(server)
        .patch(path.startsWith("/api/v1/") ? path: `/api/v1/${path}`)
        .set('User-Agent', E2E_USER_AGENT);
    },

    put(path: string) {
      return request(server)
        .put(path.startsWith("/api/v1/") ? path: `/api/v1/${path}`)
        .set('User-Agent', E2E_USER_AGENT);
    },

    delete(path: string) {
      return request(server)
        .delete(path.startsWith("/api/v1/") ? path: `/api/v1/${path}`)
        .set('User-Agent', E2E_USER_AGENT);
    },
  };
}