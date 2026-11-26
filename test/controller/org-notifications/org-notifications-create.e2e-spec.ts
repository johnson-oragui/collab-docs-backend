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
import { PermissionEntity } from '@/permissions/permissions.entity';
import { RoleEntity } from '@/roles/roles.entity';
import { NotificationRecipientEntity } from '@/notification-recipients/notification-recipients.entity';
import { NotificationOutboxEntity } from '@/notification-outbox/notification-outbox.entity';
import { UserSessionTokenEntity } from '@/user-session-token/user-session-token.entity';
import { EmailVerificationService } from '@/email-verification/email-verification.service';
import {
  NotificationOutboxStatusEnum,
  NotificationStatusEnum,
  NotificationTypeEnum,
  OrganisationMembershipStatusEnum,
  RoleEnum,
  TOrganisationMembershipStatusEnum,
  TRoleEnum,
} from '@/database/database.enums';
import { PasswordService } from '@/password/password.service';
import { PermissionEnum } from '@/permissions/permission.registry';
import { NotificationEntity } from '@/notification/notification.entity';
import { UserSessionEntity } from '@/user_sessions/user-session.entity';
import { uuidv7 } from 'uuidv7';

describe('Organisation Notification Creation (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof createHttpClient>;
  let dataSource: DataSource;
  let emailVerificationService: EmailVerificationService;
  let passwordService: PasswordService;

  let ownerAccessToken: string;
  let ownerUserId: string;
  let ownerMembershipId: string;
  let ownerOrgId: string;
  let password: string;
  let getTokenSpy: jest.SpyInstance;

  let secondOrgId: string;
  let secondOrgMemberMembershipId: string;

  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdNotificationIds: string[] = [];

  const notificationsUrl = 'organisation-notifications';

  const createRegistrationPayload = (prefix = 'notif-e2e') => {
    const uniqueId = randomUUID().replace(/-/g, '');
    return {
      email: `${prefix}-${uniqueId}@example.com`,
      password: 'StrongPassword123#',
      confirmPassword: 'StrongPassword123#',
      acceptTerms: true,
      firstname: 'Ada',
      lastname: 'Johnson',
      organisationName: `Notifications E2E Org ${uniqueId}`,
      organisationDescription: 'Notification creation E2E test org.',
      organisationEmail: `notif-org-${uniqueId}@example.com`,
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

    const membership = await dataSource
      .getRepository(OrganisationMembershipEntity)
      .findOne({
        where: {
          user: { id: userId },
          organisation: { id: orgId },
        },
      });

    return {
      userId,
      orgId,
      membershipId: membership!.id,
      password: payload.password,
      accessToken: loginRes.body.data.accessToken as string,
    };
  };

  const grantPermissionToMembership = async (
    membershipId: string,
    permissionName: string,
  ) => {
    const permRepo = dataSource.getRepository(PermissionEntity);
    const mpRepo = dataSource.getRepository(MembershipPermissionEntity);

    const permission = await permRepo.findOne({
      where: { name: permissionName },
    });
    if (!permission) {
      throw new Error(`Permission ${permissionName} not seeded in test DB`);
    }

    const existing = await mpRepo.findOne({
      where: {
        membership: { id: membershipId },
        permission: { id: permission.id },
      },
    });
    if (!existing) {
      await mpRepo.save(
        mpRepo.create({
          membership: { id: membershipId } as OrganisationMembershipEntity,
          permission,
        }),
      );
    }
  };

  const createMemberInOrg = async (
    orgId: string,
    roleName: TRoleEnum,
    status: TOrganisationMembershipStatusEnum = OrganisationMembershipStatusEnum.ACTIVE,
  ) => {
    const userRepo = dataSource.getRepository(UserEntity);
    const membershipRepo = dataSource.getRepository(
      OrganisationMembershipEntity,
    );
    const roleRepo = dataSource.getRepository(RoleEntity);

    const role = await roleRepo.findOne({ where: { name: roleName } });
    if (!role) {
      throw new Error(`Role ${roleName} not seeded in test DB`);
    }

    const email = `notif-member-${randomUUID().slice(0, 8)}@example.com`;
    const user = await userRepo.save(
      userRepo.create({
        email,
        firstName: 'Alan',
        lastName: 'Johnson',
        password: await passwordService.hash(password),
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

    return { userId: user.id, membershipId: membership.id };
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

    const ownerPayload = createRegistrationPayload('notif-owner');
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

    const ownerMembership = await dataSource
      .getRepository(OrganisationMembershipEntity)
      .findOne({
        where: {
          user: { id: ownerUserId },
          organisation: { id: ownerOrgId },
        },
      });
    ownerMembershipId = ownerMembership!.id;

    await grantPermissionToMembership(
      ownerMembershipId,
      PermissionEnum.NOTIFICATION.CREATE,
    );
    await grantPermissionToMembership(
      ownerMembershipId,
      PermissionEnum.NOTIFICATION.PUBLISH,
    );

    const secondOrg = await registerVerifyAndLogin('notif-other-org');
    secondOrgId = secondOrg.orgId;
    secondOrgMemberMembershipId = secondOrg.membershipId;
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      if (createdNotificationIds.length > 0) {
        await dataSource
          .getRepository(NotificationOutboxEntity)
          .createQueryBuilder()
          .delete()
          .where('"notification_id" IN (:...ids)', {
            ids: createdNotificationIds,
          })
          .execute();

        await dataSource
          .getRepository(NotificationRecipientEntity)
          .createQueryBuilder()
          .delete()
          .where('"notification_id" IN (:...ids)', {
            ids: createdNotificationIds,
          })
          .execute();

        await dataSource
          .getRepository(NotificationEntity)
          .delete(createdNotificationIds);
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

  it('should return 401 when unauthenticated', async () => {
    const res = await http.post(notificationsUrl).send({
      title: 'Unauth notice',
      message: 'Should fail',
      status: 'DRAFT',
    });

    expect(res.statusCode).toBe(401);
  });

  describe('DRAFT creation', () => {
    it('should create a DRAFT with draftExpiresAt set, publishedAt null, and no recipient/outbox rows', async () => {
      const beforeCreate = Date.now();

      const res = await http
        .post(notificationsUrl)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          title: '  Upcoming release notes  ',
          message: 'Drafting release details for review.',
          type: NotificationTypeEnum.ANNOUNCEMENT,
          status: 'DRAFT',
          recipientMembershipIds: [ownerMembershipId],
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      const createdId: string = res.body.data.id;
      createdNotificationIds.push(createdId);

      expect(res.body.data.status).toBe(NotificationStatusEnum.DRAFT);
      expect(res.body.data.organisationId).toBe(ownerOrgId);
      expect(res.body.data.createdByMembershipId).toBe(ownerMembershipId);
      expect(res.body.data.publishedAt).toBeNull();
      expect(res.body.data.draftExpiresAt).toBeTruthy();

      const expiresAtMs = new Date(res.body.data.draftExpiresAt).getTime();
      const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
      expect(expiresAtMs).toBeGreaterThanOrEqual(
        beforeCreate + twoDaysMs - 5000,
      );
      expect(expiresAtMs).toBeLessThanOrEqual(Date.now() + twoDaysMs + 5000);

      const recipientCount = await dataSource
        .getRepository(NotificationRecipientEntity)
        .count({ where: { notificationId: createdId } });
      const outboxCount = await dataSource
        .getRepository(NotificationOutboxEntity)
        .count({ where: { notificationId: createdId } });

      expect(recipientCount).toBe(1);
      expect(outboxCount).toBe(0);
    });
  });

  describe('PUBLISHED creation & transactional outbox', () => {
    it('should publish a notification, deduplicate recipients, and atomically create recipient and outbox rows', async () => {
      const memberA = await createMemberInOrg(ownerOrgId, RoleEnum.ORG_MEMBER);
      const memberB = await createMemberInOrg(ownerOrgId, RoleEnum.ORG_MEMBER);

      const res = await http
        .post(notificationsUrl)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          title: 'Security patch deployed',
          message: 'All services are running the latest security build.',
          type: NotificationTypeEnum.ALERT,
          status: 'PUBLISHED',
          recipientMembershipIds: [
            memberA.membershipId,
            memberB.membershipId,
            memberA.membershipId, // duplicate should be deduplicated
          ],
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      const notificationId: string = res.body.data.id;
      createdNotificationIds.push(notificationId);

      expect(res.body.data.status).toBe(NotificationStatusEnum.PUBLISHED);
      expect(res.body.data.publishedAt).toBeTruthy();
      expect(res.body.data.draftExpiresAt).toBeNull();

      const recipients = await dataSource
        .getRepository(NotificationRecipientEntity)
        .find({ where: { notificationId } });
      const outboxRows = await dataSource
        .getRepository(NotificationOutboxEntity)
        .find({ where: { notificationId } });

      expect(recipients).toHaveLength(2);
      expect(new Set(recipients.map((r) => r.membershipId))).toEqual(
        new Set([memberA.membershipId, memberB.membershipId]),
      );
      expect(recipients.every((r) => r.readAt === null)).toBe(true);

      expect(outboxRows).toHaveLength(2);
      expect(new Set(outboxRows.map((o) => o.recipientMembershipId))).toEqual(
        new Set([memberA.membershipId, memberB.membershipId]),
      );
      expect(
        outboxRows.every(
          (o) =>
            o.status === NotificationOutboxStatusEnum.PENDING &&
            o.attempts === 0 &&
            o.dispatchedAt === null,
        ),
      ).toBe(true);
    });

    it('should reject PUBLISHED notification when recipientMembershipIds is missing or empty', async () => {
      const countBefore = await dataSource
        .getRepository(NotificationEntity)
        .count({ where: { organisationId: ownerOrgId } });

      const res = await http
        .post(notificationsUrl)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          title: 'Missing recipients',
          message: 'Should fail validation',
          status: 'PUBLISHED',
          recipientMembershipIds: [],
        });

      expect(res.statusCode).toBe(400);

      const countAfter = await dataSource
        .getRepository(NotificationEntity)
        .count({ where: { organisationId: ownerOrgId } });
      expect(countAfter).toBe(countBefore);
    });
  });

  describe('Recipient validation & rollback atomicity', () => {
    it('should reject cross-organisation recipient memberships without partial writes', async () => {
      const validMember = await createMemberInOrg(
        ownerOrgId,
        RoleEnum.ORG_MEMBER,
      );

      const notificationsBefore = await dataSource
        .getRepository(NotificationEntity)
        .count({ where: { organisationId: ownerOrgId } });
      const outboxBefore = await dataSource
        .getRepository(NotificationOutboxEntity)
        .count();

      const res = await http
        .post(notificationsUrl)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          title: 'Cross-org leak test',
          message: 'Should fail because recipient belongs to another org',
          status: 'PUBLISHED',
          recipientMembershipIds: [
            validMember.membershipId,
            secondOrgMemberMembershipId,
          ],
        });

      expect(res.statusCode).toBe(400);
      expect(JSON.stringify(res.body)).toContain(secondOrgMemberMembershipId);

      const notificationsAfter = await dataSource
        .getRepository(NotificationEntity)
        .count({ where: { organisationId: ownerOrgId } });
      const outboxAfter = await dataSource
        .getRepository(NotificationOutboxEntity)
        .count();

      expect(notificationsAfter).toBe(notificationsBefore);
      expect(outboxAfter).toBe(outboxBefore);
    });

    it('should reject non-existent and inactive recipient memberships', async () => {
      const suspendedMember = await createMemberInOrg(
        ownerOrgId,
        RoleEnum.ORG_MEMBER,
        OrganisationMembershipStatusEnum.SUSPENDED,
      );

      const res = await http
        .post(notificationsUrl)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          title: 'Invalid/inactive recipient test',
          message: 'Should reject invalid and suspended memberships',
          status: 'PUBLISHED',
          recipientMembershipIds: [suspendedMember.membershipId, uuidv7()],
        });

      expect(res.statusCode).toBe(400);
    });
  });
});
