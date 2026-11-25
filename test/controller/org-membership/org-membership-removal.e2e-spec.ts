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
import { OrganisationAuditEntity } from '@/organisation_audit/organisation_audit.entity';
import { OrganisationOwnershipHistoryEntity } from '@/organisation-ownership-history/organisation-ownership-history.entity';
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
import { OrganisationMembershipSuspensionHistoryEntity } from '@/org_membership_suspension_histories/org_membership_suspension_histories.entity';
import { EmailOutboxService } from '@/email-outbox/email-outbox.service';
import { uuidv7 } from 'uuidv7';

describe('Organisation Membership Removal (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof createHttpClient>;
  let dataSource: DataSource;
  let emailVerificationService: EmailVerificationService;
  let passwordService: PasswordService;
  let emailOutboxService: EmailOutboxService;

  let ownerAccessToken: string;
  let ownerUserId: string;
  let ownerOrgId: string;
  let password: string;
  let getTokenSpy: jest.SpyInstance;

  let secondOrgAccessToken: string;

  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdHistoryIds: string[] = [];

  const removeUrl = (membershipId: string) =>
    `organisation-memberships/${membershipId}/remove`;

  const createRegistrationPayload = (prefix = 'remove-member') => {
    const uniqueId = randomUUID().replace(/-/g, '');
    return {
      email: `${prefix}-${uniqueId}@example.com`,
      password: 'StrongPassword123#',
      confirmPassword: 'StrongPassword123#',
      acceptTerms: true,
      firstname: 'Ada',
      lastname: 'Lovelace',
      organisationName: `Remove Org ${uniqueId}`,
      organisationDescription: 'Membership removal E2E test org.',
      organisationEmail: `remove-org-${uniqueId}@example.com`,
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
    sharedPasswordHash: string,
    status: TOrganisationMembershipStatusEnum = OrganisationMembershipStatusEnum.ACTIVE,
  ) => {
    const userRepo = dataSource.getRepository(UserEntity);
    const membershipRepo = dataSource.getRepository(
      OrganisationMembershipEntity,
    );
    const roleRepo = dataSource.getRepository(RoleEntity);

    const role = await roleRepo.findOne({
      where: { name: roleName },
      relations: { permissions: true },
    });
    if (!role) {
      throw new Error(`Role ${roleName} not seeded in test database`);
    }

    const email = `member-remove-${randomUUID().slice(0, 8)}@example.com`;
    const user = await userRepo.save(
      userRepo.create({
        email,
        firstName: 'Grace',
        lastName: 'Hopper',
        password: await passwordService.hash(sharedPasswordHash),
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

    const membershipPermissionRepo = dataSource.getRepository(
      MembershipPermissionEntity,
    );
    await membershipPermissionRepo.save(
      membershipPermissionRepo.create({
        membership,
        permission: role.permissions[0],
      }),
    );

    return { userId: user.id, membershipId: membership.id };
  };

  const seedSuspensionHistory = async (
    membershipId: string,
    actorUserId: string,
    reason = 'Policy violation before removal',
  ) => {
    const historyRepo = dataSource.getRepository(
      OrganisationMembershipSuspensionHistoryEntity,
    );
    const entry = await historyRepo.save(
      historyRepo.create({
        membership: { id: membershipId } as OrganisationMembershipEntity,
        actor: { id: actorUserId } as UserEntity,
        action: 'SUSPENDED',
        reason,
        suspendedAt: new Date(),
        suspendedTill: null,
      }),
    );
    createdHistoryIds.push(entry.id);
    return entry;
  };

  beforeAll(async () => {
    app = await createE2eApp();
    http = createHttpClient(app);
    dataSource = app.get(DataSource);
    emailVerificationService = app.get(EmailVerificationService);
    passwordService = app.get(PasswordService);
    emailOutboxService = app.get(EmailOutboxService);

    const initialToken = randomBytes(32).toString('base64url');
    getTokenSpy = jest
      .spyOn(emailVerificationService as any, 'getToken')
      .mockReturnValue(initialToken);

    const ownerPayload = createRegistrationPayload('remove-owner');
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

    const secondOrg = await registerVerifyAndLogin('remove-other-org');
    secondOrgAccessToken = secondOrg.accessToken;
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      if (createdHistoryIds.length > 0) {
        await dataSource
          .getRepository(OrganisationMembershipSuspensionHistoryEntity)
          .delete(createdHistoryIds);
      }

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

  describe('Guards, Self-Removal & Edge Cases', () => {
    it('should return 401 when unauthenticated', async () => {
      const target = await createMemberInOrg(
        ownerOrgId,
        RoleEnum.ORG_MEMBER,
        password,
      );

      const res = await http
        .patch(removeUrl(target.membershipId))
        .send({ reason: 'Unauthorized removal attempt' });

      expect(res.statusCode).toBe(401);
    });

    it('should not persist permission deletion if transaction fails before commit', async () => {
      const permissionRepo = dataSource.getRepository(
        MembershipPermissionEntity,
      );

      const target = await createMemberInOrg(
        ownerOrgId,
        RoleEnum.ORG_MEMBER,
        password,
      );

      const initialPermissions = await permissionRepo.find({
        where: { membership: { id: target.membershipId } },
      });
      expect(initialPermissions.length).toBeGreaterThan(0);

      const outboxSpy = jest
        .spyOn(emailOutboxService, 'create')
        .mockRejectedValueOnce(new Error('Outbox write failed'));

      const res = await http
        .patch(`/api/v1/organisation-memberships/${target.membershipId}/remove`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ reason: 'Rollback check' });

      expect(outboxSpy).toHaveBeenCalled();

      outboxSpy.mockRestore();

      expect(res.statusCode).toBeGreaterThanOrEqual(400);

      const permissionsAfterFailure = await permissionRepo.find({
        where: { membership: { id: target.membershipId } },
      });
      expect(permissionsAfterFailure).toHaveLength(initialPermissions.length);
    });

    it('should return 404 when membership does not exist in the organisation', async () => {
      const res = await http
        .patch(removeUrl(uuidv7()))
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ reason: 'Missing membership' });

      expect(res.statusCode).toBe(404);
    });

    it('should reject removing membership belonging to another organisation', async () => {
      const target = await createMemberInOrg(
        ownerOrgId,
        RoleEnum.ORG_MEMBER,
        password,
      );

      const res = await http
        .patch(removeUrl(target.membershipId))
        .set('Authorization', `Bearer ${secondOrgAccessToken}`)
        .send({ reason: 'Cross-org removal attempt' });

      expect(res.statusCode).toBe(404);
    });

    it('should return 400 when attempting to remove own membership', async () => {
      const ownerMembership = await dataSource
        .getRepository(OrganisationMembershipEntity)
        .findOne({
          where: {
            user: { id: ownerUserId },
            organisation: { id: ownerOrgId },
          },
        });

      const res = await http
        .patch(removeUrl(ownerMembership!.id))
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ reason: 'Self removal' });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe('You cannot remove your own membership');
    });
  });

  describe('Membership Removal and Suspension History Preservation', () => {
    it('should remove a member and keep suspension history intact', async () => {
      const target = await createMemberInOrg(
        ownerOrgId,
        RoleEnum.ORG_MEMBER,
        password,
        OrganisationMembershipStatusEnum.SUSPENDED,
      );

      const historyEntry = await seedSuspensionHistory(
        target.membershipId,
        ownerUserId,
        'Repeated policy warnings',
      );

      const reason = 'Account terminated after review';
      const res = await http
        .patch(removeUrl(target.membershipId))
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ reason })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data?.membershipId).toBe(target.membershipId);

      // assert that Membership row is removed
      const deletedMembership = await dataSource
        .getRepository(OrganisationMembershipEntity)
        .findOne({ where: { id: target.membershipId } });
      expect(deletedMembership).toBeNull();

      // assert that Suspension history record still exists with its fields intact
      const persistedSuspensionHistory = await dataSource
        .getRepository(OrganisationMembershipSuspensionHistoryEntity)
        .findOne({ where: { id: historyEntry.id } });

      expect(persistedSuspensionHistory).not.toBeNull();
      expect(persistedSuspensionHistory?.action).toBe('SUSPENDED');
      expect(persistedSuspensionHistory?.reason).toBe(
        'Repeated policy warnings',
      );

      // assert that Audit log recorded MEMBER_REMOVAL with reason
      const audits = await dataSource
        .getRepository(OrganisationAuditEntity)
        .find({
          where: {
            organisation: { id: ownerOrgId },
            eventType: OrganisationAuditEventEnum.MEMBER_REMOVAL,
          },
          order: { createdAt: 'DESC' },
        });

      expect(audits.length).toBeGreaterThanOrEqual(1);
      expect(audits[0].metadata).toMatchObject({
        targetUserId: target.userId,
        reason,
      });
    });

    it('should preserve multiple suspension history entries after membership removal', async () => {
      const target = await createMemberInOrg(
        ownerOrgId,
        RoleEnum.ORG_MEMBER,
        password,
        OrganisationMembershipStatusEnum.ACTIVE,
      );

      const h1 = await seedSuspensionHistory(
        target.membershipId,
        ownerUserId,
        'First suspension',
      );
      const h2 = await seedSuspensionHistory(
        target.membershipId,
        ownerUserId,
        'Second suspension',
      );

      await http
        .patch(removeUrl(target.membershipId))
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ reason: 'Final removal' })
        .expect(201);

      const remainingHistory = await dataSource
        .getRepository(OrganisationMembershipSuspensionHistoryEntity)
        .find({
          where: [{ id: h1.id }, { id: h2.id }],
        });

      expect(remainingHistory).toHaveLength(2);
    });
  });
});
