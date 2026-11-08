import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseNamingStrategy } from './naming.strategy';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const testConfig = configService.get<boolean | string>('TEST');

        const isTest =
          typeof testConfig === 'boolean'
            ? testConfig
            : typeof testConfig === 'string'
              ? testConfig.toLowerCase() === 'true'
              : false;

        const dbName = isTest
          ? configService.get<string>('TEST_DB_NAME')
          : configService.get<string>('DB_NAME');

        console.log('isTest:', isTest);
        console.log('dbName:', dbName);

        if (isTest && !configService.get<string>('TEST_DB_NAME')) {
          throw new Error('TEST_DB_NAME must be configured when TEST=true');
        }

        return {
          type: 'postgres' as const,
          host: configService.get<string>('DB_HOST'),
          port: Number(configService.get<string>('DB_PORT') || 5432),
          username: configService.get<string>('DB_USER'),
          password: configService.get<string>('DB_PASSWORD'),
          database: dbName,

          // Automatically loads entities registered through TypeOrmModule.forFeature().
          autoLoadEntities: true,

          // Synchronize schema only when running against the dedicated test database.
          synchronize: isTest,

          namingStrategy: new DatabaseNamingStrategy(),
        };
      },
    }),
  ],
})
export class DatabaseModule {}
