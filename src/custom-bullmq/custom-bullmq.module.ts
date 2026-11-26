import { EMAIL_QUEUE } from '@/email/email.constants';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

function getRedisConnection(redisUrl: string) {
  const url = new URL(redisUrl);

  if (!['redis:', 'rediss:'].includes(url.protocol)) {
    throw new Error('REDIS_URL must use redis:// or rediss://');
  }

  const database = url.pathname.replace(/^\/+/, '');

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,

    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),

    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),

    ...(database ? { db: Number(database) } : {}),

    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),

    // BullMQ workers require this setting.
    maxRetriesPerRequest: null,
  };
}

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: getRedisConnection(
          configService.getOrThrow<string>('REDIS_URL'),
        ),
      }),
    }),

    BullModule.registerQueue({
      name: EMAIL_QUEUE,
    }),
  ],
  exports: [BullModule],
})
export class CustomBullMQModule {}
