import { generateRandomIPv4 } from '@/commons/util/generateRandomIPv4';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

export const E2E_USER_AGENT = 'collab-docs-e2e-tests';
const normalisePathname = (path: string) => {
  return path.startsWith('/api/v1/') || path.startsWith('/api/graphql')
    ? path
    : `/api/v1/${path}`;
};

export function createHttpClient(app: INestApplication) {
  const server = app.getHttpServer();

  return {
    get(path: string) {
      return request(server)
        .get(normalisePathname(path))
        .set('X-Forwarded-For', generateRandomIPv4())
        .set('User-Agent', E2E_USER_AGENT);
    },

    post(path: string) {
      return request(server)
        .post(normalisePathname(path))
        .set('X-Forwarded-For', generateRandomIPv4())
        .set('User-Agent', E2E_USER_AGENT);
    },

    patch(path: string) {
      return request(server)
        .patch(normalisePathname(path))
        .set('X-Forwarded-For', generateRandomIPv4())
        .set('User-Agent', E2E_USER_AGENT);
    },

    put(path: string) {
      return request(server)
        .put(normalisePathname(path))
        .set('X-Forwarded-For', generateRandomIPv4())
        .set('User-Agent', E2E_USER_AGENT);
    },

    delete(path: string) {
      return request(server)
        .delete(normalisePathname(path))
        .set('X-Forwarded-For', generateRandomIPv4())
        .set('User-Agent', E2E_USER_AGENT);
    },
  };
}
