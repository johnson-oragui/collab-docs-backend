import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { randomBytes, randomUUID } from 'node:crypto';

import { createE2eApp } from '@/test/fixtures/create-e2e-app';
import { createHttpClient } from '@/test/fixtures/helpers/http-request';

import { UserEntity } from '@/user/user.entity';
import { ProfileEntity } from '@/profile/profile.entity';
import { OrganisationEntity } from '@/organisations/organisations.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { OrganisationMembershipSuspensionHistoryEntity } from '@/org_membership_suspension_histories/org_membership_suspension_histories.entity';
import { MembershipPermissionEntity } from '@/membership_permissions/membership_permissions.entity';
import { RoleEntity } from '@/roles/roles.entity';
import { OrganisationAuditEntity } from '@/organisation_audit/organisation_audit.entity';
import { OrganisationOwnershipHistoryEntity } from '@/organisation-ownership-history/organisation-ownership-history.entity';
import { UserSessionEntity } from '@/user_sessions/user-session.entity';
import { UserSessionTokenEntity } from '@/user-session-token/user-session-token.entity';
import { EmailVerificationService } from '@/email-verification/email-verification.service';
import {
  OrganisationMembershipStatusEnum,
  RoleEnum,
  TRoleEnum,
} from '@/database/database.enums';
import { OrganisationAuditEventEnum } from '@/commons/enums';
import { PasswordService } from '@/password/password.service';
import { generateRandomIPv4 } from '@/commons/util/generateRandomIPv4';
import { uuidv7 } from 'uuidv7';

describe('Membership-Suspension (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof createHttpClient>;
  let dataSource: DataSource;
  let emailVerificationService: EmailVerificationService;
  let passwordService: PasswordService;
  let membershipRepo: Repository<OrganisationMembershipEntity>;
  let historyRepo: Repository<OrganisationMembershipSuspensionHistoryEntity>;
  let auditRepo: Repository<OrganisationAuditEntity>;

  let ownerPayload: ReturnType<typeof createRegistrationPayload>;
  let ownerUserId: string;
  let ownerOrgId: string;
  let ownerMembershipId: string;
  let ownerAccessToken: string;
  let getTokenSpy: jest.SpyInstance;

  let memberUserId: string;
  let memberMembershipId: string;
  let memberAccessToken: string;

  let secondOrgId: string;
  let secondOrgAccessToken: string;

  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];

  const createRegistrationPayload = (prefix = 'susp-admin') => {
    const uniqueId = randomUUID().replace(/-/g, '');
    return {
      email: `${prefix}-${uniqueId}@example.com`,
      password: 'StrongPassword123#',
      confirmPassword: 'StrongPassword123#',
      acceptTerms: true,
      firstname: 'Ada',
      lastname: 'Lovelace',
      organisationName: `Suspension Org ${uniqueId}`,
      organisationDescription: 'Membership suspension E2E test org.',
      organisationEmail: `susp-org-${uniqueId}@example.com`,
    };
  };

  const registerVerifyAndLogin = async (prefix: string) => {
    const payload = createRegistrationPayload(prefix);
    const token = randomBytes(32).toString('base64url');
    getTokenSpy.mockReturnValueOnce(token);

    const regRes = await http
      .post('/api/v1/auth/register')
      .send(payload)
      .set('X-Forwared-For', generateRandomIPv4())
      .expect(201);

    const userId: string = regRes.body.data.user.id;
    const orgId: string = regRes.body.data.organisation.id;
    createdUserIds.push(userId);
    createdOrgIds.push(orgId);

    await http
      .post('/api/v1/auth/verify-email')
      .set('X-Forwared-For', generateRandomIPv4())
      .send({ token })
      .expect(201);

    const loginRes = await http
      .post('/api/v1/auth/login')
      .set('X-Forwared-For', generateRandomIPv4())
      .send({ email: payload.email, password: payload.password })
      .expect(200);

    return {
      userId,
      orgId,
      email: payload.email,
      password: payload.password,
      accessToken: loginRes.body.data.accessToken as string,
    };
  };

  const createMemberAccount = async (
    orgId: string,
    roleName: TRoleEnum,
    sharedPassword: string,
  ) => {
    const userRepo = dataSource.getRepository(UserEntity);
    const roleRepo = dataSource.getRepository(RoleEntity);
    const membershipPermission = dataSource.getRepository(
      MembershipPermissionEntity,
    );

    const role = await roleRepo.findOne({
      where: { name: roleName },
      relations: { permissions: true },
    });
    if (!role) {
      throw new Error(`Role ${roleName} not seeded in test database`);
    }

    const email = `susp-${roleName.toLowerCase()}-${randomUUID().slice(0, 8)}@example.com`;
    const user = await userRepo.save(
      userRepo.create({
        email,
        firstName: 'Test',
        lastName: 'User',
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
        status: OrganisationMembershipStatusEnum.ACTIVE,
      }),
    );
    expect(membership.status).toBe('ACTIVE');
    const membershipPermissions = role.permissions.map((permission) => {
      return membershipPermission.create({
        membership,
        permission,
      });
    });
    await membershipPermission.save(membershipPermissions);

    const loginRes = await http
      .post('/api/v1/auth/login')
      .set('X-Forwared-For', generateRandomIPv4())
      .send({ email, password: 'StrongPassword123#' })
      .expect(200);

    return {
      userId: user.id,
      membershipId: membership.id,
      accessToken: loginRes.body.data.accessToken as string,
      orgId: membership.organisation.id ?? orgId,
    };
  };

  beforeAll(async () => {
    app = await createE2eApp();
    http = createHttpClient(app);
    dataSource = app.get(DataSource);
    emailVerificationService = app.get(EmailVerificationService);
    passwordService = app.get(PasswordService);
    membershipRepo = dataSource.getRepository(OrganisationMembershipEntity);
    historyRepo = dataSource.getRepository(
      OrganisationMembershipSuspensionHistoryEntity,
    );
    auditRepo = dataSource.getRepository(OrganisationAuditEntity);

    ownerPayload = createRegistrationPayload('susp-owner');
    const initialToken = randomBytes(32).toString('base64url');
    getTokenSpy = jest
      .spyOn(emailVerificationService as any, 'getToken')
      .mockReturnValue(initialToken);

    const regRes = await http
      .post('/api/v1/auth/register')
      .set('X-Forwared-For', generateRandomIPv4())
      .send(ownerPayload)
      .expect(201);

    ownerUserId = regRes.body.data.user.id;
    ownerOrgId = regRes.body.data.organisation.id;
    createdUserIds.push(ownerUserId);
    createdOrgIds.push(ownerOrgId);

    const ownerMembership = await dataSource
      .getRepository(OrganisationMembershipEntity)
      .findOne({
        where: {
          user: { id: ownerUserId },
          organisation: { id: ownerOrgId },
        },
      });
    ownerMembershipId = ownerMembership!.id;

    await http
      .post('/api/v1/auth/verify-email')
      .set('X-Forwared-For', generateRandomIPv4())
      .send({ token: initialToken })
      .expect(201);

    const loginRes = await http
      .post('/api/v1/auth/login')
      .set('X-Forwared-For', generateRandomIPv4())
      .send({ email: ownerPayload.email, password: ownerPayload.password })
      .expect(200);

    ownerAccessToken = loginRes.body.data.accessToken;

    const memberAccount = await createMemberAccount(
      ownerOrgId,
      RoleEnum.ORG_MEMBER,
      ownerPayload.password,
    );
    memberUserId = memberAccount.userId;
    memberMembershipId = memberAccount.membershipId;
    memberAccessToken = memberAccount.accessToken;

    const secondOrganisation = await registerVerifyAndLogin('susp-other-org');
    secondOrgId = secondOrganisation.orgId;
    secondOrgAccessToken = secondOrganisation.accessToken;
    void memberUserId;
    void secondOrgId;
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
            .getRepository(OrganisationMembershipSuspensionHistoryEntity)
            .createQueryBuilder()
            .delete()
            .where('"organisation_membership_id" IN (:...membershipIds)', {
              membershipIds,
            })
            .execute();

          await dataSource
            .getRepository(MembershipPermissionEntity)
            .createQueryBuilder()
            .delete()
            .where('"membership_id" IN (:...membershipIds)', { membershipIds })
            .execute();
        }

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
          .getRepository(OrganisationAuditEntity)
          .createQueryBuilder()
          .delete()
          .where('"organisation_id" IN (:...createdOrgIds)', { createdOrgIds })
          .execute();

        await dataSource
          .getRepository(OrganisationOwnershipHistoryEntity)
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
        await dataSource
          .getRepository(OrganisationMembershipEntity)
          .delete(createdUserIds.map((userId) => ({ user: { id: userId } })));

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

  describe('Authentication & Guards', () => {
    it('should return 401 when suspending without an authorization token', async () => {
      const res = await http
        .patch(`/api/v1/organisation-memberships/${memberMembershipId}/suspend`)
        .set('X-Forwared-For', generateRandomIPv4())
        .send({
          suspendedTill: new Date(
            Date.now() + 24 * 60 * 60 * 1000,
          ).toISOString(),
          reason: 'Unauthorized test',
        });

      expect(res.statusCode).toBe(401);
    });

    it('should return 401 when unsuspending without an authorization token', async () => {
      const res = await http
        .patch(
          `/api/v1/organisation-memberships/${memberMembershipId}/unsuspend`,
        )
        .set('X-Forwared-For', generateRandomIPv4())
        .send({ reason: 'Unauthorized test' });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('Suspend & Unsuspend Lifecycle + History + Audit Logs', () => {
    it('should suspend an active member, record suspension history with actor & action, log audit event, and then unsuspend cleanly', async () => {
      const suspendedTill = new Date(
        Date.now() + 3 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const suspendReason = 'Policy violation during E2E test';

      const suspendRes = await http
        .patch(`/api/v1/organisation-memberships/${memberMembershipId}/suspend`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .set('X-Forwared-For', generateRandomIPv4())
        .send({
          suspendedTill,
          reason: suspendReason,
        })
        .expect(201);

      expect(suspendRes.body.success).toBe(true);

      const suspendedMembership = await membershipRepo.findOne({
        where: { id: memberMembershipId },
      });
      expect(suspendedMembership!.status).toBe(
        OrganisationMembershipStatusEnum.SUSPENDED,
      );
      expect(suspendedMembership!.suspendedTill).toBeTruthy();

      const suspendHistories = await historyRepo.find({
        where: { membership: { id: memberMembershipId } },
        relations: { actor: true },
        order: { createdAt: 'DESC' },
      });
      expect(suspendHistories.length).toBeGreaterThanOrEqual(1);
      expect(suspendHistories[0].actor?.id).toBe(ownerUserId);
      expect(suspendHistories[0].action).toBeTruthy();
      expect(suspendHistories[0].reason).toContain(suspendReason);

      const suspendAudits = await auditRepo.find({
        where: {
          organisation: { id: ownerOrgId },
          eventType: OrganisationAuditEventEnum.MEMBER_SUSPENDED,
        },
        order: { createdAt: 'DESC' },
      });
      expect(suspendAudits.length).toBeGreaterThanOrEqual(1);
      expect(suspendAudits[0].metadata).toMatchObject({
        membershipId: memberMembershipId,
        reason: suspendReason,
      });

      // ======= unsuspend the member ==========
      const unsuspendReason = 'Resolved after review';
      const unsuspendRes = await http
        .patch(
          `/api/v1/organisation-memberships/${memberMembershipId}/unsuspend`,
        )
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .set('X-Forwared-For', generateRandomIPv4())
        .send({ reason: unsuspendReason })
        .expect(201);

      expect(unsuspendRes.body.success).toBe(true);

      const activeMembership = await membershipRepo.findOne({
        where: { id: memberMembershipId },
      });
      expect(activeMembership!.status).toBe(
        OrganisationMembershipStatusEnum.ACTIVE,
      );
      expect(activeMembership!.suspendedTill).toBeNull();

      const historiesAfterUnsuspend = await historyRepo.find({
        where: { membership: { id: memberMembershipId } },
        relations: { actor: true },
        order: { createdAt: 'DESC' },
      });
      expect(historiesAfterUnsuspend.length).toBeGreaterThanOrEqual(2);
      expect(historiesAfterUnsuspend[0].actor?.id).toBe(ownerUserId);
      expect(historiesAfterUnsuspend[0].action).toBeTruthy();
      expect(historiesAfterUnsuspend[0].action).not.toBe(
        suspendHistories[0].action,
      );

      const unsuspendAudits = await auditRepo.find({
        where: {
          organisation: { id: ownerOrgId },
          eventType: OrganisationAuditEventEnum.MEMBER_UNSUSPENDED,
        },
        order: { createdAt: 'DESC' },
      });
      expect(unsuspendAudits.length).toBeGreaterThanOrEqual(1);
      expect(unsuspendAudits[0].metadata).toMatchObject({
        membershipId: memberMembershipId,
      });
    });

    it('should return 409 when suspending an already SUSPENDED member', async () => {
      await membershipRepo.update(memberMembershipId, {
        status: OrganisationMembershipStatusEnum.SUSPENDED,
        suspendedTill: new Date(Date.now() + 48 * 60 * 60 * 1000),
      });

      const res = await http
        .patch(`/api/v1/organisation-memberships/${memberMembershipId}/suspend`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .set('X-Forwared-For', generateRandomIPv4())
        .send({
          suspendedTill: new Date(
            Date.now() + 72 * 60 * 60 * 1000,
          ).toISOString(),
          reason: 'Duplicate suspend',
        });

      await membershipRepo.update(memberMembershipId, {
        status: OrganisationMembershipStatusEnum.ACTIVE,
        suspendedTill: null,
      });

      expect(res.statusCode).toBe(409);
    });

    it('should return 400 when unsuspending a member that is not SUSPENDED', async () => {
      const res = await http
        .patch(
          `/api/v1/organisation-memberships/${memberMembershipId}/unsuspend`,
        )
        .set('X-Forwared-For', generateRandomIPv4())
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ reason: 'Not suspended' });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('Role Boundary & Ownership Checks', () => {
    it('should prevent an admin from suspending their own membership', async () => {
      const res = await http
        .patch(`/api/v1/organisation-memberships/${ownerMembershipId}/suspend`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .set('X-Forwared-For', generateRandomIPv4())
        .send({
          suspendedTill: new Date(
            Date.now() + 24 * 60 * 60 * 1000,
          ).toISOString(),
          reason: 'Self suspend check',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe('You cannot suspend your own membership');
    });

    it('should prevent suspending the last active Organisation Admin', async () => {
      const secondAdmin = await createMemberAccount(
        ownerOrgId,
        RoleEnum.ORG_ADMIN,
        ownerPayload.password,
      );

      // Creating a second ORG_ADMIN allows suspending one while another active ORG_ADMIN remains
      await http
        .patch(
          `/api/v1/organisation-memberships/${secondAdmin.membershipId}/suspend`,
        )
        .set('X-Forwared-For', generateRandomIPv4())
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          suspendedTill: new Date(
            Date.now() + 24 * 60 * 60 * 1000,
          ).toISOString(),
          reason: 'Temporary admin suspension while another admin is active',
        })
        .expect(201);

      // only one active ORG_ADMIN remains; suspending them should fail with 400
      const lastAdminRes = await http
        .patch(`/api/v1/organisation-memberships/${ownerMembershipId}/suspend`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          suspendedTill: new Date(
            Date.now() + 24 * 60 * 60 * 1000,
          ).toISOString(),
          reason: 'Attempting to suspend last active admin',
        });

      expect(lastAdminRes.statusCode).toBe(400);

      await membershipRepo.update(secondAdmin.membershipId, {
        status: OrganisationMembershipStatusEnum.ACTIVE,
        suspendedTill: null,
      });
    });

    it('should reject non-admin callers from suspending or unsuspending members', async () => {
      const suspendRes = await http
        .patch(`/api/v1/organisation-memberships/${ownerMembershipId}/suspend`)
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .set('X-Forwared-For', generateRandomIPv4())
        .send({
          suspendedTill: new Date(
            Date.now() + 24 * 60 * 60 * 1000,
          ).toISOString(),
        });

      expect([403]).toContain(suspendRes.statusCode);
      expect(suspendRes.body.message).toBe(
        'You do not have permission to perform this action',
      );
    });

    it('should reject cross-organisation membership suspension attempts', async () => {
      const res = await http
        .patch(`/api/v1/organisation-memberships/${memberMembershipId}/suspend`)
        .set('Authorization', `Bearer ${secondOrgAccessToken}`)
        .set('X-Forwared-For', generateRandomIPv4())
        .send({
          suspendedTill: new Date(
            Date.now() + 24 * 60 * 60 * 1000,
          ).toISOString(),
        });

      expect([404]).toContain(res.statusCode);
      expect(res.body.message).toBe('Organisation membership not found');
    });

    it('should return 404 for a non-existent membershipId', async () => {
      const res = await http
        .patch(`/api/v1/organisation-memberships/${uuidv7()}/suspend`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .set('X-Forwared-For', generateRandomIPv4())
        .send({
          suspendedTill: new Date(
            Date.now() + 24 * 60 * 60 * 1000,
          ).toISOString(),
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe('Organisation membership not found');
    });
  });
});
