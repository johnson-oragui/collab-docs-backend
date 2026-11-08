import {
  Entity,
  Column,
  ManyToMany,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { CustomBaseEntity } from '../database/base.entity';
import { RoleEntity } from '../roles/roles.entity';

export const PermissionEnum = Object.freeze({
  DOCUMENT: {
    CREATE: 'document:create',
    DELETE: 'document:delete',
    UPDATE: 'document:update',
    READ: 'document:read',
  },
  DOCUMENT_INVITATION: {
    CREATE: 'document_invitation:create',
    DELETE: 'document_invitation:delete',
    UPDATE: 'document_invitation:update',
    READ: 'document_invitation:read',
  },
  ORGANISATION: {
    CREATE: 'organisation:create',
    DELETE: 'organisation:delete',
    UPDATE: 'organisation:update',
    READ: 'organisation:read',
  },
  ORGANISATION_INVITATION: {
    CREATE: 'organisation_invitation:create',
    DELETE: 'organisation_invitation:delete',
    UPDATE: 'organisation_invitation:update',
    READ: 'organisation_invitation:read',
  },
  ORGANISATION_MEMBERSHIP: {
    CREATE: 'organisation_membership:create',
    DELETE: 'organisation_membership:delete',
    UPDATE: 'organisation_membership:update',
    READ: 'organisation_membership:read',
  },
  USER: {
    CREATE: 'user:create',
    DELETE: 'user:delete',
    UPDATE: 'user:update',
    READ: 'user:read',
  },
  ROLE: {
    CREATE: 'role:create',
    DELETE: 'role:delete',
    UPDATE: 'role:update',
    READ: 'role:read',
  },
} as const);

@Entity('collabdocs_permissions')
export class PermissionEntity extends CustomBaseEntity {
  @Column({ unique: true })
  declare name: string; // e.g., 'documents:create', 'org:settings:update'

  @Column({ nullable: true })
  declare description: string;

  @Column({ nullable: true, type: 'uuid' })
  declare requestId: string | null;

  @ManyToMany(() => RoleEntity, (role) => role.permissions)
  declare roles: RoleEntity[];

  /**
   * Helper method to flatten all valid permissions
   *  from PermissionEnum into a string array.
   */
  static getValidPermissions(): string[] {
    return Object.values(PermissionEnum).flatMap((category) =>
      Object.values(category),
    );
  }

  /**
   * Lifecycle hook that 
   * Ensures the name exists in PermissionEnum.
   */
  @BeforeInsert()
  @BeforeUpdate()
  validatePermission() {
    const validPermissions = PermissionEntity.getValidPermissions();

    if (!validPermissions.includes(this.name)) {
      throw new Error(
        `Invalid permission name "${this.name}". It must be one of the predefined values in PermissionEnum.`,
      );
    }
  }
}
