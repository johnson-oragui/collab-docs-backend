import { CustomBaseEntity } from '@/database/base.entity';
import { NotificationEntity } from '@/notification/notification.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';

@Entity('collabdocs_notification_recipients')
@Unique('uq_notification_recipient', ['notificationId', 'membershipId'])
@Index('idx_recipients_membership_read', ['membershipId', 'readAt'])
@Index('idx_recipients_notification', ['notificationId'])
export class NotificationRecipientEntity extends CustomBaseEntity {
  @Column({ name: 'notification_id', type: 'uuid' })
  declare notificationId: string;

  @ManyToOne(() => NotificationEntity, (n) => n.recipients, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'notification_id' })
  declare notification: NotificationEntity;

  @Column({ name: 'membership_id', type: 'uuid' })
  declare membershipId: string;

  @ManyToOne(() => OrganisationMembershipEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'membership_id' })
  declare membership: OrganisationMembershipEntity;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  declare readAt: Date | null;
}
