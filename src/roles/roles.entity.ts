import { Entity, Column, ManyToMany, JoinTable, OneToMany } from 'typeorm';
import { CustomBaseEntity } from '../database/base.entity';
import { PermissionEntity } from '../permissions/permissions.entity';
import { OrganisationMembershipEntity } from '../organisation-memberships/organisation-memberships.entity';
import {
  RoleScopeEnum,
  type TRoleScopeEnum,
  type TRoleEnum,
  RoleEnum,
} from '../database/database.enums';

@Entity('collabdocs_roles')
export class RoleEntity extends CustomBaseEntity {
  @Column({ unique: true, enum: RoleEnum, type: 'enum' })
  declare name: TRoleEnum;

  @Column({ nullable: true, type: 'uuid' })
  declare requestId: string | null;

  @Column({
    type: 'enum',
    enum: RoleScopeEnum,
    default: RoleScopeEnum.ORGANISATION,
  })
  declare scope: TRoleScopeEnum;

  @Column({ nullable: true })
  declare description: string;

  // Role has many permissions
  @ManyToMany(() => PermissionEntity, (permission) => permission.roles, {
    cascade: true,
  })
  @JoinTable({
    name: 'collabdocs_role_permissions',
    joinColumn: { name: 'role_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permission_id', referencedColumnName: 'id' },
  })
  declare permissions: PermissionEntity[];

  // A role can be assigned to many memberships
  @OneToMany(
    () => OrganisationMembershipEntity,
    (membership) => membership.role,
  )
  declare memberships: OrganisationMembershipEntity[];
}
