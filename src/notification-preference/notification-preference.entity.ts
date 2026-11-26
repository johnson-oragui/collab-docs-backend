import { CustomBaseEntity } from '@/database/base.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { Column, Entity, JoinColumn, OneToOne, Unique } from 'typeorm';

@Entity('collabdocs_notification_preferences')
@Unique('uq_notification_preference_membership', ['membershipId'])
export class NotificationPreferenceEntity extends CustomBaseEntity {
  @Column({ name: 'membership_id', type: 'uuid' })
  declare membershipId: string;

  @OneToOne(
    () => OrganisationMembershipEntity,
    (membership) => membership.notificationPreference,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'membership_id' })
  declare membership: OrganisationMembershipEntity;

  @Column({ name: 'realtime_enabled', type: 'boolean', default: true })
  declare realtimeEnabled: boolean;

  @Column({ name: 'email_enabled', type: 'boolean', default: false })
  declare emailEnabled: boolean;

  @Column({
    name: 'digest_frequency',
    type: 'varchar',
    length: 32,
    default: 'NONE',
  })
  declare digestFrequency: string;
}
