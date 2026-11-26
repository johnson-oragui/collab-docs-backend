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
  NotificationStatusEnum,
  NotificationTypeEnum,
  OrganisationMembershipStatusEnum,
  RoleEnum,
  TNotificationTypeEnum,
  TRoleEnum,
} from '@/database/database.enums';
import { PasswordService } from '@/password/password.service';
import { NotificationEntity } from '@/notification/notification.entity';
import { UserSessionEntity } from '@/user_sessions/user-session.entity';
import { runGraphql } from '@/test/fixtures/run-graphql';

const SHARED_PASSWORD = 'StrongPassword123#';

const GET_MEMBERSHIP_NOTIFICATIONS_QUERY = `
  query GetMembershipNotifications($filter: GetNotificationsQueryInputDto) {
    getMembershipNotifications(filter: $filter) {
      success
      message
      data {
        id
        recipientId
        membershipId
        title
        message
        type
        publishedAt
        readAt
        isRead
      }
      meta {
        page
        limit
        total
        totalPages
        hasNextPage
        hasPreviousPage
      }
    }
  }
`;

describe('GraphQL getMembershipNotifications (e2e)', () => {
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

  let memberAccessToken: string;
  let memberMembershipId: string;

  let otherMemberMembershipId: string;

  let secondOrgAccessToken: string;
  let secondOrgMembershipId: string;

  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdNotificationIds: string[] = [];

  const restNotificationsUrl = '/api/v1/organisation-notifications';

  const createRegistrationPayload = (prefix = 'gql-notif') => {
    const uniqueId = randomUUID().replace(/-/g, '');
    return {
      email: `${prefix}-${uniqueId}@example.com`,
      password: SHARED_PASSWORD,
      confirmPassword: SHARED_PASSWORD,
      acceptTerms: true,
      firstname: 'Linus',
      lastname: 'Torvalds',
      organisationName: `GQL Inbox Org ${uniqueId}`,
      organisationDescription: 'GraphQL membership notifications E2E test org.',
      organisationEmail: `gql-inbox-org-${uniqueId}@example.com`,
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

  const createMemberAndLogin = async (orgId: string, roleName: TRoleEnum) => {
    const userRepo = dataSource.getRepository(UserEntity);
    const membershipRepo = dataSource.getRepository(
      OrganisationMembershipEntity,
    );
    const roleRepo = dataSource.getRepository(RoleEntity);

    const role = await roleRepo.findOne({ where: { name: roleName } });
    if (!role) {
      throw new Error(`Role ${roleName} not seeded in test DB`);
    }

    const rawEmail = `gql-member-${randomUUID().slice(0, 8)}@example.com`;
    const user = await userRepo.save(
      userRepo.create({
        email: rawEmail,
        firstName: 'Ken',
        lastName: 'Thompson',
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
        status: OrganisationMembershipStatusEnum.ACTIVE,
      }),
    );

    const loginRes = await http
      .post('/api/v1/auth/login')
      .send({ email: rawEmail, password: SHARED_PASSWORD })
      .expect(200);

    return {
      userId: user.id,
      membershipId: membership.id,
      accessToken: loginRes.body.data.accessToken as string,
    };
  };

  const publishNotificationForRecipients = async (
    title: string,
    recipientMembershipIds: string[],
    type: TNotificationTypeEnum = NotificationTypeEnum.ANNOUNCEMENT,
  ): Promise<string> => {
    const res = await http
      .post(restNotificationsUrl)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({
        title,
        message: `Body for ${title}`,
        type,
        status: NotificationStatusEnum.PUBLISHED,
        recipientMembershipIds,
      })
      .expect(201);

    const id: string = res.body.data.id;
    createdNotificationIds.push(id);
    return id;
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

    const ownerPayload = createRegistrationPayload('gql-owner');
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

    const memberA = await createMemberAndLogin(ownerOrgId, RoleEnum.ORG_MEMBER);
    memberAccessToken = memberA.accessToken;
    memberMembershipId = memberA.membershipId;
    await grantPermissionToMembership(memberMembershipId, 'notification:read');

    const memberB = await createMemberAndLogin(ownerOrgId, RoleEnum.ORG_MEMBER);
    otherMemberMembershipId = memberB.membershipId;
    await grantPermissionToMembership(
      otherMemberMembershipId,
      'notification:read',
    );

    const secondOrg = await registerVerifyAndLogin('gql-other-org');
    secondOrgAccessToken = secondOrg.accessToken;
    secondOrgMembershipId = secondOrg.membershipId;
    await grantPermissionToMembership(
      secondOrgMembershipId,
      'notification:read',
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

  it('should reject unauthenticated requests', async () => {
    const res = await runGraphql(http, GET_MEMBERSHIP_NOTIFICATIONS_QUERY, {
      filter: { membershipId: memberMembershipId, page: 1, limit: 10 },
    });

    expect(res.body.errors).toBeDefined();
  });

  it('should paginate notifications, exclude DRAFTs, and derive isRead from readAt', async () => {
    const n1 = await publishNotificationForRecipients('Notice 1', [
      memberMembershipId,
    ]);
    const n2 = await publishNotificationForRecipients('Notice 2', [
      memberMembershipId,
    ]);
    const n3 = await publishNotificationForRecipients('Notice 3', [
      memberMembershipId,
    ]);

    // create a DRAFT targeting memberMembershipId. must never appear in feed
    const draftRes = await http
      .post(restNotificationsUrl)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({
        title: 'Secret Draft Notice',
        message: 'Should not appear in inbox',
        status: NotificationStatusEnum.DRAFT,
        recipientMembershipIds: [memberMembershipId],
      })
      .expect(201);
    createdNotificationIds.push(draftRes.body.data.id);

    // mark n2 as read in NotificationRecipientEntity
    await dataSource.getRepository(NotificationRecipientEntity).update(
      {
        notificationId: n2,
        membershipId: memberMembershipId,
      },
      { readAt: new Date() },
    );

    const page1Res = await runGraphql(
      http,
      GET_MEMBERSHIP_NOTIFICATIONS_QUERY,
      {
        filter: {
          membershipId: memberMembershipId,
          page: 1,
          limit: 2,
        },
      },
      memberAccessToken,
    );
    expect(page1Res.statusCode).toBe(200);

    expect(page1Res.body.errors).toBeUndefined();
    const page1 = page1Res.body.data.getMembershipNotifications;
    expect(page1.success).toBe(true);
    expect(page1.data).toHaveLength(2);
    expect(page1.meta).toMatchObject({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false,
    });

    const returnedIds = page1.data.map((item: { id: string }) => item.id);
    expect(returnedIds).not.toContain(draftRes.body.data.id);
    expect([n1, n2, n3]).toEqual(expect.arrayContaining(returnedIds));

    for (const item of page1.data) {
      expect(item.membershipId).toBe(memberMembershipId);
      expect(item.isRead).toBe(Boolean(item.readAt));
    }

    const page2Res = await runGraphql(
      http,
      GET_MEMBERSHIP_NOTIFICATIONS_QUERY,
      {
        filter: {
          membershipId: memberMembershipId,
          page: 2,
          limit: 2,
        },
      },
      memberAccessToken,
    );
    expect(page2Res.statusCode).toBe(200);

    const page2 = page2Res.body.data.getMembershipNotifications;
    expect(page2.data).toHaveLength(1);
    expect(page2.meta).toMatchObject({
      page: 2,
      limit: 2,
      total: 3,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true,
    });
  });

  it('should filter by unreadOnly=true when requested', async () => {
    const unreadRes = await runGraphql(
      http,
      GET_MEMBERSHIP_NOTIFICATIONS_QUERY,
      {
        filter: {
          membershipId: memberMembershipId,
          page: 1,
          limit: 20,
          unreadOnly: true,
        },
      },
      memberAccessToken,
    );
    expect(unreadRes.statusCode).toBe(200);

    expect(unreadRes.body.errors).toBeUndefined();
    const payload = unreadRes.body.data.getMembershipNotifications;
    expect(payload.data.length).toBeGreaterThanOrEqual(1);
    for (const item of payload.data) {
      expect(item.isRead).toBe(false);
      expect(item.readAt).toBeNull();
    }
  });

  it('should isolate notifications across memberships and organisations', async () => {
    // publish a notification only for otherMemberMembershipId
    await publishNotificationForRecipients('Other Member Only', [
      otherMemberMembershipId,
    ]);

    const otherMemberFeed = await runGraphql(
      http,
      GET_MEMBERSHIP_NOTIFICATIONS_QUERY,
      {
        filter: {
          membershipId: otherMemberMembershipId,
          page: 1,
          limit: 20,
        },
      },
      memberAccessToken,
    );
    expect(otherMemberFeed.body.errors).toBeDefined();

    // cross-organisation membershipId query must also fail
    const crossOrgFeed = await runGraphql(
      http,
      GET_MEMBERSHIP_NOTIFICATIONS_QUERY,
      {
        filter: {
          membershipId: secondOrgMembershipId,
          page: 1,
          limit: 20,
        },
      },
      memberAccessToken,
    );
    expect(crossOrgFeed.body.errors).toBeDefined();

    // second org user calling with their own membership should see 0 items from first org
    const secondOrgOwnFeed = await runGraphql(
      http,
      GET_MEMBERSHIP_NOTIFICATIONS_QUERY,
      {
        filter: {
          membershipId: secondOrgMembershipId,
          page: 1,
          limit: 20,
        },
      },
      secondOrgAccessToken,
    );
    expect(secondOrgOwnFeed.statusCode).toBe(200);

    expect(secondOrgOwnFeed.body.errors).toBeUndefined();
    expect(secondOrgOwnFeed.body.data.getMembershipNotifications.data).toEqual(
      [],
    );
    expect(
      secondOrgOwnFeed.body.data.getMembershipNotifications.meta.total,
    ).toBe(0);
  });
});
