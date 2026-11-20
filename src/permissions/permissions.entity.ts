import {
  Entity,
  Column,
  ManyToMany,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { CustomBaseEntity } from '../database/base.entity';
import { RoleEntity } from '../roles/roles.entity';
import { PermissionEnum } from './permission.registry';

@Entity('collabdocs_permissions')
export class PermissionEntity extends CustomBaseEntity {
  @Column({ unique: true })
  declare name: string; // e.g., 'documents:create', 'org_settings:update'

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
  static getValidPermissions(permissions: any = PermissionEnum): string[] {
    return Object.values(permissions).flatMap((category) =>
      Object.values(category as any),
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
