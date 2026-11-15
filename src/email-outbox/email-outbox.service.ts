import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { EmailEncryptionService } from '../email/email-encryption.service';
import { TEmailEventTypeEnum } from '@/database/database.enums';
import { IEmailPayload } from '../email/email.interface';
import { EmailOutboxEntity } from './email.entity';

@Injectable()
export class EmailOutboxService {
  constructor(
    private readonly emailEncryptionService: EmailEncryptionService,
  ) {}

  /**
   * Persists an encrypted email payload using the caller's transaction.
   *
   * The caller is responsible for providing an EntityManager associated
   * with an active transaction.
   */
  async create(
    manager: EntityManager,
    eventType: TEmailEventTypeEnum,
    payload: IEmailPayload,
  ): Promise<EmailOutboxEntity> {
    const encryptedPayload = this.emailEncryptionService.encrypt(payload);

    const repository = manager.getRepository(EmailOutboxEntity);

    const outboxRecord = repository.create({
      eventType,
      ...encryptedPayload,
    });

    return repository.save(outboxRecord);
  }
}
