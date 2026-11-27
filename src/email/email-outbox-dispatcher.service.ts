import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';

import { EmailService } from './email.service';
import { EmailOutboxEntity } from '../email-outbox/email.entity';
import { EmailOutboxStatusEnum } from '@/database/database.enums';
import {
  EMAIL_JOB,
  EMAIL_REDIS_CLIENT,
  RELEASE_LOCK_LUA,
} from './email.constants';
import {
  IDispatchEmailOutboxResult,
  type IEmailRedisLockClient,
} from './email.interface';

@Injectable()
export class EmailOutboxDispatcherService {
  private readonly logger = new Logger(EmailOutboxDispatcherService.name);
  private static readonly LOCK_KEY = 'lock:email:dispatch-outbox';
  private static readonly LOCK_TTL_MS = 8_000;

  /**
   * Prevents overlapping dispatcher runs within this process.
   * Redis distributed lock coordinates across multiple application instances.
   */
  private isRunning = false;

  constructor(
    @InjectRepository(EmailOutboxEntity)
    private readonly outboxRepository: Repository<EmailOutboxEntity>,
    private readonly emailService: EmailService,
    @Optional()
    @Inject(EMAIL_REDIS_CLIENT)
    private readonly redis: IEmailRedisLockClient,
  ) {}

  /**
   * Runs every 10 seconds and dispatches pending or previously
   * queued outbox records.
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async dispatchPendingEmails(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      await this.dispatchBatch();
    } catch (error) {
      this.logger.error(
        'Email outbox dispatch batch failed',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.isRunning = false;
    }
  }

  async dispatchBatch(
    now: Date = new Date(),
  ): Promise<IDispatchEmailOutboxResult> {
    const lockToken = randomUUID();
    const lockAcquired = await this.acquireLock(lockToken);

    if (!lockAcquired) {
      return {
        skippedDueToLock: true,
        scannedCount: 0,
        queuedCount: 0,
      };
    }

    try {
      const records = await this.outboxRepository
        .createQueryBuilder('outbox')
        .where('outbox.status IN (:...statuses)', {
          statuses: [
            EmailOutboxStatusEnum.PENDING,
            EmailOutboxStatusEnum.QUEUED,
          ],
        })
        .andWhere('outbox.availableAt <= :now', { now })
        .orderBy('outbox.availableAt', 'ASC')
        .addOrderBy('outbox.createdAt', 'ASC')
        .take(EMAIL_JOB.BATCH_SIZE)
        .getMany();

      if (records.length === 0) {
        return {
          skippedDueToLock: false,
          scannedCount: 0,
          queuedCount: 0,
        };
      }

      let queuedCount = 0;

      for (const record of records) {
        try {
          await this.emailService.enqueueOutboxEmail(record.id);

          await this.outboxRepository
            .createQueryBuilder()
            .update(EmailOutboxEntity)
            .set({
              status: EmailOutboxStatusEnum.QUEUED,
            })
            .where('id = :id', { id: record.id })
            .andWhere('status IN (:...statuses)', {
              statuses: [
                EmailOutboxStatusEnum.PENDING,
                EmailOutboxStatusEnum.QUEUED,
              ],
            })
            .execute();

          queuedCount += 1;
        } catch (error) {
          this.logger.warn(
            `Unable to dispatch email outbox record ${record.id}: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
          );
        }
      }

      if (queuedCount > 0) {
        this.logger.log(`Dispatched ${queuedCount} email outbox record(s)`);
      }

      return {
        skippedDueToLock: false,
        scannedCount: records.length,
        queuedCount,
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
      EmailOutboxDispatcherService.LOCK_KEY,
      token,
      'PX',
      EmailOutboxDispatcherService.LOCK_TTL_MS,
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
          EmailOutboxDispatcherService.LOCK_KEY,
          token,
        );
        return;
      }

      const currentValue = await this.redis.get(
        EmailOutboxDispatcherService.LOCK_KEY,
      );
      if (currentValue === token) {
        await this.redis.del(EmailOutboxDispatcherService.LOCK_KEY);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to release Redis lock "${EmailOutboxDispatcherService.LOCK_KEY}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
