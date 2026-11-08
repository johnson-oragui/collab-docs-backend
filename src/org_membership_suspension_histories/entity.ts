import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { CustomBaseEntity } from '../database/base.entity';
import { OrganisationMembershipEntity } from '../organisation-memberships/organisation-memberships.entity';

@Entity('collabdocs_organisation_membership_suspension_histories')
export class OrganisationMembershipSuspensionHistoryEntity extends CustomBaseEntity {
  @Column({
    type: 'timestamptz',
    name: 'suspended_at',
    default: () => 'CURRENT_TIMESTAMP',
  })
  declare suspendedAt: Date;

  @Column({ type: 'timestamptz', nullable: false })
  declare suspendedTill: Date;

  @Column({ nullable: true, type: 'uuid' })
  declare requestId: string | null;

  @Column({ type: 'text', nullable: true })
  declare reason: string | null;

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
}
