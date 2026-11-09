import 'tsconfig-paths/register';

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
  throw new Error('Test suites must run with NODE_ENV=test and TEST=true.');
}

import dataSource from '../src/database/data-source';

export default async () => {
  console.log('📦 [Jest Global Setup] Running database migrations...');

  try {
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }

    const result = await dataSource.runMigrations({
      transaction: 'all',
      fake: false,
    });
    console.log(
      '✅ [Jest Global Setup] Migrations completed successfully.',
      result,
    );
  } catch (error) {
    console.error('❌ [Jest Global Setup] Migration failed:', error);
    throw error;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
};
