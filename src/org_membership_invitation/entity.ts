import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { CustomBaseEntity } from '../database/base.entity';
import { OrganisationMembershipEntity } from '../organisation-memberships/organisation-memberships.entity';
import {
  InvitationStatusEnum,
  type TInvitationStatusEnum,
} from '../database/database.enums';

@Entity('collabdocs_organisation_membership_invitations')
export class OrganisationMembershipInvitationEntity extends CustomBaseEntity {
  @Column({ unique: true })
  declare token: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  declare expiresAt: Date;

  @Column({ nullable: true, type: 'uuid' })
  declare requestId: string | null;

  @Column({
    default: InvitationStatusEnum.PENDING,
    type: 'enum',
    enumName: 'collabdocs_invitation_status_enum',
    enum: InvitationStatusEnum,
  })
  declare status: TInvitationStatusEnum;

  // Relation back to membership
  @ManyToOne(
    () => OrganisationMembershipEntity,
    (membership) => membership.invitations,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'organisation_membership_id' })
  declare membership: OrganisationMembershipEntity;
}
