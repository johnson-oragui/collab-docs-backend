import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { DatabaseNamingStrategy } from './naming.strategy';
import { resolve } from 'path';

const isTestEnv =
  process.env.NODE_ENV === 'test' || process.env.TEST === 'true';
const envFile = isTestEnv ? '.env.test' : '.env';

config(
  isTestEnv
    ? { path: resolve(process.cwd(), envFile), override: true }
    : undefined,
);

console.log(`[DataSource] Loading environment from: ${envFile}`);
console.log(`[DataSource] Connecting to database: ${process.env.DB_NAME}`);

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // __dirname resolves to src/database during ts-node execution
  // and dist/database after compilation.
  entities: [
    `${__dirname}/../**/*.entity{.ts,.js}`,
    `${__dirname}/../**/entity{.ts,.js}`,
  ],

  // Load migrations relative to the current DataSource location.
  migrations: [`${__dirname}/migrations/*{.ts,.js}`],
  synchronize: false, // Must always be false when recording changes via migrations!
  namingStrategy: new DatabaseNamingStrategy(),
});
