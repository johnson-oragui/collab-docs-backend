import { HttpException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  DataSource,
  FindOptionsWhere,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { type Request as ExRequest } from 'express';
import { asyncStore } from '@/commons/storage/async-storage';
import { handleServiceMethodError } from '@/commons/util/errorHandler';
import { ApiResponseDto } from '@/commons/dtos/api-response.dto';
import {
  OrganisationMembershipStatusEnum,
  OrganisationStatusEnum,
  RoleEnum,
} from '@/database/database.enums';
import { OrganisationAuditEventEnum } from '@/commons/enums';
import { OrganisationMembershipEntity } from './organisation-memberships.entity';
import { OrganisationMembershipSuspensionHistoryEntity } from '@/org_membership_suspension_histories/org_membership_suspension_histories.entity';
import { OrganisationAuditEntity } from '@/organisation_audit/organisation_audit.entity';
import {
  SuspendOrganisationMemberDto,
  UnsuspendOrganisationMemberDto,
} from './dto/member-suspension.dto';
import {
  GetOrganisationMembershipsInput,
  type OrganisationMembershipsResponseType,
} from './graphql/dto/get-organisation-memberships.input';
import { PaginationMetaDto } from '@/commons/dtos/pagination-meta.dto';

@Injectable()
export class OrganisationMembershipService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,

    @InjectRepository(OrganisationMembershipEntity)
    private readonly membershipRepo: Repository<OrganisationMembershipEntity>,
  ) {}

  async getMemberships(
    request: ExRequest,
    filter?: GetOrganisationMembershipsInput,
  ): Promise<OrganisationMembershipsResponseType> {
    try {
      const organisationId =
        request.organisation?.id ?? request.decodedUser?.organisationId;

      if (!organisationId) {
        throw new HttpException(
          { message: 'Organisation context is required' },
          400,
        );
      }

      const page = filter?.page ?? 1;
      const limit = filter?.limit ?? 10;

      const suspendedTillFilter = this.buildSuspendedTillCondition(filter);

      const where: FindOptionsWhere<OrganisationMembershipEntity> = {
        ...(filter?.id && { id: filter.id }),
        ...(filter?.status && { status: filter.status }),
        ...(filter?.suspendedTill && { suspendedTill: filter.suspendedTill }),
        ...(filter?.memberEmail && { user: { email: filter.memberEmail } }),
        ...(suspendedTillFilter && { suspendedTill: suspendedTillFilter }),
        organisation: {
          id: organisationId,
          status: OrganisationStatusEnum.ACTIVE,
        },
        isDeleted: false,
      };
      let [items, total]: [OrganisationMembershipEntity[], number] = [[], 0];

      try {
        items = await this.membershipRepo.find({
          where,
          relations: {
            user: true,
            role: true,
            organisation: true,
            suspensionHistories: true,
          },
          order: { createdAt: 'DESC' },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            status: true,
            role: { id: true, name: true },
            user: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              createdAt: true,
            },
            suspensionHistories: {
              id: true,
              action: true,
              createdAt: true,
              reason: true,
              suspendedTill: true,
              suspendedAt: true,
              actor: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                createdAt: true,
              },
            },
            suspendedTill: true,
            createdAt: true,
          },
        });
      } catch (error) {
        console.error(error);
      }

      const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

      const meta: PaginationMetaDto = {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1 && totalPages > 0,
      };

      return {
        data: items,
        meta,
        message: 'Organisation memberships retrieved successfully',
        success: true,
      };
    } catch (error) {
      return handleServiceMethodError(
        error,
        'Failed to retrieve organisation memberships',
      );
    }
  }

  async suspendMember(
    membershipId: string,
    dto: SuspendOrganisationMemberDto,
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

      const actorUserId = request.user?.id ?? request.decodedUser?.id;
      const actorRole =
        request.decodedUser?.organisationRole ?? request.membership?.role?.name;

      await this.dataSource.transaction(async (entityManager) => {
        const membershipRepo = entityManager.getRepository(
          OrganisationMembershipEntity,
        );
        const historyRepo = entityManager.getRepository(
          OrganisationMembershipSuspensionHistoryEntity,
        );
        const auditRepo = entityManager.getRepository(OrganisationAuditEntity);

        const membership = await membershipRepo.findOne({
          where: {
            id: membershipId,
            organisation: { id: organisationId },
            isDeleted: false,
          },
          relations: {
            user: true,
            role: true,
            organisation: { owner: true },
          },
        });

        if (!membership) {
          throw new HttpException(
            { message: 'Organisation membership not found' },
            404,
          );
        }

        if (actorUserId && membership.user?.id === actorUserId) {
          throw new HttpException(
            { message: 'You cannot suspend your own membership' },
            400,
          );
        }

        // Prevent suspending Organisation Owners
        if (
          membership.role?.name === RoleEnum.ORG_ADMIN &&
          membership?.user?.id === membership?.organisation?.owner?.id
        ) {
          throw new HttpException(
            {
              message: 'This action is Invalid!. Cannot suspend this member.',
            },
            403,
          );
        }

        // Prevent sub-admins from suspending Organisation Admins
        if (
          membership.role?.name === RoleEnum.ORG_ADMIN &&
          actorRole !== RoleEnum.ORG_ADMIN
        ) {
          throw new HttpException(
            {
              message:
                'Only an Organisation Admin can suspend another Organisation Admin',
            },
            403,
          );
        }

        // Prevent suspending the last active Organisation Admin
        if (membership.role?.name === RoleEnum.ORG_ADMIN) {
          const activeAdminCount = await membershipRepo.count({
            where: {
              organisation: { id: organisationId },
              role: { name: RoleEnum.ORG_ADMIN },
              status: OrganisationMembershipStatusEnum.ACTIVE,
              isDeleted: false,
            },
          });

          if (activeAdminCount <= 1) {
            throw new HttpException(
              {
                message:
                  'Cannot suspend the only active Organisation Admin in the organisation',
              },
              400,
            );
          }
        }

        if (membership.status === OrganisationMembershipStatusEnum.SUSPENDED) {
          throw new HttpException(
            { message: 'Member is already suspended' },
            409,
          );
        }

        if (membership.status !== OrganisationMembershipStatusEnum.ACTIVE) {
          throw new HttpException(
            {
              message: `Cannot suspend a member with status ${membership.status}`,
            },
            400,
          );
        }

        const now = new Date();
        const suspendedTill = new Date(dto.suspendedTill);

        if (suspendedTill <= now) {
          throw new HttpException(
            { message: 'suspendedTill must be a future date and time' },
            400,
          );
        }

        membership.status = OrganisationMembershipStatusEnum.SUSPENDED;
        membership.suspendedTill = suspendedTill;
        membership.requestId = requestId;
        await membershipRepo.save(membership);

        await historyRepo.save(
          historyRepo.create({
            membership: { id: membership.id } as OrganisationMembershipEntity,
            suspendedAt: now,
            suspendedTill,
            reason: dto.reason?.trim() ?? null,
            requestId,
            action: 'SUSPENDED',
            actor: request.user!,
          }),
        );

        await auditRepo.save(
          auditRepo.create({
            actor: request.user ?? null,
            eventType: OrganisationAuditEventEnum.MEMBER_SUSPENDED,
            organisation: membership.organisation ?? { id: organisationId },
            metadata: {
              membershipId: membership.id,
              targetUserId: membership.user?.id,
              targetEmail: membership.user?.email,
              role: membership.role?.name,
              suspendedAt: now,
              suspendedTill,
              reason: dto.reason?.trim() ?? null,
              requestId,
            },
          }),
        );
      });

      return new ApiResponseDto<{ status: string; suspendedTill: Date }>({
        data: {
          status: OrganisationMembershipStatusEnum.SUSPENDED,
          suspendedTill: new Date(dto.suspendedTill),
        },
        message: 'Organisation member suspended successfully',
        success: true,
      });
    } catch (error) {
      return handleServiceMethodError(
        error,
        'Failed to suspend organisation member',
      );
    }
  }

  async unsuspendMember(
    membershipId: string,
    dto: UnsuspendOrganisationMemberDto,
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

      const actorUserId = request.user?.id ?? request.decodedUser?.id;
      const actorRole =
        request.decodedUser?.organisationRole ?? request.membership?.role?.name;

      await this.dataSource.transaction(async (entityManager) => {
        const membershipRepo = entityManager.getRepository(
          OrganisationMembershipEntity,
        );
        const historyRepo = entityManager.getRepository(
          OrganisationMembershipSuspensionHistoryEntity,
        );
        const auditRepo = entityManager.getRepository(OrganisationAuditEntity);

        const membership = await membershipRepo.findOne({
          where: {
            id: membershipId,
            organisation: { id: organisationId },
            isDeleted: false,
          },
          relations: {
            user: true,
            role: true,
            organisation: true,
          },
        });

        if (!membership) {
          throw new HttpException(
            { message: 'Organisation membership not found' },
            404,
          );
        }

        if (actorUserId && membership.user?.id === actorUserId) {
          throw new HttpException(
            { message: 'You cannot unsuspend your own membership' },
            400,
          );
        }

        if (
          membership.role?.name === RoleEnum.ORG_ADMIN &&
          actorRole !== RoleEnum.ORG_ADMIN
        ) {
          throw new HttpException(
            {
              message:
                'Only an Organisation Admin can unsuspend another Organisation Admin',
            },
            403,
          );
        }

        if (membership.status !== OrganisationMembershipStatusEnum.SUSPENDED) {
          throw new HttpException(
            {
              message: `Cannot unsuspend a member with status ${membership.status.toLowerCase()}`,
            },
            400,
          );
        }

        const now = new Date();
        const previousSuspendedTill = membership.suspendedTill;

        membership.status = OrganisationMembershipStatusEnum.ACTIVE;
        membership.suspendedTill = null;
        membership.requestId = requestId;
        await membershipRepo.save(membership);

        await historyRepo.save(
          historyRepo.create({
            membership: { id: membership.id } as OrganisationMembershipEntity,
            suspendedAt: null,
            suspendedTill: null,
            reason: dto?.reason?.trim()
              ? `UNSUSPENDED: ${dto.reason.trim()}`
              : 'UNSUSPENDED',
            requestId,
            action: 'UNSUSPENDED',
            actor: request.user!,
          }),
        );

        await auditRepo.save(
          auditRepo.create({
            actor: request.user ?? null,
            eventType: OrganisationAuditEventEnum.MEMBER_UNSUSPENDED,
            organisation: membership.organisation ?? { id: organisationId },
            metadata: {
              membershipId: membership.id,
              targetUserId: membership.user?.id,
              targetEmail: membership.user?.email,
              role: membership.role?.name,
              unsuspendedAt: now,
              previousSuspendedTill,
              reason: dto?.reason?.trim() ?? null,
              requestId,
            },
          }),
        );
      });

      return new ApiResponseDto<{ status: string }>({
        data: { status: OrganisationMembershipStatusEnum.ACTIVE },
        message: 'Organisation member unsuspended successfully',
        success: true,
      });
    } catch (error) {
      return handleServiceMethodError(
        error,
        'Failed to unsuspend organisation member',
      );
    }
  }

  private buildSuspendedTillCondition(filter?: {
    suspendedTill?: Date;
    suspendedFrom?: Date;
    suspendedTo?: Date;
  }) {
    const from = filter?.suspendedFrom
      ? new Date(filter.suspendedFrom)
      : undefined;
    const to = filter?.suspendedTo ? new Date(filter.suspendedTo) : undefined;
    const exactOrSuspensionDate = filter?.suspendedTill
      ? new Date(filter.suspendedTill)
      : undefined;

    if (from && to) {
      return Between(from, to);
    }
    if (from) {
      return MoreThanOrEqual(from);
    }
    if (to) {
      return LessThanOrEqual(to);
    }
    if (exactOrSuspensionDate) {
      return exactOrSuspensionDate;
    }

    return undefined;
  }
}
