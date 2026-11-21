import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { CustomBaseEntity } from '../database/base.entity';
import { OrganisationMembershipEntity } from '../organisation-memberships/organisation-memberships.entity';
import { UserEntity } from '@/user/user.entity';

@Entity('collabdocs_organisation_membership_suspension_histories')
export class OrganisationMembershipSuspensionHistoryEntity extends CustomBaseEntity {
  @Column({
    type: 'timestamptz',
    name: 'suspended_at',
    default: () => 'CURRENT_TIMESTAMP',
    nullable: true,
  })
  declare suspendedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  declare suspendedTill: Date | null;

  @Column({ nullable: true, type: 'uuid' })
  declare requestId: string | null;

  @Column({ type: 'text', nullable: true })
  declare reason: string | null;

  @Column({ type: 'varchar', nullable: false })
  declare action: 'SUSPENDED' | 'UNSUSPENDED';

  // Relation back to membership
  @ManyToOne(
    () => OrganisationMembershipEntity,
    (membership) => membership.suspensionHistories,
    {
      onDelete: 'RESTRICT',
    },
  )
  @JoinColumn({ name: 'organisation_membership_id' })
  declare membership: OrganisationMembershipEntity;

  @ManyToOne(
    () => UserEntity,
    (actor) => actor.memberSuspensionActions,
    {
      onDelete: 'RESTRICT',
    },
  )
  @JoinColumn({ name: 'actor_id' })
  declare actor: UserEntity;
}
