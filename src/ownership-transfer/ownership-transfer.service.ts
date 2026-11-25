import { handleServiceMethodError } from '@/commons/util/errorHandler';
import { HttpException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { type Request as ExRequest } from 'express';
import { TransferOwnershipDto } from './dto/ownership-transfer.dto';
import { asyncStore } from '@/commons/storage/async-storage';
import { OrganisationEntity } from '@/organisations/organisations.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { RoleEntity } from '@/roles/roles.entity';
import { MembershipPermissionEntity } from '@/membership_permissions/membership_permissions.entity';
import { OrganisationOwnershipHistoryEntity } from '@/organisation-ownership-history/organisation-ownership-history.entity';
import { OrganisationAuditEntity } from '@/organisation_audit/organisation_audit.entity';
import {
  EmailEventTypeEnum,
  OrganisationMembershipStatusEnum,
  OrganisationStatusEnum,
  RoleEnum,
} from '@/database/database.enums';
import { OrganisationAuditEventEnum } from '@/commons/enums';
import { ApiResponseDto } from '@/commons/dtos/api-response.dto';
import { RedisService } from '@/redis/redis.service';
import { EmailOutboxService } from '@/email-outbox/email-outbox.service';
import { EmailTemplateService } from '@/email/email-template.service';
import { RedisClientType } from 'redis';
import { invalidateMemberPermissionCache } from '@/commons/util/invalidatePermissionCacheKey';

@Injectable()
export class OwnershipTransferService {
  redisClient: RedisClientType;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redisService: RedisService,

    private readonly emailTemplateService: EmailTemplateService,
    private readonly emailOutboxService: EmailOutboxService,
  ) {
    this.redisClient = this.redisService.getClient();
  }

  async transferOwnership(request: ExRequest, dto: TransferOwnershipDto) {
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

      const actorUserId = request.user?.id ?? request.decodedUser?.id;
      if (!actorUserId) {
        throw new HttpException({ message: 'Unauthorized' }, 401);
      }

      if (dto.newOwnerId === actorUserId) {
        throw new HttpException(
          { message: 'You cannot transfer organisation ownership to yourself' },
          400,
        );
      }
      const result = await this.dataSource.transaction(
        async (entityManager) => {
          const orgRepo = entityManager.getRepository(OrganisationEntity);
          const membershipRepo = entityManager.getRepository(
            OrganisationMembershipEntity,
          );
          const roleRepo = entityManager.getRepository(RoleEntity);
          const membershipPermissionRepo = entityManager.getRepository(
            MembershipPermissionEntity,
          );
          const ownershipHistoryRepo = entityManager.getRepository(
            OrganisationOwnershipHistoryEntity,
          );
          const auditRepo = entityManager.getRepository(
            OrganisationAuditEntity,
          );

          const organisation = await orgRepo.findOne({
            where: { id: organisationId },
            relations: { owner: true, creator: true },
          });

          if (!organisation || organisation.isDeleted) {
            throw new HttpException({ message: 'Organisation not found' }, 404);
          }

          if (organisation.status !== OrganisationStatusEnum.ACTIVE) {
            throw new HttpException(
              {
                message: `Cannot transfer ownership when organisation status is ${organisation.status.toLowerCase()}.`,
              },
              400,
            );
          }

          if (organisation.owner?.id !== actorUserId) {
            throw new HttpException(
              {
                message:
                  'Only the current organisation owner can transfer ownership.',
              },
              403,
            );
          }

          const previousOwner = organisation.owner;

          const previousOwnerMembership = await membershipRepo.findOne({
            where: {
              user: { id: previousOwner.id },
              organisation: { id: organisationId },
              isDeleted: false,
            },
            relations: { role: true, user: true },
          });

          if (!previousOwnerMembership) {
            throw new HttpException(
              { message: 'Current owner membership was not found' },
              404,
            );
          }

          const targetMembership = await membershipRepo.findOne({
            where: {
              user: { id: dto.newOwnerId },
              organisation: { id: organisationId },
              isDeleted: false,
            },
            relations: { role: true, user: true },
          });

          if (!targetMembership) {
            throw new HttpException(
              {
                message:
                  'Target user must be a member of this organisation before receiving ownership.',
              },
              400,
            );
          }

          if (
            targetMembership.status !== OrganisationMembershipStatusEnum.ACTIVE
          ) {
            throw new HttpException(
              {
                message:
                  'Target user must have an active membership to become organisation owner.',
              },
              400,
            );
          }
          if (organisation.owner?.id === dto.newOwnerId) {
            throw new HttpException(
              {
                message: 'The target Ownership is already existing.',
              },
              400,
            );
          }

          const orgAdminRole = await roleRepo.findOne({
            where: { name: RoleEnum.ORG_ADMIN },
          });

          const orgMemberRole = await roleRepo.findOne({
            where: { name: RoleEnum.ORG_MEMBER },
            relations: { permissions: true },
          });

          if (!orgAdminRole || !orgMemberRole) {
            throw new HttpException(
              { message: 'Required organisation roles are not configured' },
              500,
            );
          }

          // Remove all existing membership permissions for previous owner
          await membershipPermissionRepo
            .createQueryBuilder()
            .delete()
            .from(MembershipPermissionEntity)
            .where('membership_id = :membershipId', {
              membershipId: previousOwnerMembership.id,
            })
            .execute();

          // demote previous owner to ORG_MEMBER and assign ORG_MEMBER default permissions
          previousOwnerMembership.role = orgMemberRole;
          await membershipRepo.save(previousOwnerMembership);

          const defaultMemberPermissions = (
            orgMemberRole.permissions ?? []
          ).map((permission) =>
            membershipPermissionRepo.create({
              membership: previousOwnerMembership,
              permission,
            }),
          );

          if (defaultMemberPermissions.length > 0) {
            await membershipPermissionRepo.upsert(defaultMemberPermissions, {
              conflictPaths: ['membership', 'permission'],
              skipUpdateIfNoValuesChanged: true,
            });
          }

          // promote target active member to ORG_ADMIN
          targetMembership.role = orgAdminRole;
          await membershipRepo.save(targetMembership);

          // update organisation owner_id
          organisation.owner = targetMembership.user;
          await orgRepo.save(organisation);

          // record ownership transfer history
          const historyRecord = await ownershipHistoryRepo.save(
            ownershipHistoryRepo.create({
              organisation: { id: organisationId } as OrganisationEntity,
              previousOwner: { id: previousOwner.id } as any,
              newOwner: { id: targetMembership.user.id } as any,
              transferredAt: new Date(),
              reason: dto.reason?.trim() || null,
              requestId,
            }),
          );

          await auditRepo.save(
            auditRepo.create({
              actor: request.user ?? ({ id: actorUserId } as any),
              eventType: OrganisationAuditEventEnum.OWNERSHIP_TRANSFERRED,
              organisation: { id: organisationId } as OrganisationEntity,
              metadata: {
                previousOwnerId: previousOwner.id,
                newOwnerId: targetMembership.user.id,
                previousOwnerMembershipId: previousOwnerMembership.id,
                newOwnerMembershipId: targetMembership.id,
                demotedRole: RoleEnum.ORG_MEMBER,
                reason: dto.reason?.trim() || null,
                requestId,
              },
            }),
          );
          const emailPayload =
            this.emailTemplateService.sendOrganisationInfoEmail({
              recipientEmail: targetMembership.user.email,
              recipientName: targetMembership.user.firstName,
              organisationName: organisation.name,
              info: `The Ownership of Organisation ${organisation.name} has been transfered to you by ${previousOwner?.lastName} ${previousOwner.firstName}.`,
            });

          await this.emailOutboxService.create(
            entityManager,
            EmailEventTypeEnum.INFO,
            emailPayload,
          );
          // invalidate new owner cached permissions
          await invalidateMemberPermissionCache(
            this.redisClient,
            organisationId!,
            targetMembership.id,
            targetMembership.user.id,
          );
          // invalidate previous owner cached permissions
          await invalidateMemberPermissionCache(
            this.redisClient,
            organisationId!,
            previousOwnerMembership.id,
            previousOwner.id,
          );
          return {
            organisationId,
            creator: {
              id: organisation.creator?.id,
              firstName: organisation.creator?.firstName,
              lastName: organisation.creator?.lastName,
            },
            previousOwner: {
              id: previousOwner?.id,
              firstName: previousOwner?.firstName,
              lastName: previousOwner?.lastName,
            },
            newOwner: {
              id: targetMembership?.user?.id,
              firstName: targetMembership?.user?.firstName,
              lastName: targetMembership?.user?.lastName,
            },
            previousOwnerRole: RoleEnum.ORG_MEMBER,
            newOwnerRole: RoleEnum.ORG_ADMIN,
            historyId: historyRecord.id,
          };
        },
      );
      return new ApiResponseDto({
        message: 'Organisation ownership transferred successfully',
        success: true,
        data: result,
      });
    } catch (error) {
      return handleServiceMethodError(error, 'Failed to transfer ownership');
    }
  }

  //   async getOwnership(request: ExRequest) {
  //     try {
  //     } catch (error) {
  //       return handleServiceMethodError(error, 'Failed to retrieve ownership');
  //     }
  //   }

  //   async getOwnershipHistory(
  //     request: ExRequest,
  //     query: GetOwnershipHistoryQuery,
  //   ) {
  //     try {
  //     } catch (error) {
  //       return handleServiceMethodError(
  //         error,
  //         'Failed to retrieve ownership history',
  //       );
  //     }
  //   }
}
