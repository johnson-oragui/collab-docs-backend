import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomBytes, randomUUID } from 'node:crypto';

import { createE2eApp } from '@/test/fixtures/create-e2e-app';
import { createHttpClient } from '@/test/fixtures/helpers/http-request';

import { UserEntity } from '@/user/user.entity';
import { ProfileEntity } from '@/profile/profile.entity';
import { OrganisationEntity } from '@/organisations/organisations.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { MembershipPermissionEntity } from '@/membership_permissions/membership_permissions.entity';
import { RoleEntity } from '@/roles/roles.entity';
import { OrganisationOwnershipHistoryEntity } from '@/organisation-ownership-history/organisation-ownership-history.entity';
import { OrganisationAuditEntity } from '@/organisation_audit/organisation_audit.entity';
import { UserSessionEntity } from '@/user_sessions/user-session.entity';
import { UserSessionTokenEntity } from '@/user-session-token/user-session-token.entity';
import { EmailVerificationService } from '@/email-verification/email-verification.service';
import {
  OrganisationMembershipStatusEnum,
  RoleEnum,
  TOrganisationMembershipStatusEnum,
  TRoleEnum,
} from '@/database/database.enums';
import { OrganisationAuditEventEnum } from '@/commons/enums';
import { PasswordService } from '@/password/password.service';

describe('Organisation Ownership Transfer (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof createHttpClient>;
  let dataSource: DataSource;
  let emailVerificationService: EmailVerificationService;
  let passwordService: PasswordService;

  let ownerAccessToken: string;
  let ownerUserId: string;
  let ownerOrgId: string;
  let password: string;
  let getTokenSpy: jest.SpyInstance;

  let outsiderUserId: string;
  let secondOrgAccessToken: string;

  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];

  const transferUrl = 'organisation-ownership/transfer';

  const createRegistrationPayload = (prefix = 'own-transfer') => {
    const uniqueId = randomUUID().replace(/-/g, '');
    return {
      email: `${prefix}-${uniqueId}@example.com`,
      password: 'StrongPassword123#',
      confirmPassword: 'StrongPassword123#',
      acceptTerms: true,
      firstname: 'Grace',
      lastname: 'Hopper',
      organisationName: `Ownership Org ${uniqueId}`,
      organisationDescription: 'Ownership transfer E2E test org.',
      organisationEmail: `own-org-${uniqueId}@example.com`,
    };
  };

  const registerVerifyAndLogin = async (prefix: string) => {
    const payload = createRegistrationPayload(prefix);
    const token = randomBytes(32).toString('base64url');
    getTokenSpy.mockReturnValueOnce(token);

    const regRes = await http
      .post('/api/v1/auth/register')
      .send(payload)
      .expect(201);

    const userId: string = regRes.body.data.user.id;
    const orgId: string = regRes.body.data.organisation.id;
    createdUserIds.push(userId);
    createdOrgIds.push(orgId);

    await http.post('/api/v1/auth/verify-email').send({ token }).expect(201);

    const loginRes = await http
      .post('/api/v1/auth/login')
      .send({ email: payload.email, password: payload.password })
      .expect(200);

    return {
      userId,
      orgId,
      password: payload.password,
      accessToken: loginRes.body.data.accessToken as string,
    };
  };

  const createMemberInOrg = async (
    orgId: string,
    roleName: TRoleEnum,
    sharedPassword: string,
    status: TOrganisationMembershipStatusEnum = OrganisationMembershipStatusEnum.ACTIVE,
  ) => {
    const userRepo = dataSource.getRepository(UserEntity);
    const membershipRepo = dataSource.getRepository(
      OrganisationMembershipEntity,
    );
    const membershipPermissionRepo = dataSource.getRepository(
      MembershipPermissionEntity,
    );
    const roleRepo = dataSource.getRepository(RoleEntity);

    const role = await roleRepo.findOne({
      where: { name: roleName },
      relations: { permissions: true },
    });
    if (!role) {
      throw new Error(`Role ${roleName} not seeded in test database`);
    }

    const email = `own-member-${randomUUID().slice(0, 8)}@example.com`;
    const user = await userRepo.save(
      userRepo.create({
        email,
        firstName: 'Linus',
        lastName: 'Torvalds',
        password: await passwordService.hash(sharedPassword),
        emailVerifiedAt: new Date(),
        isActive: true,
        acceptTerms: true,
      }),
    );
    createdUserIds.push(user.id);

    const membership = await membershipRepo.save(
      membershipRepo.create({
        user: { id: user.id } as UserEntity,
        organisation: { id: orgId } as OrganisationEntity,
        role,
        status,
      }),
    );
    const permissions = role.permissions.map((p) =>
      membershipPermissionRepo.create({ membership, permission: p }),
    );
    await membershipPermissionRepo.upsert(permissions, {
      skipUpdateIfNoValuesChanged: true,
      conflictPaths: ['membership', 'permission'],
    });

    return { userId: user.id, membershipId: membership.id, email };
  };

  beforeAll(async () => {
    app = await createE2eApp();
    http = createHttpClient(app);
    dataSource = app.get(DataSource);
    emailVerificationService = app.get(EmailVerificationService);
    passwordService = app.get(PasswordService);

    const initialToken = randomBytes(32).toString('base64url');
    getTokenSpy = jest
      .spyOn(emailVerificationService as any, 'getToken')
      .mockReturnValue(initialToken);

    const ownerPayload = createRegistrationPayload('own-owner');
    const regRes = await http
      .post('/api/v1/auth/register')
      .send(ownerPayload)
      .expect(201);

    ownerUserId = regRes.body.data.user.id;
    ownerOrgId = regRes.body.data.organisation.id;
    password = ownerPayload.password;
    createdUserIds.push(ownerUserId);
    createdOrgIds.push(ownerOrgId);

    await http
      .post('/api/v1/auth/verify-email')
      .send({ token: initialToken })
      .expect(201);

    const loginRes = await http
      .post('/api/v1/auth/login')
      .send({ email: ownerPayload.email, password: ownerPayload.password })
      .expect(200);

    ownerAccessToken = loginRes.body.data.accessToken;

    const secondOrg = await registerVerifyAndLogin('own-second');
    secondOrgAccessToken = secondOrg.accessToken;

    const outsiderRepo = dataSource.getRepository(UserEntity);
    const outsider = await outsiderRepo.save(
      outsiderRepo.create({
        email: `outsider-${randomUUID().slice(0, 8)}@example.com`,
        firstName: 'Ada',
        lastName: 'Byron',
        password: await passwordService.hash(password),
        emailVerifiedAt: new Date(),
        isActive: true,
        acceptTerms: true,
      }),
    );
    outsiderUserId = outsider.id;
    createdUserIds.push(outsiderUserId);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      if (createdUserIds.length > 0) {
        const memberships = await dataSource
          .getRepository(OrganisationMembershipEntity)
          .find({
            where: createdUserIds.map((id) => ({ user: { id } })),
          });
        const membershipIds = memberships.map((m) => m.id);

        if (membershipIds.length > 0) {
          await dataSource
            .getRepository(MembershipPermissionEntity)
            .createQueryBuilder()
            .delete()
            .where('"membership_id" IN (:...membershipIds)', { membershipIds })
            .execute();
        }

        await dataSource
          .getRepository(OrganisationOwnershipHistoryEntity)
          .createQueryBuilder()
          .delete()
          .where(
            '"previous_owner_id" IN (:...userIds) OR "new_owner_id" IN (:...userIds)',
            { userIds: createdUserIds },
          )
          .execute();

        const sessions = await dataSource
          .getRepository(UserSessionEntity)
          .find({
            where: createdUserIds.map((userId) => ({ user: { id: userId } })),
          });
        const sessionIds = sessions.map((s) => s.id);

        if (sessionIds.length > 0) {
          await dataSource
            .getRepository(UserSessionTokenEntity)
            .createQueryBuilder()
            .delete()
            .where('"session_id" IN (:...sessionIds)', { sessionIds })
            .execute();

          await dataSource.getRepository(UserSessionEntity).delete(sessionIds);
        }
      }

      if (createdOrgIds.length > 0) {
        await dataSource
          .getRepository(OrganisationOwnershipHistoryEntity)
          .createQueryBuilder()
          .delete()
          .where('"organisation_id" IN (:...createdOrgIds)', { createdOrgIds })
          .execute();

        await dataSource
          .getRepository(OrganisationAuditEntity)
          .createQueryBuilder()
          .delete()
          .where('"organisation_id" IN (:...createdOrgIds)', { createdOrgIds })
          .execute();

        await dataSource
          .getRepository(OrganisationMembershipEntity)
          .createQueryBuilder()
          .delete()
          .where('"organisation_id" IN (:...createdOrgIds)', { createdOrgIds })
          .execute();

        await dataSource
          .getRepository(OrganisationEntity)
          .delete(createdOrgIds);
      }

      if (createdUserIds.length > 0) {
        const users = await dataSource.getRepository(UserEntity).find({
          where: createdUserIds.map((id) => ({ id })),
          relations: { profile: true },
        });

        await dataSource.getRepository(UserEntity).delete(createdUserIds);

        const profileIds = users
          .map((u) => u.profile?.id)
          .filter((id): id is string => Boolean(id));

        if (profileIds.length > 0) {
          await dataSource.getRepository(ProfileEntity).delete(profileIds);
        }
      }
    }

    getTokenSpy?.mockRestore();

    if (app) {
      await app.close();
    }
  });

  describe('Authentication & Authorization Guards', () => {
    it('should return 401 when unauthenticated', async () => {
      const res = await http.post(transferUrl).send({
        newOwnerId: outsiderUserId,
        reason: 'Unauthenticated transfer',
      });

      expect(res.statusCode).toBe(401);
    });

    it('should return 403 when initiated by a non-owner to self', async () => {
      const member = await createMemberInOrg(
        ownerOrgId,
        RoleEnum.ORG_ADMIN,
        password,
        OrganisationMembershipStatusEnum.ACTIVE,
      );
      const loginRes = await http
        .post('/api/v1/auth/login')
        .send({ email: member.email, password })
        .expect(200);

      const memebrAccessToken = loginRes.body.data.accessToken;

      const res = await http
        .post(transferUrl)
        .set('Authorization', `Bearer ${memebrAccessToken}`)
        .send({
          newOwnerId: member.userId,
          reason: 'Non-owner transfer attempt',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe(
        'You cannot transfer organisation ownership to yourself',
      );
    });

    it('should return 403 when initiated by a non-owner to a target non-owner', async () => {
      const member = await createMemberInOrg(
        ownerOrgId,
        RoleEnum.ORG_ADMIN,
        password,
        OrganisationMembershipStatusEnum.ACTIVE,
      );
      const member2 = await createMemberInOrg(
        ownerOrgId,
        RoleEnum.ORG_ADMIN,
        password,
        OrganisationMembershipStatusEnum.ACTIVE,
      );
      const loginRes = await http
        .post('/api/v1/auth/login')
        .send({ email: member.email, password })
        .expect(200);

      const memebrAccessToken = loginRes.body.data.accessToken;

      const res = await http
        .post(transferUrl)
        .set('Authorization', `Bearer ${memebrAccessToken}`)
        .send({
          newOwnerId: member2.userId,
          reason: 'Non-owner transfer attempt',
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toBe(
        'Only the current organisation owner can transfer ownership.',
      );
    });

    it('should return 400 when initiated by a non-member', async () => {
      const member = await createMemberInOrg(
        ownerOrgId,
        RoleEnum.ORG_MEMBER,
        password,
        OrganisationMembershipStatusEnum.ACTIVE,
      );

      const res = await http
        .post(transferUrl)
        .set('Authorization', `Bearer ${secondOrgAccessToken}`)
        .send({
          newOwnerId: member.userId,
          reason: 'Non-owner transfer attempt',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe(
        'Target user must be a member of this organisation before receiving ownership.',
      );
    });
  });

  describe('Target Member Eligibility Validation', () => {
    it('should return 400 when target user is not a member of the organisation', async () => {
      const res = await http
        .post(transferUrl)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          newOwnerId: outsiderUserId,
          reason: 'Outsider cannot receive ownership',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe(
        'Target user must be a member of this organisation before receiving ownership.',
      );
    });

    it('should return 400 when target member is not ACTIVE (e.g., PENDING or SUSPENDED)', async () => {
      const pendingMember = await createMemberInOrg(
        ownerOrgId,
        RoleEnum.ORG_MEMBER,
        password,
        OrganisationMembershipStatusEnum.PENDING,
      );

      const res = await http
        .post(transferUrl)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          newOwnerId: pendingMember.userId,
          reason: 'Inactive target member',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe(
        'Target user must have an active membership to become organisation owner.',
      );
    });
  });

  describe('Successful Ownership Transfer, Demotion & History', () => {
    it('should transfer ownership, demote previous owner to ORG_MEMBER with default permissions, preserve creator, and record history', async () => {
      const nextOwner = await createMemberInOrg(
        ownerOrgId,
        RoleEnum.ORG_MEMBER,
        password,
        OrganisationMembershipStatusEnum.ACTIVE,
      );

      const reason = 'Planned leadership handover';
      const res = await http
        .post(transferUrl)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          newOwnerId: nextOwner.userId,
          reason,
        })
        .expect(201);

      expect(res.body.success).toBe(true);

      // verify organisation owner updated while creator remains unchanged
      const updatedOrg = await dataSource
        .getRepository(OrganisationEntity)
        .findOne({
          where: { id: ownerOrgId },
          relations: { owner: true, creator: true },
        });

      expect(updatedOrg?.owner?.id).toBe(nextOwner.userId);
      expect(updatedOrg?.creator?.id).toBe(ownerUserId);

      // verify previous owner demoted to ORG_MEMBER and assigned ORG_MEMBER default permissions
      const prevOwnerMembership = await dataSource
        .getRepository(OrganisationMembershipEntity)
        .findOne({
          where: {
            user: { id: ownerUserId },
            organisation: { id: ownerOrgId },
          },
          relations: { role: true, permissions: { permission: true } },
        });

      const orgMemberRole = await dataSource.getRepository(RoleEntity).findOne({
        where: { name: RoleEnum.ORG_MEMBER },
        relations: { permissions: true },
      });

      expect(prevOwnerMembership?.role?.name).toBe(RoleEnum.ORG_MEMBER);
      const actualPermNames = (prevOwnerMembership?.permissions ?? [])
        .map((mp) => mp.permission?.name)
        .filter(Boolean)
        .sort();
      const expectedPermNames = (orgMemberRole?.permissions ?? [])
        .map((p) => p.name)
        .sort();
      expect(actualPermNames).toEqual(expectedPermNames);

      // verify new owner promoted to ORG_ADMIN
      const newOwnerMembership = await dataSource
        .getRepository(OrganisationMembershipEntity)
        .findOne({
          where: {
            user: { id: nextOwner.userId },
            organisation: { id: ownerOrgId },
          },
          relations: { role: true },
        });
      expect(newOwnerMembership?.role?.name).toBe(RoleEnum.ORG_ADMIN);

      // verify ownership transfer history created
      const histories = await dataSource
        .getRepository(OrganisationOwnershipHistoryEntity)
        .find({
          where: { organisation: { id: ownerOrgId } },
          relations: { previousOwner: true, newOwner: true },
          order: { transferredAt: 'DESC' },
        });

      expect(histories.length).toBeGreaterThanOrEqual(1);
      expect(histories[0].previousOwner?.id).toBe(ownerUserId);
      expect(histories[0].newOwner?.id).toBe(nextOwner.userId);
      expect(histories[0].reason).toBe(reason);

      // verify audit log recorded
      const audits = await dataSource
        .getRepository(OrganisationAuditEntity)
        .find({
          where: {
            organisation: { id: ownerOrgId },
            eventType: OrganisationAuditEventEnum.OWNERSHIP_TRANSFERRED,
          },
          order: { createdAt: 'DESC' },
        });

      expect(audits.length).toBeGreaterThanOrEqual(1);
      expect(audits[0].metadata).toMatchObject({
        previousOwnerId: ownerUserId,
        newOwnerId: nextOwner.userId,
        demotedRole: RoleEnum.ORG_MEMBER,
        reason,
      });
    });
  });
});
