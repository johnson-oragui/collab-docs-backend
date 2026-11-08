import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { DatabaseNamingStrategy } from './naming.strategy';

config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // Point to compiled JavaScript files in 'dist' for production/CLI safety
  // Support both conventional entity filenames and entity.ts filenames.
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
