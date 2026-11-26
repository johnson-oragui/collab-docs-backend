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
import { NotificationEntity } from '@/notification/notification.entity';
import { UserSessionEntity } from '@/user_sessions/user-session.entity';
import { uuidv7 } from 'uuidv7';

const SHARED_PASSWORD = 'StrongPassword123#';

describe('Organisation Notification Publishing (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof createHttpClient>;
  let dataSource: DataSource;
  let emailVerificationService: EmailVerificationService;
  let passwordService: PasswordService;
  let sharedPasswordHash: string;

  let ownerAccessToken: string;
  let ownerMembershipId: string;
  let ownerOrgId: string;
  let getTokenSpy: jest.SpyInstance;

  let secondOrgAccessToken: string;

  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdNotificationIds: string[] = [];

  const notificationsUrl = 'organisation-notifications';

  const createRegistrationPayload = (prefix = 'notif-pub') => {
    const uniqueId = randomUUID().replace(/-/g, '');
    return {
      email: `${prefix}-${uniqueId}@example.com`,
      password: SHARED_PASSWORD,
      confirmPassword: SHARED_PASSWORD,
      acceptTerms: true,
      firstname: 'Margaret',
      lastname: 'Hamilton',
      organisationName: `Publish Draft Org ${uniqueId}`,
      organisationDescription: 'Notification publish E2E test org.',
      organisationEmail: `pub-org-${uniqueId}@example.com`,
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
      .send({ email: payload.email, password: SHARED_PASSWORD })
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

    const email = `pub-member-${randomUUID().slice(0, 8)}@example.com`;
    const user = await userRepo.save(
      userRepo.create({
        email,
        firstName: 'Katherine',
        lastName: 'Johnson',
        password: sharedPasswordHash,
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
    sharedPasswordHash = await passwordService.hash(SHARED_PASSWORD);

    const initialToken = randomBytes(32).toString('base64url');
    getTokenSpy = jest
      .spyOn(emailVerificationService as any, 'getToken')
      .mockReturnValue(initialToken);

    const ownerPayload = createRegistrationPayload('notif-pub-owner');
    const regRes = await http
      .post('/api/v1/auth/register')
      .send(ownerPayload)
      .expect(201);

    const ownerUserId: string = regRes.body.data.user.id;
    ownerOrgId = regRes.body.data.organisation.id;
    createdUserIds.push(ownerUserId);
    createdOrgIds.push(ownerOrgId);

    await http
      .post('/api/v1/auth/verify-email')
      .send({ token: initialToken })
      .expect(201);

    const loginRes = await http
      .post('/api/v1/auth/login')
      .send({ email: ownerPayload.email, password: SHARED_PASSWORD })
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

    await grantPermissionToMembership(ownerMembershipId, 'notification:create');
    await grantPermissionToMembership(
      ownerMembershipId,
      'notification:publish',
    );
    await grantPermissionToMembership(ownerMembershipId, 'notification:update');

    const secondOrg = await registerVerifyAndLogin('notif-pub-other');
    secondOrgAccessToken = secondOrg.accessToken;
    await grantPermissionToMembership(
      secondOrg.membershipId,
      'notification:publish',
    );
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
    const res = await http.post(`${notificationsUrl}/${uuidv7()}/publish`);
    expect(res.statusCode).toBe(401);
  });

  it('should publish a valid DRAFT, clear draftExpiresAt, set publishedAt, and create recipient and outbox records', async () => {
    const memberA = await createMemberInOrg(ownerOrgId, RoleEnum.ORG_MEMBER);
    const memberB = await createMemberInOrg(ownerOrgId, RoleEnum.ORG_MEMBER);

    const draftRes = await http
      .post(notificationsUrl)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({
        title: 'Maintenance window confirmed',
        message: 'Database upgrade scheduled for Sunday at 01:00 UTC.',
        type: NotificationTypeEnum.ANNOUNCEMENT,
        status: 'DRAFT',
        recipientMembershipIds: [memberA.membershipId, memberB.membershipId],
      })
      .expect(201);

    const draftId: string = draftRes.body.data.id;
    createdNotificationIds.push(draftId);
    expect(draftRes.body.data.draftExpiresAt).toBeTruthy();

    const publishRes = await http
      .post(`${notificationsUrl}/${draftId}/publish`)
      .set('Authorization', `Bearer ${ownerAccessToken}`);

    expect(publishRes.statusCode).toBe(201);
    expect(publishRes.body.success).toBe(true);
    expect(publishRes.body.data.status).toBe(NotificationStatusEnum.PUBLISHED);
    expect(publishRes.body.data.publishedAt).toBeTruthy();
    expect(publishRes.body.data.draftExpiresAt).toBeNull();

    const recipients = await dataSource
      .getRepository(NotificationRecipientEntity)
      .find({ where: { notificationId: draftId } });
    const outboxRows = await dataSource
      .getRepository(NotificationOutboxEntity)
      .find({ where: { notificationId: draftId } });

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

  it('should serialize concurrent publish requests so only one succeeds and no duplicate rows are created', async () => {
    const member = await createMemberInOrg(ownerOrgId, RoleEnum.ORG_MEMBER);
    const member2 = await createMemberInOrg(ownerOrgId, RoleEnum.ORG_MEMBER);

    const draftRes = await http
      .post(notificationsUrl)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({
        title: 'Concurrent publish race draft',
        message: 'Only one simultaneous publish should succeed.',
        status: 'DRAFT',
        recipientMembershipIds: [member.membershipId, member2.membershipId],
      })
      .expect(201);
    // console.log('draftRes.body.data: ', JSON.stringify(draftRes.body.data));

    const draftId: string = draftRes.body.data.id;
    createdNotificationIds.push(draftId);

    const recipients = await dataSource
      .getRepository(NotificationRecipientEntity)
      .find({ where: { notificationId: draftId } });

    expect(recipients).toHaveLength(2);

    const [resA, resB] = await Promise.all([
      http
        .post(`${notificationsUrl}/${draftId}/publish`)
        .set('Authorization', `Bearer ${ownerAccessToken}`),
      http
        .post(`${notificationsUrl}/${draftId}/publish`)
        .set('Authorization', `Bearer ${ownerAccessToken}`),
    ]);

    const statuses = [resA.statusCode, resB.statusCode].sort();
    expect(statuses).toContain(409);
    expect(statuses.some((code) => code === 201)).toBe(true);

    const recipientCount = await dataSource
      .getRepository(NotificationRecipientEntity)
      .count({ where: { notificationId: draftId } });
    const outboxCount = await dataSource
      .getRepository(NotificationOutboxEntity)
      .count({ where: { notificationId: draftId } });

    expect(recipientCount).toBe(2);
    expect(outboxCount).toBe(2);
  });

  it('should delete an expired draft and return 410 when publishing', async () => {
    const member = await createMemberInOrg(ownerOrgId, RoleEnum.ORG_MEMBER);

    const draftRes = await http
      .post(notificationsUrl)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({
        title: 'Expired draft publish attempt',
        message: 'Should fail with 410 and be deleted.',
        status: 'DRAFT',
        recipientMembershipIds: [member.membershipId],
      })
      .expect(201);

    const draftId: string = draftRes.body.data.id;
    createdNotificationIds.push(draftId);

    await dataSource
      .getRepository(NotificationEntity)
      .update(
        { id: draftId },
        { draftExpiresAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
      );

    const publishRes = await http
      .post(`${notificationsUrl}/${draftId}/publish`)
      .set('Authorization', `Bearer ${ownerAccessToken}`);

    expect(publishRes.statusCode).toBe(410);

    const persisted = await dataSource
      .getRepository(NotificationEntity)
      .findOne({ where: { id: draftId } });
    console.log('persisted+++++++++++++++++++: ', persisted);
    expect(persisted).toBeNull();

    const outboxCount = await dataSource
      .getRepository(NotificationOutboxEntity)
      .count({ where: { notificationId: draftId } });
    expect(outboxCount).toBe(0);
  });

  it('should reject publishing when a draft recipient became inactive or suspended before publish', async () => {
    const member = await createMemberInOrg(ownerOrgId, RoleEnum.ORG_MEMBER);

    const draftRes = await http
      .post(notificationsUrl)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({
        title: 'Recipient became inactive before publish',
        message: 'Publish must revalidate recipients at publication time.',
        status: 'DRAFT',
        recipientMembershipIds: [member.membershipId],
      })
      .expect(201);

    const draftId: string = draftRes.body.data.id;
    createdNotificationIds.push(draftId);

    await dataSource
      .getRepository(OrganisationMembershipEntity)
      .update(
        { id: member.membershipId },
        { status: OrganisationMembershipStatusEnum.SUSPENDED },
      );

    const publishRes = await http
      .post(`${notificationsUrl}/${draftId}/publish`)
      .set('Authorization', `Bearer ${ownerAccessToken}`);

    expect(publishRes.statusCode).toBe(400);

    const draftAfter = await dataSource
      .getRepository(NotificationEntity)
      .findOne({ where: { id: draftId } });
    expect(draftAfter?.status).toBe(NotificationStatusEnum.DRAFT);

    const outboxCount = await dataSource
      .getRepository(NotificationOutboxEntity)
      .count({ where: { notificationId: draftId } });
    expect(outboxCount).toBe(0);
  });

  it('should reject publishing a draft belonging to another organisation', async () => {
    const member = await createMemberInOrg(ownerOrgId, RoleEnum.ORG_MEMBER);

    const draftRes = await http
      .post(notificationsUrl)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({
        title: 'Org 1 draft',
        message: 'Cross-org publish must fail.',
        status: 'DRAFT',
        recipientMembershipIds: [member.membershipId],
      })
      .expect(201);

    const draftId: string = draftRes.body.data.id;
    createdNotificationIds.push(draftId);

    const publishRes = await http
      .post(`${notificationsUrl}/${draftId}/publish`)
      .set('Authorization', `Bearer ${secondOrgAccessToken}`);

    expect(publishRes.statusCode).toBe(404);
  });
});
