import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { CustomBaseEntity } from '../database/base.entity';
import {
  InvitationStatusEnum,
  type TInvitationStatusEnum,
} from '../database/database.enums';
import { OrganisationEntity } from '@/organisations/organisations.entity';
import { RoleEntity } from '@/roles/roles.entity';
import {
  PermissionAssignmentModeEnum,
  type TPermissionAssignmentModeEnum,
} from '@/commons/enums';
import { InvitationPermissionEntity } from '@/invitation_permissions/invitation_permissions.entity';
import { UserEntity } from '@/user/user.entity';

@Entity('collabdocs_organisation_membership_invitations')
@Index(['email', 'organisation'], { unique: false })
@Index(['email', 'organisation'], {
  unique: true,
  where: "status = 'PENDING'::collabdocs_invitation_status_enum",
})
@Index(['invitedBy'], { unique: false })
export class OrganisationMembershipInvitationEntity extends CustomBaseEntity {
  @Column({ unique: true })
  declare token: string;

  @Column({ name: 'email', length: 254 })
  declare email: string;

  @Column({ name: 'first_name', length: 255 })
  declare firstName: string;

  @Column({ name: 'last_name', length: 255 })
  declare lastName: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  declare expiresAt: Date;

  @Column({ type: 'timestamptz', name: 'revoked_at', default: null })
  declare revokedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'resent_at', default: null })
  declare resentAt: Date | null;

  @Column({ nullable: true, type: 'uuid' })
  declare requestId: string | null;

  @Column({
    default: InvitationStatusEnum.PENDING,
    type: 'enum',
    enumName: 'collabdocs_invitation_status_enum',
    enum: InvitationStatusEnum,
  })
  declare status: TInvitationStatusEnum;

  @Column({
    type: 'enum',
    enum: PermissionAssignmentModeEnum,
    enumName: 'collabdocs_permission_assignment_mode_enum',
  })
  declare permissionMode: TPermissionAssignmentModeEnum;

  @ManyToOne(
    () => OrganisationEntity,
    (organisation) => organisation.membershipInvitations,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'organisation_id' })
  declare organisation: OrganisationEntity;

  @ManyToOne(() => RoleEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'role_id' })
  declare role: RoleEntity;

  @ManyToOne(() => UserEntity, (user) => user.sentInvitations, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'invited_by_id' })
  declare invitedBy: UserEntity;

  @ManyToOne(() => UserEntity, (user) => user.revokedInvitations, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'revoked_by_id' })
  declare revokedBy: UserEntity;

  @OneToMany(
    () => InvitationPermissionEntity,
    (permission) => permission.invitation,
    { cascade: false },
  )
  declare permissions: InvitationPermissionEntity[];
}
