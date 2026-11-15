import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

import { EMAIL_QUEUE } from './email.constants';
import { EmailService } from './email.service';
import { EmailEncryptionService } from './email-encryption.service';
import { EmailOutboxDispatcherService } from './email-outbox-dispatcher.service';
import { EmailOutboxModule } from '@/email-outbox/email-outbox.module';
import { GmailSmtpModule } from '@/gmail-smtp/gmail-smtp.module';
import { EmailTemplateService } from './email-template.service';
import { EmailProcessor } from './email.processor';

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

@Global()
@Module({
  imports: [
    EmailOutboxModule,
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
    GmailSmtpModule,
  ],
  providers: [
    EmailService,
    EmailEncryptionService,
    EmailOutboxDispatcherService,
    EmailTemplateService,
    EmailProcessor,
  ],
  exports: [
    EmailService,
    EmailEncryptionService,
    EmailOutboxDispatcherService,
    EmailTemplateService,
    EmailProcessor,
    EmailTemplateService,
  ],
})
export class EmailModule {}
