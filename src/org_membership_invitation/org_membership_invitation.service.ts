import { HttpException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { OrganisationMembershipInvitationEntity } from './org_membership_invitation.entity';
import { DataSource, Repository } from 'typeorm';
import { InviteOrganisationMemberDto } from './dto/invitation.dto';
import { handleServiceMethodError } from '@/commons/util/errorHandler';
import { type Request as ExRequest } from 'express';
import { asyncStore } from '@/commons/storage/async-storage';
import {
  EmailEventTypeEnum,
  InvitationStatusEnum,
  OrganisationMembershipStatusEnum,
  OrganisationStatusEnum,
  RoleEnum,
} from '@/database/database.enums';
import { RoleEntity } from '@/roles/roles.entity';
import { PermissionEntity } from '@/permissions/permissions.entity';
import {
  OrganisationAuditEventEnum,
  PermissionAssignmentModeEnum,
} from '@/commons/enums';
import { nestedPermissionsToPermissionNames } from '@/commons/util/groupPermissionsToNested';
import { UserEntity } from '@/user/user.entity';
import { InvitationPermissionEntity } from '@/invitation_permissions/invitation_permissions.entity';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { OrganisationAuditEntity } from '@/organisation_audit/organisation_audit.entity';
import { EmailOutboxService } from '@/email-outbox/email-outbox.service';
import { EmailTemplateService } from '@/email/email-template.service';
import { ApiResponseDto } from '@/commons/dtos/api-response.dto';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { MembershipPermissionEntity } from '@/membership_permissions/membership_permissions.entity';
import { PASSWORD_RECOVERY } from '@/password-recovery/password-recovery.constants';
import { PasswordResetTokenEntity } from '@/password-recovery/password-recovery.entity';
import { GetOrganisationInvitationsQueryDto } from './dto/get-invitations-query.dto';
import { PaginationMetaDto } from '@/commons/dtos/pagination-meta.dto';
import { OrganisationEntity } from '@/organisations/organisations.entity';

@Injectable()
export class OrganisationmembershipinvitationService {
  EXPIRY_DAYS: number;
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,

    private readonly emailOutboxService: EmailOutboxService,

    private readonly emailTemplateService: EmailTemplateService,

    private readonly configService: ConfigService,

    @InjectRepository(OrganisationMembershipInvitationEntity)
    private readonly organisationMembershipInvitationRepo: Repository<OrganisationMembershipInvitationEntity>,
  ) {
    this.EXPIRY_DAYS = Number(
      this.configService.getOrThrow('ACCOUNT_VERIFICATION_TOKEN_EXPIRY_DAYS') ??
        '7',
    );
  }

  async getInvitations(
    query: GetOrganisationInvitationsQueryDto,
    request: ExRequest,
  ) {
    try {
      const organisationId =
        request.organisation?.id ?? request.decodedUser?.organisationId;

      if (!organisationId) {
        throw new HttpException(
          { message: 'Organisation context is required' },
          400,
        );
      }

      const page = query.page ?? 1;
      const limit = query.limit ?? 10;
      const now = new Date();

      const qb = this.organisationMembershipInvitationRepo
        .createQueryBuilder('invitation')
        .leftJoinAndSelect('invitation.organisation', 'organisation')
        .leftJoinAndSelect('invitation.role', 'role')
        .leftJoinAndSelect('invitation.invitedBy', 'invitedBy')
        .leftJoinAndSelect('invitation.revokedBy', 'revokedBy')
        .select([
          'invitation.id',
          'invitation.createdAt',
          'invitation.updatedAt',
          'invitation.email',
          'invitation.firstName',
          'invitation.lastName',
          'invitation.expiresAt',
          'invitation.revokedAt',
          'invitation.resentAt',
          'invitation.status',
          'invitation.permissionMode',
          // 'organisation.id',
          // 'organisation.name',
          // 'organisation.slug',
          // 'organisation.status',
          // 'role.id',
          'role.name',
          // 'role.scope',
          'invitedBy.id',
          'invitedBy.email',
          'invitedBy.firstName',
          'invitedBy.lastName',
          'revokedBy.id',
          'revokedBy.email',
          'revokedBy.firstName',
          'revokedBy.lastName',
        ])
        .where('organisation.id = :organisationId', { organisationId });

      if (query.invitationId) {
        qb.andWhere('invitation.id = :invitationId', {
          invitationId: query.invitationId,
        });
      }

      if (query.email) {
        qb.andWhere('invitation.email = :email', {
          email: query.email,
        });
      }

      if (query.status) {
        qb.andWhere('invitation.status = :status', { status: query.status });
      }

      if (query.role) {
        qb.andWhere('role.name = :roleName', { roleName: query.role });
      }

      if (typeof query.expired === 'boolean') {
        if (query.expired) {
          qb.andWhere('invitation.expiresAt <= :now', { now });
        } else {
          qb.andWhere('invitation.expiresAt > :now', { now });
        }
      }

      if (query.expiredFrom) {
        qb.andWhere('invitation.expiresAt >= :expiredFrom', {
          expiredFrom: new Date(query.expiredFrom),
        });
      }

      if (query.expiredTo) {
        qb.andWhere('invitation.expiresAt <= :expiredTo', {
          expiredTo: new Date(query.expiredTo),
        });
      }

      qb.orderBy('invitation.createdAt', 'DESC')
        .skip((page - 1) * limit)
        .take(limit);

      const [items, total] = await qb.getManyAndCount();
      const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

      const meta: PaginationMetaDto = {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1 && totalPages > 0,
      };

      return new ApiResponseDto<
        OrganisationMembershipInvitationEntity[],
        PaginationMetaDto
      >({
        data: items,
        meta,
        message: 'Invitations retrieved successfully',
        success: true,
      });
    } catch (error) {
      return handleServiceMethodError(
        error,
        'Failed to retrieve organisation invitations',
      );
    }
  }

  /**
   * TODO: Check whether the organisation has reached its maximum member count, if applicable.
   * Check whether the organisation has reached its maximum administrator or sub-administrator count.
   * Check whether the requested role is permitted by the organisation's subscription or plan.
   * Decide whether pending invitations count towards membership limits.
   * Prevent concurrent invitations from exceeding the organisation's limits.
   * @param dto
   * @param request
   * @returns
   */
  async inviteMember(dto: InviteOrganisationMemberDto, request: ExRequest) {
    const requestId = asyncStore.getStore()?.requestId;
    const email = dto.email?.toLowerCase().trim();
    try {
      // TODO: Consider using the role_permission for a role if when the permissionMode is default
      // instead of copying into member-permission table
      const organisationRole =
        request.decodedUser?.organisationRole ?? request.membership?.role?.name;
      if (
        organisationRole !== RoleEnum.ORG_ADMIN &&
        dto.role !== RoleEnum.ORG_MEMBER
      ) {
        throw new HttpException(
          {
            message: 'Only an Organisation Admin can assign an Admin role type',
            success: false,
          },
          403,
        );
      }
      const organisationId =
        request.organisation?.id ?? request.decodedUser?.organisationId;

      const invitationToken = this.generateInvitationToken();
      const invitationTokenHash = this.hashInvitationToken(invitationToken);

      const resetUrl = new URL(
        '/accept-invitation',
        this.configService.getOrThrow<string>('APP_BASE_URL'),
      );
      resetUrl.searchParams.set('token', invitationToken);

      const data = await this.dataSource.transaction(async (entityManager) => {
        const userRepository = entityManager.getRepository(UserEntity);
        const organisationMembershipInvitationRepo =
          entityManager.getRepository(OrganisationMembershipInvitationEntity);
        const roleRepository = entityManager.getRepository(RoleEntity);
        const invitationPermissionRepository = entityManager.getRepository(
          InvitationPermissionEntity,
        );
        const organisationAuditRepository = entityManager.getRepository(
          OrganisationAuditEntity,
        );
        const organisationRepository =
          entityManager.getRepository(OrganisationEntity);

        const userExists = await userRepository.findOne({
          where: {
            email,
            isDeleted: false,
          },
          relations: { organisationMemberships: { organisation: true } },
        });
        if (userExists) {
          const userOrgMember = userExists.organisationMemberships.find(
            (membership) => membership.organisation.id === organisationId,
          );
          if (
            userOrgMember?.status === OrganisationMembershipStatusEnum.ACTIVE
          ) {
            throw new HttpException(
              {
                message:
                  'The intended Invitation is already an active member of your Organisation',
              },
              409,
            );
          }
        }

        const invitationExists =
          await organisationMembershipInvitationRepo.findOne({
            where: { email, organisation: { id: organisationId } },
          });
        if (invitationExists) {
          if (invitationExists.expiresAt > new Date()) {
            throw new HttpException(
              {
                message:
                  'An invitation already exists for the User and has not expired',
              },
              409,
            );
          }
        }

        let permissions: PermissionEntity[];

        const role = await roleRepository.findOne({
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
        } else if (dto.permissionMode === PermissionAssignmentModeEnum.NONE) {
          permissions = [];
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

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + this.EXPIRY_DAYS);

        const newOrganisationMembershipInvitation =
          await organisationMembershipInvitationRepo.save(
            organisationMembershipInvitationRepo.create({
              email,
              firstName: dto.firstName,
              requestId,
              invitedBy: { id: request.user!.id },
              permissionMode: dto.permissionMode ?? 'DEFAULT', // fallback when role is ORG_ADMIN
              status: InvitationStatusEnum.PENDING,
              expiresAt,
              role,
              lastName: dto.lastName,
              token: invitationTokenHash,
              organisation: { id: organisationId },
            }),
          );

        const invitationPermissions = (permissions ?? []).map((permission) => {
          return invitationPermissionRepository.create({
            invitation: newOrganisationMembershipInvitation,
            permission,
          });
        });

        await invitationPermissionRepository.upsert(invitationPermissions, {
          conflictPaths: ['invitation', 'permission'],
          skipUpdateIfNoValuesChanged: true,
        });
        await organisationAuditRepository.save(
          organisationAuditRepository.create({
            actor: request.user ?? null,
            eventType: OrganisationAuditEventEnum.INVITATION_CREATED,
            organisation: request.organisation ?? undefined,
            metadata: {
              email,
              firstName: dto.firstName,
              requestId,
              permissionMode: dto.permissionMode,
              status: InvitationStatusEnum.PENDING,
              expiresAt,
              lastName: dto.lastName,
              role: role.name,
              inviteeExists: !!userExists,
            },
          }),
        );

        let organisationName = request.organisation?.name;

        if (!organisationName) {
          organisationName = (
            await organisationRepository.findOne({
              where: { id: organisationId },
              select: { name: true },
            })
          )?.name;
          if (!organisationName) {
            throw new Error('Organisation missing required "name" field.');
          }
        }

        const emailPayload =
          this.emailTemplateService.createOrganisationInvitationEmail({
            recipientEmail: dto.email,
            recipientName: dto.firstName,
            actionUrl: resetUrl.toString(),
            expiresIn: `${this.EXPIRY_DAYS} days`,
            organisationName,
          });

        await this.emailOutboxService.create(
          entityManager,
          EmailEventTypeEnum.ORGANISATION_INVITATION,
          emailPayload,
        );
        return {
          id: newOrganisationMembershipInvitation.id,
          status: newOrganisationMembershipInvitation.status,
        };
      });
      return new ApiResponseDto<{
        status: string;
        id: string;
      }>({
        data,
        message: 'Invitation Sent',
        success: true,
      });
    } catch (error) {
      return handleServiceMethodError(error, 'Failed to invite new Member');
    }
  }

  async acceptInvitation(request: ExRequest, token: string) {
    const requestId = asyncStore.getStore()?.requestId;
    try {
      const invitationTokenHash = this.hashInvitationToken(token);

      let isNewUser = true;

      const data = await this.dataSource.transaction(async (entityManager) => {
        const userRepository = entityManager.getRepository(UserEntity);
        const organisationMembershipInvitationRepo =
          entityManager.getRepository(OrganisationMembershipInvitationEntity);
        const organisationMembershipRepo = entityManager.getRepository(
          OrganisationMembershipEntity,
        );
        const orgMembershipPermissionRepo = entityManager.getRepository(
          MembershipPermissionEntity,
        );
        const invitationPermissionRepo = entityManager.getRepository(
          InvitationPermissionEntity,
        );
        const organisationAuditRepository = entityManager.getRepository(
          OrganisationAuditEntity,
        );
        const tokenRepository = entityManager.getRepository(
          PasswordResetTokenEntity,
        );
        const now = new Date();

        const expiresAt = new Date(
          now.getTime() + PASSWORD_RECOVERY.TOKEN_EXPIRY_MINUTES * 60 * 1000,
        );

        const invitationExists =
          await organisationMembershipInvitationRepo.findOne({
            where: { token: invitationTokenHash },
            relations: {
              organisation: true,
              role: true,
            },
          });
        if (
          invitationExists?.organisation?.isDeleted ||
          invitationExists?.organisation?.status ===
            OrganisationStatusEnum.SUSPENDED
        ) {
          throw new HttpException(
            {
              message:
                'Cannot accept Invitation. The Organization is suspended!',
            },
            400,
          );
        }
        if (
          !invitationExists ||
          invitationExists.status !== InvitationStatusEnum.PENDING
        ) {
          const message =
            invitationExists?.status === 'ACCEPTED'
              ? 'Invitation already accepted'
              : invitationExists?.status === 'EXPIRED'
                ? 'Invitation has expired'
                : invitationExists?.status === 'REVOKED'
                  ? 'Invitation has been revoked'
                  : 'Invalid Invitation';
          throw new HttpException({ message }, 400);
        }

        if (invitationExists.expiresAt <= now) {
          invitationExists.status = InvitationStatusEnum.EXPIRED;
          await organisationMembershipInvitationRepo.save(invitationExists);
          throw new HttpException({ message: 'Invitation has expired!' }, 400);
        }

        let userExists = await userRepository.findOne({
          where: { email: invitationExists.email },
        });
        isNewUser = !!userExists;
        if (!userExists) {
          userExists = await userRepository.save(
            userRepository.create({
              email: invitationExists.email,
              firstName: invitationExists.firstName,
              lastName: invitationExists.lastName,
              profile: { createdAt: now },
              emailVerifiedAt: now,
              isActive: true,
              acceptTerms: true,
              requestId,
            }),
          );
        }

        invitationExists.status = InvitationStatusEnum.ACCEPTED;
        await organisationMembershipInvitationRepo.save(invitationExists);

        const newMembership = await organisationMembershipRepo.save(
          organisationMembershipRepo.create({
            requestId,
            organisation: invitationExists.organisation,
            role: { id: invitationExists.role.id },
            user: userExists,
            status: OrganisationMembershipStatusEnum.ACTIVE,
          }),
        );

        const invitationPermissions = await invitationPermissionRepo.find({
          where: { invitation: { id: invitationExists.id } },
          select: { permission: true },
          relations: { permission: true },
        });

        if (invitationPermissions.length > 0) {
          const newMembershipPermissions = invitationPermissions.map(
            (invitationPermission) => {
              return orgMembershipPermissionRepo.create({
                membership: newMembership,
                permission: invitationPermission.permission,
              });
            },
          );

          await orgMembershipPermissionRepo.upsert(newMembershipPermissions, {
            conflictPaths: ['membership', 'permission'],
            skipUpdateIfNoValuesChanged: true,
          });
        }
        await organisationAuditRepository.save(
          organisationAuditRepository.create({
            actor: request.user ?? null,
            eventType: OrganisationAuditEventEnum.INVITATION_ACCEPTED,
            organisation: invitationExists.organisation ?? undefined,
            metadata: {
              email: invitationExists.email,
              firstName: invitationExists.firstName,
              requestId,
              permissionMode: invitationExists.permissionMode,
              status: InvitationStatusEnum.PENDING,
              acceptedAt: now,
              lastName: invitationExists.lastName,
              role: invitationExists.role.name,
              userAlreadyExists: !isNewUser,
            },
          }),
        );
        if (isNewUser) {
          const resetUrl = new URL(
            '/reset-password',
            this.configService.getOrThrow<string>('APP_BASE_URL'),
          );
          const rawToken = this.generateInvitationToken(
            PASSWORD_RECOVERY.TOKEN_BYTES,
          );
          const tokenHash = this.hashInvitationToken(rawToken);

          resetUrl.searchParams.set('token', rawToken);

          // Revoke previously issued, unused reset tokens.
          await tokenRepository
            .createQueryBuilder()
            .update(PasswordResetTokenEntity)
            .set({ revokedAt: now })
            .where('user_id = :userId', { userId: userExists.id })
            .andWhere('used_at IS NULL')
            .andWhere('revoked_at IS NULL')
            .andWhere('purpose = :purpose', {
              purpose: EmailEventTypeEnum.PASSWORD_RESET,
            })
            .execute();

          await tokenRepository.save(
            tokenRepository.create({
              user: { id: userExists.id } as UserEntity,
              tokenHash,
              expiresAt,
              usedAt: null,
              revokedAt: null,
              requestedFromIp: request.ip,
              purpose: EmailEventTypeEnum.PASSWORD_RESET,
            }),
          );
          const emailPayload =
            this.emailTemplateService.createPasswordResetEmail({
              recipientEmail: userExists.email,
              recipientName: userExists.firstName ?? undefined,
              actionUrl: resetUrl.toString(),
              expiresIn: `${PASSWORD_RECOVERY.TOKEN_EXPIRY_MINUTES} minutes`,
            });

          await this.emailOutboxService.create(
            entityManager,
            EmailEventTypeEnum.PASSWORD_RESET,
            emailPayload,
          );

          return {
            id: invitationExists.id,
            status: invitationExists.status,
          };
        }
      });

      return new ApiResponseDto({
        message: isNewUser
          ? 'Proceed to adding a password by following the link in your email.'
          : 'Invitation was accepted successfully.',
        success: true,
        data,
      });
    } catch (error) {
      return handleServiceMethodError(error, 'Failed to accept Invitation.');
    }
  }
  async revokeInvitation(invitationId: string, request: ExRequest) {
    const requestId = asyncStore.getStore()?.requestId;
    try {
      const organisationId =
        request.organisation?.id ?? request.decodedUser?.organisationId;

      if (!organisationId) {
        throw new HttpException(
          { message: 'Organisation context is required' },
          400,
        );
      }

      const data = await this.dataSource.transaction(async (entityManager) => {
        const invitationRepo = entityManager.getRepository(
          OrganisationMembershipInvitationEntity,
        );
        const auditRepo = entityManager.getRepository(OrganisationAuditEntity);

        const invitation = await invitationRepo.findOne({
          where: {
            id: invitationId,
            organisation: { id: organisationId },
          },
          relations: {
            organisation: true,
            role: true,
          },
        });

        if (!invitation) {
          throw new HttpException(
            { message: 'Invitation not found for this organisation' },
            404,
          );
        }

        if (invitation.status !== InvitationStatusEnum.PENDING) {
          throw new HttpException(
            {
              message: `Cannot revoke an invitation with status ${invitation.status.toLowerCase()}`,
            },
            400,
          );
        }

        const now = new Date();
        invitation.status = InvitationStatusEnum.REVOKED;
        invitation.revokedAt = now;
        invitation.revokedBy = { id: request.user!.id } as UserEntity;

        await invitationRepo.save(invitation);

        await auditRepo.save(
          auditRepo.create({
            actor: request.user ?? null,
            eventType: OrganisationAuditEventEnum.INVITATION_REVOKED,
            organisation: invitation.organisation ?? { id: organisationId },
            metadata: {
              invitationId: invitation.id,
              email: invitation.email,
              role: invitation.role?.name,
              revokedAt: now,
              revokedById: request.user?.id ?? null,
              requestId,
            },
          }),
        );
        return { id: invitation.id, status: invitation.status };
      });

      return new ApiResponseDto<{ status: string }>({
        data,
        message: 'Invitation revoked successfully',
        success: true,
      });
    } catch (error) {
      return handleServiceMethodError(error, 'Failed to revoke invitation');
    }
  }

  async resendInvitation(invitationId: string, request: ExRequest) {
    const requestId = asyncStore.getStore()?.requestId;
    try {
      const organisationId =
        request.organisation?.id ?? request.decodedUser?.organisationId;

      if (!organisationId) {
        throw new HttpException(
          { message: 'Organisation context is required' },
          400,
        );
      }

      const rawToken = this.generateInvitationToken();
      const tokenHash = this.hashInvitationToken(rawToken);

      const inviteUrl = new URL(
        '/accept-invitation',
        this.configService.getOrThrow<string>('APP_BASE_URL'),
      );
      inviteUrl.searchParams.set('token', rawToken);

      const data = await this.dataSource.transaction(async (entityManager) => {
        const invitationRepo = entityManager.getRepository(
          OrganisationMembershipInvitationEntity,
        );
        const auditRepo = entityManager.getRepository(OrganisationAuditEntity);
        const now = new Date();

        const invitation = await invitationRepo.findOne({
          where: {
            id: invitationId,
            organisation: { id: organisationId },
          },
          relations: {
            organisation: true,
            role: true,
          },
        });

        if (!invitation) {
          throw new HttpException(
            { message: 'Invitation not found for this organisation' },
            404,
          );
        }

        if (
          invitation.organisation?.isDeleted ||
          invitation.organisation?.status === OrganisationStatusEnum.SUSPENDED
        ) {
          throw new HttpException(
            {
              message:
                'Cannot resend invitation because the organisation is suspended.',
            },
            400,
          );
        }

        if (invitation.status === InvitationStatusEnum.REVOKED) {
          throw new HttpException(
            {
              message:
                'Revoked invitations cannot be resent. Kindly send a new Invitation',
            },
            400,
          );
        }

        if (invitation.status !== InvitationStatusEnum.PENDING) {
          throw new HttpException(
            {
              message: `Cannot resend an invitation with status ${invitation.status.toLowerCase()}`,
            },
            400,
          );
        }

        const wasExpired = invitation.expiresAt <= now;
        const nextExpiresAt = new Date(now);
        nextExpiresAt.setDate(nextExpiresAt.getDate() + this.EXPIRY_DAYS);

        invitation.token = tokenHash;
        invitation.expiresAt = nextExpiresAt;
        invitation.resentAt = now;

        await invitationRepo.save(invitation);

        await auditRepo.save(
          auditRepo.create({
            actor: request.user ?? null,
            eventType: OrganisationAuditEventEnum.INVITATION_RESENT,
            organisation: invitation.organisation ?? { id: organisationId },
            metadata: {
              invitationId: invitation.id,
              email: invitation.email,
              role: invitation.role?.name,
              wasExpired,
              newExpiresAt: nextExpiresAt,
              resentAt: now,
              requestId,
            },
          }),
        );

        const emailPayload =
          this.emailTemplateService.createOrganisationInvitationEmail({
            recipientEmail: invitation.email,
            recipientName: invitation.firstName ?? undefined,
            actionUrl: inviteUrl.toString(),
            expiresIn: `${this.EXPIRY_DAYS} days`,
          });

        await this.emailOutboxService.create(
          entityManager,
          EmailEventTypeEnum.ORGANISATION_INVITATION,
          emailPayload,
        );
        return { id: invitation.id, status: invitation.status };
      });

      return new ApiResponseDto<{ status: string }>({
        data,
        message: 'Invitation resent successfully',
        success: true,
      });
    } catch (error) {
      return handleServiceMethodError(error, 'Failed to resend invitation');
    }
  }

  private generateInvitationToken(size: number = 32): string {
    return randomBytes(size).toString('base64url');
  }

  private hashInvitationToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }
}
