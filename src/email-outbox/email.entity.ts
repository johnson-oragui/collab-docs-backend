import { Column, Entity, Index } from 'typeorm';

import { CustomBaseEntity } from '@/database/base.entity';
import {
  EmailEventTypeEnum,
  EmailOutboxStatusEnum,
  type TEmailOutboxStatusEnum,
  type TEmailEventTypeEnum,
} from '@/database/database.enums';

@Entity('collabdocs_email_outbox')
@Index('idx_collabdocs_email_outbox_status_available_at', [
  'status',
  'availableAt',
])
export class EmailOutboxEntity extends CustomBaseEntity {
  @Column({
    name: 'event_type',
    type: 'enum',
    enum: EmailEventTypeEnum,
    comment: 'Identifies the type of email being delivered.',
  })
  declare eventType: TEmailEventTypeEnum;

  @Column({
    name: 'encrypted_payload',
    type: 'text',
    comment:
      'contains the recipient, subject, email content and any sensitive values such as reset/verification tokens.',
  })
  declare encryptedPayload: string;

  @Column({
    name: 'encryption_iv',
    type: 'varchar',
    length: 32,
    comment: 'AES-256-GCM initialization vector.',
  })
  declare encryptionIv: string;

  @Column({
    name: 'encryption_auth_tag',
    type: 'varchar',
    length: 32,
    comment: ' AES-256-GCM authentication tag.',
  })
  declare encryptionAuthTag: string;

  @Column({
    type: 'enum',
    default: EmailOutboxStatusEnum.PENDING,
    enum: EmailOutboxStatusEnum,
  })
  declare status: TEmailOutboxStatusEnum;

  @Column({
    name: 'attempts',
    type: 'integer',
    default: 0,
    comment: 'Number of times delivery has been attempted.',
  })
  declare attempts: number;

  @Column({
    name: 'available_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
    comment: 'Earliest time this record can be dispatched.',
  })
  declare availableAt: Date;

  @Column({
    name: 'sent_at',
    type: 'timestamptz',
    nullable: true,
  })
  declare sentAt: Date | null;

  @Column({
    name: 'last_error',
    type: 'text',
    nullable: true,
    comment: 'Last delivery error, with sensitive values excluded.',
  })
  declare lastError: string | null;
}
