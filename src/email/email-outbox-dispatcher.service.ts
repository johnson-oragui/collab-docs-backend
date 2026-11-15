import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { EmailService } from './email.service';
import { EmailOutboxEntity } from '../email-outbox/email.entity';
import { EmailOutboxStatusEnum } from '@/database/database.enums';
import { EMAIL_JOB } from './email.constants';

@Injectable()
export class EmailOutboxDispatcherService {
  private readonly logger = new Logger(EmailOutboxDispatcherService.name);

  /**
   * Prevents overlapping dispatcher runs within this process.
   *
   * Stable BullMQ job IDs provide additional protection when
   * multiple application instances are running.
   */
  private isRunning = false;

  constructor(
    @InjectRepository(EmailOutboxEntity)
    private readonly outboxRepository: Repository<EmailOutboxEntity>,
    private readonly emailService: EmailService,
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

  private async dispatchBatch(): Promise<void> {
    const records = await this.outboxRepository
      .createQueryBuilder('outbox')
      .where('outbox.status IN (:...statuses)', {
        statuses: [EmailOutboxStatusEnum.PENDING, EmailOutboxStatusEnum.QUEUED],
      })
      .andWhere('outbox.availableAt <= :now', {
        now: new Date(),
      })
      .orderBy('outbox.availableAt', 'ASC')
      .addOrderBy('outbox.createdAt', 'ASC')
      .take(EMAIL_JOB.BATCH_SIZE)
      .getMany();
    // this.logger.debug(`records: ${JSON.stringify(records)}`);

    if (records.length === 0) {
      return;
    }

    let queuedCount = 0;

    for (const record of records) {
      try {
        // Only the outbox ID is added to the BullMQ job.
        await this.emailService.enqueueOutboxEmail(record.id);
        // this.logger.debug(`record ID: ${record.id}`)

        // Do not overwrite SENT or FAILED if the worker has
        // already changed the record while this job was queued.
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
        console.log('error: ', error);
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
  }
}
