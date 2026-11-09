import { config } from 'dotenv';
import { resolve } from 'path';

const result = config({
  path: resolve(process.cwd(), '.env.test'),
  override: true,
});

if (result.error) {
  throw new Error(`Unable to load .env.test: ${result.error.message}`);
}

if (process.env.NODE_ENV !== 'test' || process.env.TEST !== 'true') {
  throw new Error('E2E tests must run with NODE_ENV=test and TEST=true.');
}
