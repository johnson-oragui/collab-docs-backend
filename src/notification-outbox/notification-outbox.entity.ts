import { CustomBaseEntity } from '@/database/base.entity';
import {
  NotificationOutboxEventTypeEnum,
  NotificationOutboxStatusEnum,
  type TNotificationOutboxStatusEnum,
  type TNotificationOutboxEventTypeEnum,
} from '@/database/database.enums';
import { NotificationEntity } from '@/notification/notification.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

@Entity('collabdocs_notification_outbox')
@Index('idx_outbox_dispatch', ['status', 'nextAttemptAt'])
@Index('idx_outbox_notification', ['notificationId'])
export class NotificationOutboxEntity extends CustomBaseEntity {
  @Column({ name: 'notification_id', type: 'uuid' })
  declare notificationId: string;

  @ManyToOne(() => NotificationEntity, (n) => n.outboxEntries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'notification_id' })
  declare notification: NotificationEntity;

  @Column({ name: 'recipient_membership_id', type: 'uuid' })
  declare recipientMembershipId: string;

  @Column({
    name: 'event_type',
    type: 'enum',
    enum: NotificationOutboxEventTypeEnum,
    enumName: 'collabdocs_notification_outbox_event_type_enum',
  })
  declare eventType: TNotificationOutboxEventTypeEnum;

  @Column({
    type: 'enum',
    enum: NotificationOutboxStatusEnum,
    default: NotificationOutboxStatusEnum.PENDING,
  })
  declare status: TNotificationOutboxStatusEnum;

  @Column({ type: 'int', default: 0 })
  declare attempts: number;

  @Column({
    name: 'next_attempt_at',
    type: 'timestamptz',
    default: () => 'NOW()',
    utc: true,
  })
  declare nextAttemptAt: Date;

  @Column({
    name: 'dispatched_at',
    type: 'timestamptz',
    nullable: true,
    utc: true,
  })
  declare dispatchedAt: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  declare lastError: string | null;
}
