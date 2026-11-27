import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationEntity } from './notification.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { NotificationRecipientEntity } from '@/notification-recipients/notification-recipients.entity';
import { NotificationOutboxEntity } from '@/notification-outbox/notification-outbox.entity';
import { NotificationDraftCleanupService } from './notification-draft-cleanup.service';
import { RedisService } from '@/redis/redis.service';
import { NOTIFICATION_REDIS_CLIENT } from './notification.constants';
import { INotificationRedisLockClient } from './notification.interface';
import {
  NOTIFICATION_OUTBOX_REDIS_CLIENT,
  NotificationOutboxDispatcherService,
} from './notification-outbox-dispatcher.service';
import { WebsocketGatewayModule } from '@/websocket-gateway/websocket-gateway.module';
import { NotificationDeliveryWorker } from './notification-delivery-worker';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationEntity,
      OrganisationMembershipEntity,
      NotificationRecipientEntity,
      NotificationOutboxEntity,
    ]),
    WebsocketGatewayModule,
  ],
  providers: [
    {
      provide: NOTIFICATION_REDIS_CLIENT,
      inject: [RedisService],
      useFactory: (appRedis: RedisService): INotificationRedisLockClient => {
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
          get: async (key) => {
            return await getClient().get(key);
          },
          del: async (key) => {
            return await getClient().del(key);
          },
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
    NotificationDraftCleanupService,
    {
      provide: NOTIFICATION_OUTBOX_REDIS_CLIENT,
      inject: [RedisService],
      useFactory: (appRedis: RedisService): INotificationRedisLockClient => {
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
    NotificationOutboxDispatcherService,
    NotificationDeliveryWorker,
  ],
  exports: [
    TypeOrmModule,
    NotificationDraftCleanupService,
    NotificationOutboxDispatcherService,
    NOTIFICATION_OUTBOX_REDIS_CLIENT,
    NOTIFICATION_REDIS_CLIENT,
    NotificationDeliveryWorker,
  ],
})
export class NotificationModule {}
