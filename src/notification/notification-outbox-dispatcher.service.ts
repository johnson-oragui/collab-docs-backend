import { EventEmitter2 } from '@nestjs/event-emitter';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { NotificationOutboxEntity } from '@/notification-outbox/notification-outbox.entity';
import { NotificationEntity } from './notification.entity';
import { NotificationOutboxStatusEnum } from '@/database/database.enums';
import {
  IDispatchNotificationOutboxResult,
  INotificationDeliveryPayload,
  type INotificationRedisLockClient,
} from './notification.interface';
import { RELEASE_LOCK_LUA } from '@/email/email.constants';
import { CustomCronExpression } from './notification.constants';
import { uuidv7 } from 'uuidv7';
export const NOTIFICATION_OUTBOX_REDIS_CLIENT =
  'NOTIFICATION_OUTBOX_REDIS_CLIENT';

export const NOTIFICATION_DELIVERY_EVENT = 'notification.outbox.deliver';

@Injectable()
export class NotificationOutboxDispatcherService {
  private readonly logger = new Logger(
    NotificationOutboxDispatcherService.name,
  );

  private static readonly BATCH_SIZE = 50;
  private static readonly MAX_ATTEMPTS = 5;
  private static readonly BASE_BACKOFF_MS = 2_000;
  private static readonly MAX_BACKOFF_MS = 60_000;
  private static readonly LOCK_KEY = 'lock:notifications:dispatch-outbox';
  private static readonly LOCK_TTL_MS = 4_500;

  private isRunning = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Optional()
    private readonly eventEmitter?: EventEmitter2,
    @Optional()
    @Inject(NOTIFICATION_OUTBOX_REDIS_CLIENT)
    private readonly redis?: INotificationRedisLockClient,
  ) {}

  @Cron(CustomCronExpression.EVERY_13_SECONDS, {
    name: 'dispatchPendingNotificationOutbox',
  })
  async handleDispatchCron(): Promise<void> {
    this.logger.debug('Running notification dispatch');
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    try {
      await this.dispatchPendingOutbox(new Date());
    } catch (error) {
      this.logger.error(
        'Unhandled error in notification outbox dispatcher cron',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.isRunning = false;
    }
  }

  async dispatchPendingOutbox(
    now: Date = new Date(),
  ): Promise<IDispatchNotificationOutboxResult> {
    const lockToken = uuidv7();
    const lockAcquired = await this.acquireLock(lockToken);

    if (!lockAcquired) {
      return {
        skippedDueToLock: true,
        scannedCount: 0,
        dispatchedCount: 0,
        failedCount: 0,
      };
    }

    try {
      const batch = await this.claimDueRecords(now);
      if (batch.length === 0) {
        return {
          skippedDueToLock: false,
          scannedCount: 0,
          dispatchedCount: 0,
          failedCount: 0,
        };
      }

      let dispatchedCount = 0;
      let failedCount = 0;

      for (const item of batch) {
        const ok = await this.processSingleOutboxRecord(item.id, now);
        if (ok) {
          dispatchedCount += 1;
        } else {
          failedCount += 1;
        }
      }
      this.logger.debug(
        `Processed dispatchedCount: ${dispatchedCount}. Failed count: ${failedCount}`,
      );

      return {
        skippedDueToLock: false,
        scannedCount: batch.length,
        dispatchedCount,
        failedCount,
      };
    } finally {
      await this.releaseLock(lockToken);
    }
  }

  private async claimDueRecords(now: Date): Promise<Array<{ id: string }>> {
    return await this.dataSource.transaction(async (entityManager) => {
      const repo = entityManager.getRepository(NotificationOutboxEntity);

      const eligibleStatuses = [
        NotificationOutboxStatusEnum.PENDING,
        NotificationOutboxStatusEnum.FAILED,
      ];

      const candidates = await repo
        .createQueryBuilder('outbox')
        .select(['outbox.id'])
        .where('outbox.status IN (:...statuses)', {
          statuses: eligibleStatuses,
        })
        .andWhere('outbox.nextAttemptAt <= :now', { now })
        .andWhere('outbox.attempts < :maxAttempts', {
          maxAttempts: NotificationOutboxDispatcherService.MAX_ATTEMPTS,
        })
        .orderBy('outbox.nextAttemptAt', 'ASC')
        .addOrderBy('outbox.createdAt', 'ASC')
        .take(NotificationOutboxDispatcherService.BATCH_SIZE)
        .getMany();

      const claimedIds: Array<{ id: string }> = [];

      for (const record of candidates) {
        const updateResult = await repo
          .createQueryBuilder()
          .update(NotificationOutboxEntity)
          .set({
            status:
              (NotificationOutboxStatusEnum as Record<string, unknown>)
                .PROCESSING ?? NotificationOutboxStatusEnum.PENDING,
          } as never)
          .where('id = :id', { id: record.id })
          .andWhere('status IN (:...statuses)', {
            statuses: eligibleStatuses,
          })
          .execute();

        if ((updateResult.affected ?? 0) > 0) {
          claimedIds.push({ id: record.id });
        }
      }
      this.logger.debug(
        `Claimed PENDING and FAILED records. ClaimedIds: ${JSON.stringify(claimedIds)}`,
      );

      return claimedIds;
    });
  }

  async processSingleOutboxRecord(
    outboxId: string,
    now: Date = new Date(),
  ): Promise<boolean> {
    const outboxRepo = this.dataSource.getRepository(NotificationOutboxEntity);
    const record = await outboxRepo.findOne({ where: { id: outboxId } });

    if (!record) {
      return false;
    }

    const nextAttempt = record.attempts + 1;

    try {
      const notificationRepo =
        this.dataSource.getRepository(NotificationEntity);
      const notification = await notificationRepo.findOne({
        where: { id: record.notificationId },
      });

      const organisationId =
        (notification as unknown as { organisationId?: string } | null)
          ?.organisationId ?? undefined;

      const eventPayload: INotificationDeliveryPayload = {
        outboxId: record.id,
        notificationId: record.notificationId,
        organisationId,
        recipientMembershipId: record.recipientMembershipId,
        eventType: record.eventType,
        attempt: nextAttempt,
      };

      await this.emitDeliveryEvent(eventPayload);

      const sentStatus =
        (NotificationOutboxStatusEnum as Record<string, unknown>).SENT ??
        (NotificationOutboxStatusEnum as Record<string, unknown>).DISPATCHED ??
        NotificationOutboxStatusEnum.PENDING;

      await outboxRepo
        .createQueryBuilder()
        .update(NotificationOutboxEntity)
        .set({
          status: sentStatus as never,
          attempts: nextAttempt,
          dispatchedAt: now,
          lastError: null,
        })
        .where('id = :id', { id: record.id })
        .execute();
      this.logger.debug(`Processed sigle record: ${record.id}`);

      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown outbox delivery error';
      const backoffMs = Math.min(
        NotificationOutboxDispatcherService.BASE_BACKOFF_MS *
          2 ** Math.max(0, nextAttempt - 1),
        NotificationOutboxDispatcherService.MAX_BACKOFF_MS,
      );
      const nextAttemptAt = new Date(now.getTime() + backoffMs);
      const exhausted =
        nextAttempt >= NotificationOutboxDispatcherService.MAX_ATTEMPTS;

      const failedStatus =
        exhausted &&
        (NotificationOutboxStatusEnum as Record<string, unknown>).DEAD_LETTER
          ? (NotificationOutboxStatusEnum as Record<string, unknown>)
              .DEAD_LETTER
          : NotificationOutboxStatusEnum.FAILED;

      await outboxRepo
        .createQueryBuilder()
        .update(NotificationOutboxEntity)
        .set({
          status: failedStatus as never,
          attempts: nextAttempt,
          nextAttemptAt,
          lastError: message.slice(0, 1000),
        })
        .where('id = :id', { id: record.id })
        .execute();

      this.logger.warn(
        `Outbox record ${record.id} (membership=${record.recipientMembershipId}, event=${record.eventType}) attempt ${nextAttempt} failed (${exhausted ? 'exhausted' : `retry in ${backoffMs}ms`}): ${message}`,
      );

      return false;
    }
  }

  /**
   * Sends payload to emitter, emitter sends to connected member socket connection
   * @param payload
   * @returns
   */
  protected async emitDeliveryEvent(
    payload: INotificationDeliveryPayload,
  ): Promise<void> {
    if (!this.eventEmitter) {
      return;
    }

    await this.eventEmitter.emitAsync(NOTIFICATION_DELIVERY_EVENT, payload);
  }

  private async acquireLock(token: string): Promise<boolean> {
    if (!this.redis) {
      return true;
    }

    const result = await this.redis.set(
      NotificationOutboxDispatcherService.LOCK_KEY,
      token,
      'PX',
      NotificationOutboxDispatcherService.LOCK_TTL_MS,
      'NX',
    );
    return result === 'OK';
  }

  private async releaseLock(token: string): Promise<void> {
    if (!this.redis) {
      return;
    }

    try {
      if (typeof this.redis.eval === 'function') {
        await this.redis.eval(
          RELEASE_LOCK_LUA,
          1,
          NotificationOutboxDispatcherService.LOCK_KEY,
          token,
        );
        return;
      }

      const currentValue = await this.redis.get(
        NotificationOutboxDispatcherService.LOCK_KEY,
      );
      if (currentValue === token) {
        await this.redis.del(NotificationOutboxDispatcherService.LOCK_KEY);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to release lock "${NotificationOutboxDispatcherService.LOCK_KEY}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
