import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { EMAIL_JOB, EMAIL_QUEUE } from './email.constants';
import { EmailEncryptionService } from './email-encryption.service';
import { EmailOutboxEntity } from '@/email-outbox/email.entity';
import { GmailSmtpService } from '@/gmail-smtp/gmail-smtp.service';
import { IEmailJobData } from './email.interface';
import { EmailOutboxStatusEnum } from '@/database/database.enums';

@Processor(EMAIL_QUEUE, {
  concurrency: 5,
})
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    @InjectRepository(EmailOutboxEntity)
    private readonly outboxRepository: Repository<EmailOutboxEntity>,
    private readonly emailEncryptionService: EmailEncryptionService,
    private readonly emailSmtpService: GmailSmtpService,
  ) {
    super();
  }

  async process(job: Job<IEmailJobData>): Promise<void> {
    if (job.name !== EMAIL_JOB.SEND) {
      throw new Error(`Unsupported email job: ${job.name}`);
    }
    this.logger.debug('++++++++++++ 1');

    const { outboxId } = job.data;

    const record = await this.outboxRepository.findOne({
      where: { id: outboxId },
    });
    this.logger.debug('++++++++++++ 2');

    if (!record) {
      throw new Error('Email outbox record not found');
    }
    this.logger.debug('++++++++++++ 3');

    // BullMQ may redeliver a job after an uncertain completion.
    // Never send an email again if the outbox already says SENT.
    if (record.status === EmailOutboxStatusEnum.SENT) {
      return;
    }
    this.logger.debug('++++++++++++ 4');

    if (record.status === EmailOutboxStatusEnum.FAILED) {
      return;
    }
    this.logger.debug('++++++++++++ 5');

    try {
      const payload = this.emailEncryptionService.decrypt({
        encryptedPayload: record.encryptedPayload,
        encryptionIv: record.encryptionIv,
        encryptionAuthTag: record.encryptionAuthTag,
      });
      this.logger.debug('++++++++++++ 5');

      await this.emailSmtpService.send(payload);
      this.logger.debug('++++++++++++ 6');

      await this.outboxRepository.update(
        {
          id: record.id,
          status: record.status,
        },
        {
          status: EmailOutboxStatusEnum.SENT,
          sentAt: new Date(),
          lastError: null,
          attempts: () => '"attempts" + 1',
        },
      );
      this.logger.debug('++++++++++++ 7');
    } catch (error) {
      const attemptsMade = job.attemptsMade + 1;
      const maximumAttempts = job.opts.attempts ?? 1;
      const isFinalAttempt = attemptsMade >= maximumAttempts;
      this.logger.debug('++++++++++++ 8');

      // a failed job must not overwrite a record that has already become SENT or FAILED.
      await this.outboxRepository
        .createQueryBuilder()
        .update(EmailOutboxEntity)
        .set({
          status: isFinalAttempt
            ? EmailOutboxStatusEnum.FAILED
            : EmailOutboxStatusEnum.QUEUED,
          lastError: this.getSafeErrorMessage(error),
          attempts: () => '"attempts" + 1',
        })
        .where('id = :id', { id: record.id })
        .andWhere('status IN (:...statuses)', {
          statuses: [
            EmailOutboxStatusEnum.PENDING,
            EmailOutboxStatusEnum.QUEUED,
          ],
        })
        .execute();
      this.logger.debug('++++++++++++ 9');

      throw error;
    }
  }

  private getSafeErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      // Avoid storing arbitrary SMTP response text, which can
      // contain sensitive diagnostic information.
      return error.name.slice(0, 100) || 'EmailDeliveryError';
    }

    return 'UnknownEmailDeliveryError';
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<IEmailJobData>): void {
    this.logger.log(`Email job completed: ${job.id}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<IEmailJobData> | undefined): void {
    if (!job) {
      this.logger.error('An email job failed without job metadata');
      return;
    }

    this.logger.error(
      `Email job ${job.id} failed after ${job.attemptsMade} attempt(s).`,
    );
  }
}
