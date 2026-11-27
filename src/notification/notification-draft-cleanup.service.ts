import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, LessThanOrEqual } from 'typeorm';

import { NotificationStatusEnum } from '@/database/database.enums';
import { NotificationRecipientEntity } from '@/notification-recipients/notification-recipients.entity';
import { NotificationOutboxEntity } from '@/notification-outbox/notification-outbox.entity';
import { NotificationEntity } from './notification.entity';
import { uuidv7 } from 'uuidv7';
import { RELEASE_LOCK_LUA } from '@/email/email.constants';
import {
  CustomCronExpression,
  NOTIFICATION_REDIS_CLIENT,
} from './notification.constants';
import {
  ICleanupExpiredDraftsResult,
  type INotificationRedisLockClient,
} from './notification.interface';

@Injectable()
export class NotificationDraftCleanupService {
  private readonly logger = new Logger(NotificationDraftCleanupService.name);
  private static readonly BATCH_SIZE = 100;
  private static readonly LOCK_KEY =
    'lock:notifications:cleanup-expired-drafts';
  private static readonly LOCK_TTL_MS = 120_000;
  private isRunning = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Optional()
    @Inject(NOTIFICATION_REDIS_CLIENT)
    private readonly redis?: INotificationRedisLockClient,
  ) {}

  @Cron(CustomCronExpression.EVERY_12_HOURS, {
    name: 'cleanupExpiredNotificationDrafts',
  })
  async handleExpiredDraftsCron(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn(
        'Skipping expired draft cleanup run because a previous execution is still in progress',
      );
      return;
    }

    this.isRunning = true;
    try {
      const summary = await this.cleanupExpiredDrafts();
      if (
        !summary.skippedDueToLock &&
        (summary.deletedCount > 0 || summary.skippedIntegrityCount > 0)
      ) {
        this.logger.log(
          `Expired draft cleanup finished: scanned=${summary.scannedCount}, deleted=${summary.deletedCount}, skippedIntegrity=${summary.skippedIntegrityCount}`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Unhandled error during expired notification draft cleanup',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.isRunning = false;
    }
  }

  async cleanupExpiredDrafts(
    now: Date = new Date(),
  ): Promise<ICleanupExpiredDraftsResult> {
    const lockToken = uuidv7();
    const lockAcquired = await this.acquireLock(lockToken);

    if (!lockAcquired) {
      this.logger.debug(
        `Skipped expired draft cleanup; lock "${NotificationDraftCleanupService.LOCK_KEY}" is already held`,
      );
      return {
        skippedDueToLock: true,
        scannedCount: 0,
        deletedCount: 0,
        skippedIntegrityCount: 0,
      };
    }

    try {
      let scannedCount = 0;
      let deletedCount = 0;
      let skippedIntegrityCount = 0;

      while (true) {
        const candidateBatch = await this.dataSource
          .getRepository(NotificationEntity)
          .find({
            where: {
              status: NotificationStatusEnum.DRAFT,
              draftExpiresAt: LessThanOrEqual(now),
            },
            select: {
              id: true,
              organisationId: true,
              status: true,
              publishedAt: true,
              draftExpiresAt: true,
            },
            order: {
              draftExpiresAt: 'ASC',
              id: 'ASC',
            },
            take: NotificationDraftCleanupService.BATCH_SIZE,
          });

        if (candidateBatch.length === 0) {
          break;
        }

        scannedCount += candidateBatch.length;

        for (const candidate of candidateBatch) {
          const outcome = await this.deleteExpiredDraftIfSafe(
            candidate.id,
            now,
          );
          if (outcome === 'deleted') {
            deletedCount += 1;
          } else if (outcome === 'integrity_conflict') {
            skippedIntegrityCount += 1;
          }
        }

        if (
          candidateBatch.length < NotificationDraftCleanupService.BATCH_SIZE
        ) {
          break;
        }
      }

      return {
        skippedDueToLock: false,
        scannedCount,
        deletedCount,
        skippedIntegrityCount,
      };
    } finally {
      await this.releaseLock(lockToken);
    }
  }

  private async acquireLock(token: string): Promise<boolean> {
    if (!this.redis) {
      return true;
    }

    const result = await this.redis.set(
      NotificationDraftCleanupService.LOCK_KEY,
      token,
      'PX',
      NotificationDraftCleanupService.LOCK_TTL_MS,
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
          NotificationDraftCleanupService.LOCK_KEY,
          token,
        );
        return;
      }

      const currentValue = await this.redis.get(
        NotificationDraftCleanupService.LOCK_KEY,
      );
      if (currentValue === token) {
        await this.redis.del(NotificationDraftCleanupService.LOCK_KEY);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to release Redis lock "${NotificationDraftCleanupService.LOCK_KEY}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async deleteExpiredDraftIfSafe(
    notificationId: string,
    now: Date,
  ): Promise<'deleted' | 'skipped' | 'integrity_conflict'> {
    return await this.dataSource.transaction(async (entityManager) => {
      const notificationRepo = entityManager.getRepository(NotificationEntity);
      const recipientRepo = entityManager.getRepository(
        NotificationRecipientEntity,
      );
      const outboxRepo = entityManager.getRepository(NotificationOutboxEntity);

      const draft = await notificationRepo.findOne({
        where: { id: notificationId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!draft) {
        return 'skipped';
      }

      if (
        draft.status !== NotificationStatusEnum.DRAFT ||
        draft.publishedAt !== null
      ) {
        return 'skipped';
      }

      if (
        !draft.draftExpiresAt ||
        draft.draftExpiresAt.getTime() > now.getTime()
      ) {
        return 'skipped';
      }

      const outboxCount = await outboxRepo.count({
        where: { notificationId: draft.id },
      });

      if (outboxCount > 0) {
        this.logger.error(
          `Integrity guard prevented deleting expired draft ${draft.id} (org=${draft.organisationId}): found ${outboxCount} outbox record(s)`,
        );
        return 'integrity_conflict';
      }

      await recipientRepo.delete({ notificationId: draft.id });
      await notificationRepo.delete({ id: draft.id });

      return 'deleted';
    });
  }
}
