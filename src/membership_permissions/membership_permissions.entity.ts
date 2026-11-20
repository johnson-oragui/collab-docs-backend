import { CustomBaseEntity } from '@/database/base.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { PermissionEntity } from '@/permissions/permissions.entity';
import { Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

@Entity('collabdocs_membership_permissions')
@Index(['membership', 'permission'], { unique: true })
export class MembershipPermissionEntity extends CustomBaseEntity {
  @ManyToOne(
    () => OrganisationMembershipEntity,
    (membership) => membership.permissions,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'membership_id' })
  declare membership: OrganisationMembershipEntity;

  @ManyToOne(() => PermissionEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'permission_id' })
  declare permission: PermissionEntity;
}
