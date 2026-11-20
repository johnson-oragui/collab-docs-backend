import { Entity, ManyToOne, JoinColumn, Index } from 'typeorm';

import { CustomBaseEntity } from '../database/base.entity';
import { PermissionEntity } from '../permissions/permissions.entity';
import { OrganisationMembershipInvitationEntity } from '@/org_membership_invitation/org_membership_invitation.entity';

@Entity('collabdocs_invitation_permissions')
@Index(['invitation', 'permission'], { unique: true })
export class InvitationPermissionEntity extends CustomBaseEntity {
  @ManyToOne(
    () => OrganisationMembershipInvitationEntity,
    (invitation) => invitation.permissions,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'invitation_id' })
  declare invitation: OrganisationMembershipInvitationEntity;

  @ManyToOne(() => PermissionEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'permission_id' })
  declare permission: PermissionEntity;
}
