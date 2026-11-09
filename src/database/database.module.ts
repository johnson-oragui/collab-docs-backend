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
        const dbName = configService.get<string>('DB_NAME');

        console.log('[DATABASE MODULE] DB NAME:', dbName);

        return {
          type: 'postgres' as const,
          host: configService.get<string>('DB_HOST'),
          port: Number(configService.get<string>('DB_PORT') || 5432),
          username: configService.get<string>('DB_USER'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_NAME'),

          // Automatically loads entities registered through TypeOrmModule.forFeature().
          autoLoadEntities: true,

          synchronize: false,

          namingStrategy: new DatabaseNamingStrategy(),
        };
      },
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
