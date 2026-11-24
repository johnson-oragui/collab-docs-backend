import { handleServiceMethodError } from '@/commons/util/errorHandler';
import { HttpException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { type Request as ExRequest } from 'express';
import { ReassignOrganisationMemberShipRoleDto } from './dto/reassign.role.dto';
import { ApiResponseDto } from '@/commons/dtos/api-response.dto';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import {
  OrganisationAuditEventEnum,
  OrganisationRoleEnum,
  PermissionAssignmentModeEnum,
} from '@/commons/enums';
import { RoleEntity } from '@/roles/roles.entity';
import { PermissionEntity } from '@/permissions/permissions.entity';
import {
  EmailEventTypeEnum,
  OrganisationMembershipStatusEnum,
} from '@/database/database.enums';
import { MembershipPermissionEntity } from '@/membership_permissions/membership_permissions.entity';
import { nestedPermissionsToPermissionNames } from '@/commons/util/groupPermissionsToNested';
import { OrganisationAuditEntity } from '@/organisation_audit/organisation_audit.entity';
import { asyncStore } from '@/commons/storage/async-storage';
import { EmailTemplateService } from '@/email/email-template.service';
import { EmailOutboxService } from '@/email-outbox/email-outbox.service';

@Injectable()
export class OrganisationMembershipRoleService {
  constructor(
    @InjectDataSource() readonly dataSource: DataSource,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly emailOutboxService: EmailOutboxService,
  ) {}

  async reassignRole(
    request: ExRequest,
    membershipId: string,
    dto: ReassignOrganisationMemberShipRoleDto,
  ) {
    const requestId = asyncStore.getStore()?.requestId;
    try {
      // TODO: discard cached logged member permissionson redis after reassignment...
      // after when this feature has been added
      const organisationId =
        request.organisation?.id ?? request.decodedUser?.organisationId;
      let organisationRole = request.decodedUser?.organisationRole;

      await this.dataSource.transaction(async (entityManager) => {
        const membershipRepo = entityManager.getRepository(
          OrganisationMembershipEntity,
        );
        const roleRepo = entityManager.getRepository(RoleEntity);
        const membershipPermissionRepo = entityManager.getRepository(
          MembershipPermissionEntity,
        );
        const auditRepo = entityManager.getRepository(OrganisationAuditEntity);

        const membershipExists = await membershipRepo.findOne({
          where: { id: membershipId, organisation: { id: organisationId } },
          relations: {
            role: true,
            permissions: true,
            user: true,
            organisation: true,
          },
        });

        if (!membershipExists) {
          throw new HttpException(
            {
              message: `No membership was found for the selected membership.`,
            },
            404,
          );
        }
        if (
          membershipExists.status !== OrganisationMembershipStatusEnum.ACTIVE
        ) {
          throw new HttpException(
            {
              message: `Cannot change role for membership when membership is ${membershipExists.status.toLowerCase()}.`,
            },
            400,
          );
        }
        const previousRole = membershipExists?.role.name;
        const previousmembershipPermissions = membershipExists.permissions;

        if (!organisationRole) {
          const currentUserMembership = await membershipRepo.findOne({
            where: {
              user: { id: request.user!.id },
              organisation: { id: organisationId },
            },
            select: { role: { name: true } },
            relations: { role: true },
          });
          if (!currentUserMembership) {
            throw new HttpException({ message: 'Invalid User account' }, 403);
          }
          organisationRole = currentUserMembership?.role.name;
        }

        if (
          dto.role === OrganisationRoleEnum.ORG_ADMIN &&
          organisationRole !== OrganisationRoleEnum.ORG_ADMIN
        ) {
          throw new HttpException(
            {
              message:
                'Action requires Admin privilege. Cannot assign Organisation Admin role.',
            },
            403,
          );
        }
        if (
          dto.role === OrganisationRoleEnum.ORG_SUB_ADMIN &&
          organisationRole !== OrganisationRoleEnum.ORG_ADMIN
        ) {
          throw new HttpException(
            {
              message:
                'Action requires Admin privilege. Cannot assign Organisation Sub Admin role.',
            },
            403,
          );
        }
        let permissions: PermissionEntity[];
        const role = await roleRepo.findOne({
          where: { name: dto.role },
          relations: { permissions: true },
          select: { permissions: { name: true } },
        });
        if (!role) {
          throw new HttpException(
            { message: 'The selected Role to assign was not found' },
            404,
          );
        }
        if (dto.permissionMode === PermissionAssignmentModeEnum.DEFAULT) {
          permissions = role?.permissions;
        } else {
          permissions = [];
          const flattenedPermissions = nestedPermissionsToPermissionNames(
            dto.permissions!,
          );

          flattenedPermissions.forEach((flattenedPermission) => {
            const foundMatchingPermission = role.permissions.find(
              (permission) => permission.name === flattenedPermission,
            );
            if (!foundMatchingPermission) {
              throw new HttpException(
                {
                  message: `One or more permission(s) cannot be assigned to the selected role. ${flattenedPermission.split(':')[0]?.replace('_', ' ')} `,
                },
                400,
              );
            }

            permissions.push(foundMatchingPermission);
          });
        }

        const previousmembershipPermissionsIds =
          previousmembershipPermissions.map((p) => p.id);

        if (previousmembershipPermissionsIds.length > 0) {
          await membershipPermissionRepo.delete(
            previousmembershipPermissions.map((p) => p.id),
          );
        }

        const membershipPermissions = (permissions ?? []).map((permission) => {
          return membershipPermissionRepo.create({
            permission,
            membership: membershipExists,
          });
        });
        await membershipPermissionRepo.upsert(membershipPermissions, {
          conflictPaths: ['membership', 'permission'],
          skipUpdateIfNoValuesChanged: true,
        });

        membershipExists.role = role;
        await membershipRepo.save(membershipExists);

        await auditRepo.save(
          auditRepo.create({
            actor: request.user ?? null,
            eventType: OrganisationAuditEventEnum.MEMBERSHIP_ROLE_REASSIGN,
            organisation: { id: organisationId },
            metadata: {
              newRole: dto.role,
              previousRole,
              reassignedAt: new Date(),
              requestId,
            },
          }),
        );
        const emailPayload =
          this.emailTemplateService.sendOrganisationInfoEmail({
            recipientEmail: membershipExists.user.email,
            recipientName: membershipExists.user.firstName,
            organisationName: membershipExists.organisation.name,
            info: `Your role has been changed to ${role.name.replaceAll('_', ' ')}`,
          });

        await this.emailOutboxService.create(
          entityManager,
          EmailEventTypeEnum.INFO,
          emailPayload,
        );
      });

      return new ApiResponseDto({
        data: {
          membershipId,
          permissions: dto.permissions,
          permissionMode: dto.permissionMode,
        },
      });
    } catch (error) {
      return handleServiceMethodError(error, 'Failed to reassign Role');
    }
  }
}
