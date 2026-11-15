import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

import { EMAIL_JOB, EMAIL_QUEUE } from './email.constants';
import { IEmailJobData } from './email.interface';

@Injectable()
export class EmailService {
  constructor(
    @InjectQueue(EMAIL_QUEUE)
    private readonly emailQueue: Queue<IEmailJobData>,
  ) {}

  async enqueueOutboxEmail(outboxId: string): Promise<void> {
    await this.emailQueue.add(
      EMAIL_JOB.SEND,
      { outboxId },
      {
        // Prevent duplicate jobs for the same outbox record.
        jobId: `${EMAIL_JOB.JOB_ID_PREFIX}${outboxId}`,

        // Retry failed email delivery attempts.
        attempts: 5,

        // Wait progressively longer between retries.
        backoff: {
          type: 'exponential',
          delay: 5000,
        },

        // Retain completed jobs for a limited period.
        removeOnComplete: {
          age: 7 * 24 * 60 * 60,
          count: 1000,
        },

        // Retain failed jobs for investigation.
        removeOnFail: {
          age: 30 * 24 * 60 * 60,
        },
      },
    );
  }
}
