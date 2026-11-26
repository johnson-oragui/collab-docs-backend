import { CustomBaseEntity } from '@/database/base.entity';
import {
  NotificationStatusEnum,
  NotificationTypeEnum,
  type TNotificationStatusEnum,
  type TNotificationTypeEnum,
} from '@/database/database.enums';
import { NotificationOutboxEntity } from '@/notification-outbox/notification-outbox.entity';
import { NotificationRecipientEntity } from '@/notification-recipients/notification-recipients.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { OrganisationEntity } from '@/organisations/organisations.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';

@Entity('collabdocs_notifications')
@Index('idx_notifications_org_status', ['organisationId', 'status'])
@Index('idx_notifications_draft_expiry', ['status', 'draftExpiresAt'])
@Index('idx_notifications_published_at', ['publishedAt'])
export class NotificationEntity extends CustomBaseEntity {
  @Column({ name: 'organisation_id', type: 'uuid' })
  declare organisationId: string;

  @ManyToOne(() => OrganisationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organisation_id' })
  declare organisation: OrganisationEntity;

  @Column({ name: 'created_by_membership_id', type: 'uuid', nullable: true })
  declare createdByMembershipId: string | null;

  @ManyToOne(
    () => OrganisationMembershipEntity,
    (createdNotifications) => createdNotifications.createdNotifications,
    {
      onDelete: 'SET NULL',
      nullable: true,
    },
  )
  @JoinColumn({ name: 'created_by_membership_id' })
  declare createdByMembership: OrganisationMembershipEntity | null;

  @Column({ type: 'varchar', length: 255 })
  declare title: string;

  @Column({ type: 'text' })
  declare message: string;

  @Column({
    type: 'enum',
    enum: NotificationTypeEnum,
    default: NotificationTypeEnum.ANNOUNCEMENT,
    enumName: 'collabdocs_notification_type_enum',
  })
  declare type: TNotificationTypeEnum;

  @Column({
    type: 'enum',
    enum: NotificationStatusEnum,
    default: NotificationStatusEnum.DRAFT,
    enumName: 'collabdocs_notification_status_enum',
  })
  declare status: TNotificationStatusEnum;

  @Column({
    name: 'draft_expires_at',
    type: 'timestamptz',
    nullable: true,
    comment:
      'Only set while status = DRAFT. Cleared to NULL on publish. The cleanup job uses this column to find expired drafts.',
    utc: true,
  })
  declare draftExpiresAt: Date | null;

  @Column({
    name: 'published_at',
    type: 'timestamptz',
    nullable: true,
    comment: 'is nullable and only populated on publish',
    utc: true,
  })
  declare publishedAt: Date | null;

  @OneToMany(() => NotificationRecipientEntity, (r) => r.notification, {
    cascade: true,
  })
  declare recipients: NotificationRecipientEntity[];

  @OneToMany(() => NotificationOutboxEntity, (o) => o.notification, {
    cascade: true,
  })
  declare outboxEntries: NotificationOutboxEntity[];
}
