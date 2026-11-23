import { HttpException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { type Request as ExRequest } from 'express';
import { asyncStore } from '@/commons/storage/async-storage';
import { handleServiceMethodError } from '@/commons/util/errorHandler';
import { ApiResponseDto } from '@/commons/dtos/api-response.dto';
import { OrganisationAuditEventEnum } from '@/commons/enums';
import {
  OrganisationMembershipStatusEnum,
  RoleEnum,
} from '@/database/database.enums';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { MembershipPermissionEntity } from './membership_permissions.entity';
import { PermissionEntity } from '@/permissions/permissions.entity';
import { OrganisationAuditEntity } from '@/organisation_audit/organisation_audit.entity';
import {
  extractExplicitFalsePermissionNames,
  groupPermissionsToNested,
  nestedPermissionsToPermissionNames,
} from '@/commons/util/groupPermissionsToNested';
import { UpdateMembershipPermissionsDto } from './dto/update-membership-permissions.dto';
import { snakeCaseToCamelcase } from '@/commons/util/snakeCaseToCamelcase';

@Injectable()
export class MembershipPermissionsService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,

    @InjectRepository(MembershipPermissionEntity)
    private readonly membershipPermissionRepo: Repository<MembershipPermissionEntity>,

    @InjectRepository(OrganisationMembershipEntity)
    private readonly membershipRepo: Repository<OrganisationMembershipEntity>,
  ) {}

  async getMembershipPermissions(request: ExRequest, membershipId: string) {
    try {
      const organisationId =
        request.organisation?.id ?? request.decodedUser?.organisationId;

      if (!organisationId) {
        throw new HttpException(
          { message: 'Organisation context is required' },
          400,
        );
      }

      const membership = await this.membershipRepo.findOne({
        where: { id: membershipId, organisation: { id: organisationId } },
        select: { id: true, isDeleted: true },
      });
      if (!membership || membership.isDeleted) {
        throw new HttpException(
          {
            message: 'No Membership exists for the selected User.',
            success: false,
          },
          404,
        );
      }
      const membershipWithPermissions =
        await this.membershipPermissionRepo.find({
          where: { membership: { id: membershipId } },
          select: { id: true, permission: { name: true } },
          relations: { permission: true },
        });
      const permissions = membershipWithPermissions
        .filter((p) => !!p.permission)
        .map((p) => p.permission);

      if (permissions.length === 0 || membershipWithPermissions.length === 0) {
        return {
          message: 'Permissions retrieved successfully',
          success: true,
          data: {},
        };
      }
      const nestedPermisions = groupPermissionsToNested(permissions);
      return new ApiResponseDto({
        message: 'Permissions retrieved successfully',
        success: true,
        data: nestedPermisions,
      });
    } catch (error) {
      return handleServiceMethodError(
        error,
        'Failed to retrieve Membership Permissions',
      );
    }
  }

  async addPermissions(
    membershipId: string,
    dto: UpdateMembershipPermissionsDto,
    request: ExRequest,
  ) {
    const requestId = asyncStore.getStore()?.requestId ?? null;
    try {
      const organisationId =
        request.organisation?.id ?? request.decodedUser?.organisationId;

      if (!organisationId) {
        throw new HttpException(
          { message: 'Organisation context is required' },
          400,
        );
      }

      const permissionNames = nestedPermissionsToPermissionNames(
        dto.permissions,
      );
      if (permissionNames.length === 0) {
        throw new HttpException(
          { message: 'At least one permission must be enabled (true) to add' },
          400,
        );
      }

      const nestedResult = await this.dataSource.transaction(
        async (entityManager) => {
          const membershipRepo = entityManager.getRepository(
            OrganisationMembershipEntity,
          );
          const memebrshipPermissionRepo = entityManager.getRepository(
            MembershipPermissionEntity,
          );
          const auditRepo = entityManager.getRepository(
            OrganisationAuditEntity,
          );

          const membership = await membershipRepo.findOne({
            where: {
              id: membershipId,
              organisation: { id: organisationId },
              isDeleted: false,
            },
            relations: {
              user: true,
              organisation: true,
              role: { permissions: true },
              permissions: { permission: true },
            },
          });

          if (!membership) {
            throw new HttpException(
              { message: 'Organisation membership not found' },
              404,
            );
          }

          if (membership.role?.name === RoleEnum.ORG_ADMIN) {
            throw new HttpException(
              {
                message:
                  'Custom membership permissions cannot be modified for an Organisation Admin',
              },
              400,
            );
          }

          if (
            [
              OrganisationMembershipStatusEnum.SUSPENDED,
              OrganisationMembershipStatusEnum.PENDING,
            ].includes(membership.status as any)
          ) {
            throw new HttpException(
              {
                message: 'Cannot modify permissions for a suspended membership',
              },
              400,
            );
          }

          const toAddEntities = this.assertPermissionsAllowedByRole(
            permissionNames,
            membership.role,
          );

          const existingPermissionIds = new Set(
            (membership.permissions ?? [])
              .filter((mp) => !mp.isDeleted && mp.permission)
              .map((mp) => mp.permission.id),
          );

          const newRows = toAddEntities
            .filter((perm) => !existingPermissionIds.has(perm.id))
            .map((perm) =>
              memebrshipPermissionRepo.create({
                membership: {
                  id: membership.id,
                } as OrganisationMembershipEntity,
                permission: { id: perm.id } as PermissionEntity,
              }),
            );

          if (newRows.length > 0) {
            await memebrshipPermissionRepo.upsert(newRows, {
              conflictPaths: ['membership', 'permission'],
              skipUpdateIfNoValuesChanged: true,
            });
          }

          const updatedRows = await memebrshipPermissionRepo.find({
            where: {
              membership: { id: membership.id },
              isDeleted: false,
            },
            relations: { permission: true },
          });

          const activePermEntities = updatedRows
            .map((r) => r.permission)
            .filter(Boolean);

          await auditRepo.save(
            auditRepo.create({
              actor: request.user ?? null,
              eventType:
                OrganisationAuditEventEnum.MEMBERSHIP_PERMISSIONS_UPDATED,
              organisation: membership.organisation ?? { id: organisationId },
              metadata: {
                action: 'ADD',
                membershipId: membership.id,
                targetUserId: membership.user?.id,
                addedPermissions: toAddEntities.map((p) => p.name),
                requestId,
              },
            }),
          );

          return groupPermissionsToNested(activePermEntities);
        },
      );

      return new ApiResponseDto({
        data: {
          membershipId,
          permissions: nestedResult,
        },
        message: 'Membership permissions added successfully',
        success: true,
      });
    } catch (error) {
      return handleServiceMethodError(
        error,
        'Failed to add membership permissions',
      );
    }
  }
  private assertPermissionsAllowedByRole(
    permissionNames: string[],
    role: OrganisationMembershipEntity['role'],
  ): PermissionEntity[] {
    if (permissionNames.length === 0) return [];

    const allowedPermissions = role?.permissions ?? [];
    const allowedMap = new Map(allowedPermissions.map((p) => [p.name, p]));
    const resolved: PermissionEntity[] = [];

    for (const name of permissionNames) {
      const match = allowedMap.get(name);
      if (!match) {
        const [perm, action] = snakeCaseToCamelcase(name).split(':');
        throw new HttpException(
          {
            message: `Permission "${action} ${perm}" is not permitted for role "${role?.name}"`,
          },
          400,
        );
      }
      resolved.push(match);
    }

    return resolved;
  }

  async removePermissions(
    membershipId: string,
    dto: UpdateMembershipPermissionsDto,
    request: ExRequest,
  ) {
    const requestId = asyncStore.getStore()?.requestId ?? null;
    try {
      const organisationId =
        request.organisation?.id ?? request.decodedUser?.organisationId;

      if (!organisationId) {
        throw new HttpException(
          { message: 'Organisation context is required' },
          400,
        );
      }

      // Accept either { action: { read: true } } or { action: { read: false } }
      const trueNames = nestedPermissionsToPermissionNames(dto.permissions);
      const falseNames = extractExplicitFalsePermissionNames(
        dto.permissions as any,
      );
      const targetNames = Array.from(new Set([...trueNames, ...falseNames]));

      if (targetNames.length === 0) {
        throw new HttpException(
          { message: 'Specify at least one permission to remove' },
          400,
        );
      }

      const nestedResult = await this.dataSource.transaction(
        async (entityManager) => {
          const membershipRepo = entityManager.getRepository(
            OrganisationMembershipEntity,
          );
          const memebrshipPermissionRepo = entityManager.getRepository(
            MembershipPermissionEntity,
          );
          const auditRepo = entityManager.getRepository(
            OrganisationAuditEntity,
          );

          const membership = await membershipRepo.findOne({
            where: {
              id: membershipId,
              organisation: { id: organisationId },
              isDeleted: false,
            },
            relations: {
              user: true,
              organisation: true,
              role: true,
              permissions: { permission: true },
            },
          });

          if (!membership) {
            throw new HttpException(
              { message: 'Organisation membership not found' },
              404,
            );
          }

          if (membership.role?.name === RoleEnum.ORG_ADMIN) {
            throw new HttpException(
              {
                message:
                  'Custom membership permissions cannot be modified for an Organisation Admin',
              },
              400,
            );
          }

          const toRemoveIds = (membership.permissions ?? [])
            .filter(
              (mp) =>
                !mp.isDeleted &&
                mp.permission &&
                targetNames.includes(mp.permission.name),
            )
            .map((mp) => mp.id);

          if (toRemoveIds.length > 0) {
            await memebrshipPermissionRepo.delete({ id: In(toRemoveIds) });
          }

          const remainingRows = await memebrshipPermissionRepo.find({
            where: {
              membership: { id: membership.id },
              isDeleted: false,
            },
            relations: { permission: true },
          });

          const activePermEntities = remainingRows
            .map((r) => r.permission)
            .filter(Boolean);

          await auditRepo.save(
            auditRepo.create({
              actor: request.user ?? null,
              eventType:
                OrganisationAuditEventEnum.MEMBERSHIP_PERMISSIONS_UPDATED,
              organisation: membership.organisation ?? { id: organisationId },
              metadata: {
                action: 'REMOVE',
                membershipId: membership.id,
                targetUserId: membership.user?.id,
                removedPermissions: targetNames,
                requestId,
              },
            }),
          );

          return groupPermissionsToNested(activePermEntities);
        },
      );

      return new ApiResponseDto({
        data: {
          membershipId,
          permissions: nestedResult,
        },
        message: 'Membership permissions removed successfully',
        success: true,
      });
    } catch (error) {
      return handleServiceMethodError(
        error,
        'Failed to remove membership permissions',
      );
    }
  }
}
