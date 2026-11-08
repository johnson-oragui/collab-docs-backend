import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleEntity } from './roles.entity';
import {
  PermissionEntity,
  PermissionEnum,
} from '../permissions/permissions.entity';
import { RoleEnum, RoleScopeEnum } from '../database/database.enums';

@Injectable()
export class RolesSeedService implements OnModuleInit {
  private readonly logger = new Logger(RolesSeedService.name);

  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
    @InjectRepository(PermissionEntity)
    private readonly permissionRepository: Repository<PermissionEntity>,
  ) {}

  async onModuleInit() {
    await this.seedRoles();
  }

  async seedRoles() {
    this.logger.log('Seeding default roles and assigning permissions...');

    const allPermissions = await this.permissionRepository.find();

    if (allPermissions.length === 0) {
      this.logger.warn(
        'No permissions found in database. Skipping role seeding.',
      );
      return;
    }

    const defaultRoles = [
      {
        name: RoleEnum.APP_SUPER_ADMIN,
        scope: RoleScopeEnum.APPLICATION,
        description: 'Super administrator with full application access',
        permissions: allPermissions,
      },
      {
        name: RoleEnum.ORG_ADMIN,
        scope: RoleScopeEnum.ORGANISATION,
        description:
          'Organization administrator managing members, roles, and documents',
        permissions: allPermissions.filter(
          (p) =>
            p.name.startsWith('organisation') ||
            p.name.startsWith('document') ||
            p.name.startsWith('role'),
        ),
      },
      {
        name: RoleEnum.ORG_MEMBER,
        scope: RoleScopeEnum.ORGANISATION,
        description:
          'Standard organization member with read/write access to documents',
        permissions: allPermissions.filter(
          (p) =>
            p.name === PermissionEnum.DOCUMENT.CREATE ||
            p.name === PermissionEnum.DOCUMENT.READ ||
            p.name === PermissionEnum.DOCUMENT.UPDATE ||
            p.name === PermissionEnum.DOCUMENT_INVITATION.CREATE ||
            p.name === PermissionEnum.DOCUMENT_INVITATION.UPDATE ||
            p.name === PermissionEnum.DOCUMENT_INVITATION.READ ||
            p.name.includes(':read'),
        ),
      },
    ];

    for (const roleData of defaultRoles) {
      let role = await this.roleRepository.findOne({
        where: { name: roleData.name },
        relations: { permissions: true },
      });

      if (!role) {
        // Create new role if it doesn't exist
        role = this.roleRepository.create({
          name: roleData.name,
          scope: roleData.scope,
          description: roleData.description,
          permissions: roleData.permissions,
        });
        await this.roleRepository.save(role);
        this.logger.log(`Created default role: ${roleData.name}`);
      } else {
        // Update existing role's permissions to keep them in sync
        role.permissions = roleData.permissions;
        role.description = roleData.description;
        await this.roleRepository.save(role);
        this.logger.log(`Synced permissions for role: ${roleData.name}`);
      }
    }

    this.logger.log('Default roles seeded successfully.');
  }
}
