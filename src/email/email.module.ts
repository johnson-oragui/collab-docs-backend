import { Global, Logger, Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailEncryptionService } from './email-encryption.service';
import { EmailOutboxDispatcherService } from './email-outbox-dispatcher.service';
import { EmailOutboxModule } from '@/email-outbox/email-outbox.module';
import { GmailSmtpModule } from '@/gmail-smtp/gmail-smtp.module';
import { EmailTemplateService } from './email-template.service';
import { EmailProcessor } from './email.processor';
import { CustomBullMQModule } from '@/custom-bullmq/custom-bullmq.module';
import { EMAIL_REDIS_CLIENT } from './email.constants';
import { RedisService } from '@/redis/redis.service';
import { IEmailRedisLockClient } from './email.interface';

@Global()
@Module({
  imports: [EmailOutboxModule, CustomBullMQModule, GmailSmtpModule],
  providers: [
    {
      provide: EMAIL_REDIS_CLIENT,
      inject: [RedisService],
      useFactory: (appRedis: RedisService): IEmailRedisLockClient => {
        const logger = new Logger(EmailModule.name);
        logger.log('Acquiring redis client for email-outbox-service provider');
        const getClient = () => appRedis.getClient();

        return {
          set: async (key, value, expiryMode, timeMs, setMode) => {
            const client = getClient() as unknown as {
              set: (
                k: string,
                v: string,
                opts?: { PX?: number; NX?: boolean },
              ) => Promise<string | null>;
            };
            const options: { PX?: number; NX?: boolean } = {};
            if (expiryMode === 'PX') {
              options.PX = timeMs;
            }
            if (setMode === 'NX') {
              options.NX = true;
            }
            return await client.set(key, value, options);
          },
          get: async (key) => await getClient().get(key),
          del: async (key) => await getClient().del(key),
          eval: async (script, numKeys, ...args) => {
            const client = getClient() as unknown as {
              eval?: (
                s: string,
                opts: { keys: string[]; arguments: string[] },
              ) => Promise<unknown>;
              sendCommand?: (cmd: string[]) => Promise<unknown>;
            };
            const keys = args.slice(0, numKeys);
            const argv = args.slice(numKeys);

            if (typeof client.eval === 'function') {
              return await client.eval(script, { keys, arguments: argv });
            }
            if (typeof client.sendCommand === 'function') {
              return await client.sendCommand([
                'EVAL',
                script,
                String(numKeys),
                ...keys,
                ...argv,
              ]);
            }
            throw new Error('Redis client does not support EVAL');
          },
        };
      },
    },
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
