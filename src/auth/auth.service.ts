import {
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, MoreThan, Repository } from 'typeorm';
import { type Response as ExResponse } from 'express';

import {
  OrganisationMembershipStatusEnum,
  OrganisationStatusEnum,
  RoleEnum,
  RoleScopeEnum,
} from '@/database/database.enums';
import { CustomJwtService } from '@/jwt-service/jwt.service';
import { PasswordService } from '@/password/password.service';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { UserEntity } from '@/user/user.entity';
import { UserSessionService } from '@/user_sessions/user-session.service';

import { LoginDto, LoginOrganisationDto } from './dto/login.dto';
import { ILoginMetadata, TLoginResponseData } from './auth.interface';
import { ApiResponseDto } from '@/commons/dtos/api-response.dto';
import { UserSessionEntity } from '@/user_sessions/user-session.entity';
import { uuidv7 } from 'uuidv7';
import { RefreshResponseDto } from './dto/refresh-response.dto';
import { DataSource } from 'typeorm/browser';
import { RoleEntity } from '@/roles/roles.entity';
import {
  CreateUserRequestDto,
  RegisterResponseDataDto,
} from './dto/register.dto';
import { generateOrganisationSlug } from '@/organisations/helpers/generate-organisation-slug';
import { OrganisationEntity } from '@/organisations/organisations.entity';
import { ProfileEntity } from '@/profile/profile.entity';
import { asyncStore } from '@/commons/storage/async-storage';
import { OrganisationOwnershipHistoryEntity } from '@/organisation-ownership-history/organisation-ownership-history.entity';
import { logger } from '@/commons/logger/logger.wiston';
import { handleServiceMethodError } from '@/commons/util/errorHandler';
import { LoginLockoutService } from '@/login-lockout/login-lockout.service';
import { LoginRateLimitService } from '@/login-lockout/login-rate-limit.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,

    @InjectRepository(OrganisationMembershipEntity)
    private readonly membershipRepository: Repository<OrganisationMembershipEntity>,

    @InjectRepository(UserSessionEntity)
    private readonly sessionRepository: Repository<UserSessionEntity>,

    private readonly passwordService: PasswordService,
    private readonly customJwtService: CustomJwtService,
    private readonly userSessionService: UserSessionService,

    @InjectDataSource()
    private readonly dataSource: DataSource,

    private readonly loginLockoutService: LoginLockoutService,

    private readonly loginRateLimitService: LoginRateLimitService,
  ) {}

  async register(
    dto: CreateUserRequestDto,
  ): Promise<ApiResponseDto<RegisterResponseDataDto>> {
    try {
      const passwordHash = await this.passwordService.hash(dto.password);
      const requestId = asyncStore.getStore()?.requestId;

      const registration = await this.dataSource.transaction(
        async (manager: EntityManager) => {
          const adminRole = await manager.findOne(RoleEntity, {
            where: {
              name: RoleEnum.ORG_ADMIN,
              scope: RoleScopeEnum.ORGANISATION,
              isDeleted: false,
            },
          });

          if (!adminRole) {
            throw new NotFoundException(
              'The default organisation administrator role has not been configured.',
            );
          }

          const orgExists = await manager.findOne(OrganisationEntity, {
            where: { name: dto.organisationName },
          });
          if (orgExists) {
            throw new HttpException(
              { message: 'Organisation already exists' },
              409,
            );
          }

          // generate a unique organisation slug.
          const baseSlug = generateOrganisationSlug(dto.organisationName);
          let slug = baseSlug;
          let suffix = 1;

          while (
            await manager.findOne(OrganisationEntity, {
              where: { slug },
            })
          ) {
            slug = `${baseSlug}-${suffix}`;
            suffix++;
          }

          // create the user and their profile.
          const user = manager.create(UserEntity, {
            email: dto.email,
            password: passwordHash,
            firstName: dto.firstname,
            lastName: dto.lastname,
            acceptTerms: dto.acceptTerms,
            isActive: true,
            requestId,
            profile: manager.create(ProfileEntity, {
              bio: undefined,
              avatarUrl: undefined,
              requestId,
            }),
          });

          const savedUser = await manager.save(UserEntity, user);

          const organisation = manager.create(OrganisationEntity, {
            name: dto.organisationName,
            email: dto.organisationEmail,
            slug,
            description: dto.organisationDescription,
            status: OrganisationStatusEnum.ACTIVE,
            owner: savedUser,
            creator: savedUser,
            requestId,
          });

          const savedOrganisation = await manager.save(
            OrganisationEntity,
            organisation,
          );

          // make the registering user an active organisation administrator.
          const membership = manager.create(OrganisationMembershipEntity, {
            user: savedUser,
            organisation: savedOrganisation,
            role: adminRole,
            status: OrganisationMembershipStatusEnum.ACTIVE,
            suspendedTill: null,
            requestId,
          });

          const savedMembership = await manager.save(
            OrganisationMembershipEntity,
            membership,
          );

          // record the initial ownership of the organisation.
          const ownershipHistory = manager.create(
            OrganisationOwnershipHistoryEntity,
            {
              organisation: savedOrganisation,
              previousOwner: null,
              newOwner: savedUser,
              reason: 'Initial organisation registration',
              requestId,
            },
          );

          await manager.save(
            OrganisationOwnershipHistoryEntity,
            ownershipHistory,
          );

          return {
            user: {
              id: savedUser.id,
              email: savedUser.email,
              firstName: savedUser.firstName ?? null,
              lastName: savedUser.lastName ?? null,
            },
            organisation: {
              id: savedOrganisation.id,
              name: savedOrganisation.name,
              email: savedOrganisation.email,
              slug: savedOrganisation.slug,
            },
            membership: {
              role: savedMembership.role.name,
              status: savedMembership.status,
            },
          };
        },
      );

      return {
        success: true,
        message: 'Registration completed successfully.',
        data: registration,
      };
    } catch (error) {
      console.error('REGISTRATION ERROR:', error);
      logger.error(error);
      return handleServiceMethodError(error, 'Could not create Account');
    }
  }

  async login(
    dto: LoginDto,
    metadata: ILoginMetadata,
    response: ExResponse,
  ): Promise<ApiResponseDto<TLoginResponseData>> {
    try {
      const email = dto.email.trim().toLowerCase();
      const ipAddress = metadata.ipAddress?.trim();

      if (!ipAddress) {
        throw new ServiceUnavailableException(
          'Unable to determine client IP address.',
        );
      }

      const loginRatelimitLockout =
        await this.loginRateLimitService.consumeLoginRequest(ipAddress);

      if (!loginRatelimitLockout.allowed) {
        response.setHeader(
          'Retry-After',
          String(loginRatelimitLockout.retryAfterSeconds),
        );

        throw new HttpException(
          {
            message: 'Too many login requests. Please try again later.',
          },
          429,
        );
      }

      const lockoutStatus = await this.loginLockoutService.getLockoutStatus(
        email,
        ipAddress,
      );

      if (lockoutStatus.isLocked) {
        response.setHeader(
          'Retry-After',
          String(lockoutStatus.remainingSeconds),
        );
        throw new HttpException(
          {
            message: `Too many failed login attempts. Please try again later in ${Math.ceil(lockoutStatus.remainingSeconds / 60)} minute(s).`,
          },
          429,
        );
      }
      if (!dto.password || !dto.password.trim()) {
        await this.loginLockoutService.recordFailedAttempt(email, ipAddress);
        throw new UnauthorizedException('Invalid email or password.');
      }

      const user = await this.userRepository.findOne({
        where: {
          email,
          isActive: true,
          isDeleted: false,
        },
      });

      if (!user || !user.password) {
        await this.loginLockoutService.recordFailedAttempt(email, ipAddress);
        throw new UnauthorizedException('Invalid email or password.');
      }

      const passwordIsValid = await this.passwordService.verify(
        user.password,
        dto.password,
      );

      if (!passwordIsValid) {
        await this.loginLockoutService.recordFailedAttempt(email, ipAddress);
        throw new UnauthorizedException('Invalid email or password.');
      }
      await this.loginLockoutService.resetLockout(email, ipAddress);

      // Find all eligible organisation memberships belonging to this user.
      const memberships = await this.membershipRepository
        .createQueryBuilder('membership')
        .innerJoinAndSelect('membership.organisation', 'organisation')
        .innerJoinAndSelect('membership.role', 'role')
        .innerJoin('membership.user', 'user')
        .where('user.id = :userId', { userId: user.id })
        .andWhere('membership.status = :membershipStatus', {
          membershipStatus: OrganisationMembershipStatusEnum.ACTIVE,
        })
        .andWhere('membership.isDeleted = :membershipDeleted', {
          membershipDeleted: false,
        })
        .andWhere('organisation.status = :organisationStatus', {
          organisationStatus: OrganisationStatusEnum.ACTIVE,
        })
        .andWhere('organisation.isDeleted = :organisationDeleted', {
          organisationDeleted: false,
        })
        .andWhere('role.scope = :roleScope', {
          roleScope: RoleScopeEnum.ORGANISATION,
        })
        .andWhere(
          '(membership.suspendedTill IS NULL OR membership.suspendedTill <= :now)',
          { now: new Date() },
        )
        .getMany();

      // No eligible organisation means the user cannot proceed.
      if (memberships.length === 0) {
        throw new ForbiddenException(
          'You do not have an eligible organisation membership.',
        );
      }

      let selectedMembership: OrganisationMembershipEntity | undefined;

      // If organisation ID was sent, validate that exact membership.
      if (dto.organisationId) {
        selectedMembership = memberships.find(
          (membership) => membership.organisation.id === dto.organisationId,
        );

        if (!selectedMembership) {
          throw new ForbiddenException(
            'You do not have access to the selected organisation.',
          );
        }
      } else {
        // Automatically select when the user has exactly one eligible organisation.
        if (memberships.length === 1) {
          selectedMembership = memberships[0];
        }

        // multiple eligible organisations require the user to make a selection.
        if (memberships.length > 1) {
          const organisations: LoginOrganisationDto[] = memberships.map(
            (membership) => ({
              organisationId: membership.organisation.id,
              organisationName: membership.organisation.name,
              role: membership.role.name,
            }),
          );

          return {
            success: true,
            message: 'Please select an organisation to continue.',
            data: {
              requiresOrganisationSelection: true,
              organisations,
            },
          };
        }
      }

      if (!selectedMembership) {
        throw new ForbiddenException(
          'Unable to determine the selected organisation.',
        );
      }

      // create a session only after the organisation context is established.
      const session = await this.userSessionService.createSession({
        userId: user.id,
        deviceName: null,
        userAgent: metadata.userAgent ?? null,
        ipAddress: metadata.ipAddress ?? null,
        organisationId: selectedMembership.organisation.id,
      });

      // generate the access token using the selected membership context.
      const accessToken = this.customJwtService.sign({
        id: user.id,
        organisationId: selectedMembership.organisation.id,
        organisationRole: selectedMembership.role.name,
        sid: session.sessionId,
        jti: uuidv7(),
      });

      response.setHeader('X-REFRESH-TOKEN', session.refreshToken);

      return {
        success: true,
        message: 'Login successful.',
        data: {
          requiresOrganisationSelection: false,
          accessToken,
          tokenType: 'Bearer',
          expiresAt: session.expiresAt,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
          organisationId: selectedMembership.organisation.id,
          organisationName: selectedMembership.organisation.name,
          organisationRole: selectedMembership.role.name,
        },
      };
    } catch (error) {
      console.error('LOGIN ERROR:', error);
      logger.error(error);
      return handleServiceMethodError(error, 'Could not signin');
    }
  }

  async refresh(
    refreshToken: string,
    response: ExResponse,
  ): Promise<RefreshResponseDto> {
    try {
      // rotate the presented refresh token.
      // also detects reuse of previously consumed tokens.
      const rotated =
        await this.userSessionService.rotateRefreshToken(refreshToken);

      // get the session's original user and organisation context.
      const session = await this.sessionRepository.findOne({
        where: {
          id: rotated.sessionId,
          revokedAt: IsNull(),
          expiresAt: MoreThan(new Date()),
          isDeleted: false,
        },
        relations: {
          user: true,
          organisation: true,
        },
      });

      if (!session || !session.user || !session.organisation) {
        throw new UnauthorizedException('Invalid or expired session.');
      }

      const user = session.user;
      const organisation = session.organisation;

      // confirm the user is still allowed to authenticate.
      if (!user.isActive || user.isDeleted) {
        await this.userSessionService.revokeSession(user.id, session.id);

        throw new UnauthorizedException('User account is inactive.');
      }

      // revalidate the original organisation membership.
      // this prevents a refresh from restoring access after membership
      // suspension, removal, or organisation deactivation.
      const membership = await this.membershipRepository
        .createQueryBuilder('membership')
        .innerJoinAndSelect('membership.role', 'role')
        .innerJoin('membership.user', 'user')
        .innerJoin('membership.organisation', 'organisation')
        .where('user.id = :userId', { userId: user.id })
        .andWhere('organisation.id = :organisationId', {
          organisationId: organisation.id,
        })
        .andWhere('membership.status = :membershipStatus', {
          membershipStatus: OrganisationMembershipStatusEnum.ACTIVE,
        })
        .andWhere('membership.isDeleted = false')
        .andWhere('organisation.status = :organisationStatus', {
          organisationStatus: OrganisationStatusEnum.ACTIVE,
        })
        .andWhere('organisation.isDeleted = false')
        .andWhere('role.scope = :roleScope', {
          roleScope: RoleScopeEnum.ORGANISATION,
        })
        .andWhere(
          '(membership.suspendedTill IS NULL OR membership.suspendedTill <= :now)',
          { now: new Date() },
        )
        .getOne();

      if (!membership) {
        await this.userSessionService.revokeSession(user.id, session.id);

        throw new UnauthorizedException(
          'Your organisation access is no longer active. Please log in again.',
        );
      }
      if (organisation.status === OrganisationStatusEnum.SUSPENDED) {
        await this.userSessionService.revokeSession(user.id, session.id);

        throw new UnauthorizedException(
          'Your organisation is currently suspended.',
        );
      }

      // generate a new access token using the current membership role.
      // so that role changes(by org admins) are reflected in the next access token.
      const accessToken = this.customJwtService.sign({
        id: user.id,
        organisationId: organisation.id,
        organisationRole: membership.role.name,
        sid: session.id,
        jti: uuidv7(),
      });

      response.setHeader('X-REFRESH-TOKEN', rotated.refreshToken);

      return {
        success: true,
        message: 'Token refreshed successfully.',
        data: {
          accessToken,
          tokenType: 'Bearer',
          expiresAt: rotated.expiresAt,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
          organisationId: organisation.id,
          organisationName: organisation.name,
          organisationRole: membership.role.name,
        },
      };
    } catch (error) {
      console.error('REFRESH ERROR:', error);
      logger.error(error);
      return handleServiceMethodError(error, 'Could not refresh Token');
    }
  }
}
