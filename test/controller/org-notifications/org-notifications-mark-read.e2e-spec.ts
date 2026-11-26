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
  TRoleEnum,
} from '@/database/database.enums';
import { PasswordService } from '@/password/password.service';
import { NotificationEntity } from '@/notification/notification.entity';
import { UserSessionEntity } from '@/user_sessions/user-session.entity';
import { uuidv7 } from 'uuidv7';

const SHARED_PASSWORD = 'StrongPassword123#';

describe('Mark OrganisationMembershipNotifications as Read/Unread (e2e)', () => {
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

  let memberAAccessToken: string;
  let memberAMembershipId: string;

  let memberBAccessToken: string;
  let memberBMembershipId: string;

  let secondOrgAccessToken: string;

  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdNotificationIds: string[] = [];

  const notificationsUrl = 'organisation-notifications';

  const createRegistrationPayload = (prefix = 'notif-read') => {
    const uniqueId = randomUUID().replace(/-/g, '');
    return {
      email: `${prefix}-${uniqueId}@example.com`,
      password: SHARED_PASSWORD,
      confirmPassword: SHARED_PASSWORD,
      acceptTerms: true,
      firstname: 'Ada',
      lastname: 'Lovelace',
      organisationName: `Read State Org ${uniqueId}`,
      organisationDescription: 'Notification read state E2E test org.',
      organisationEmail: `read-org-${uniqueId}@example.com`,
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

    const rawEmail = `read-member-${randomUUID().slice(0, 8)}@example.com`;
    const user = await userRepo.save(
      userRepo.create({
        email: rawEmail,
        firstName: 'Grace',
        lastName: 'Hopper',
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
  ): Promise<string> => {
    const res = await http
      .post(notificationsUrl)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({
        title,
        message: `Details for ${title}`,
        type: NotificationTypeEnum.ANNOUNCEMENT,
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

    const ownerPayload = createRegistrationPayload('notif-read-owner');
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
    memberAAccessToken = memberA.accessToken;
    memberAMembershipId = memberA.membershipId;
    await grantPermissionToMembership(memberAMembershipId, 'notification:read');

    const memberB = await createMemberAndLogin(ownerOrgId, RoleEnum.ORG_MEMBER);
    memberBAccessToken = memberB.accessToken;
    memberBMembershipId = memberB.membershipId;
    await grantPermissionToMembership(memberBMembershipId, 'notification:read');

    const secondOrg = await registerVerifyAndLogin('notif-read-other');
    secondOrgAccessToken = secondOrg.accessToken;
    await grantPermissionToMembership(
      secondOrg.membershipId,
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

  it('should return 401 when unauthenticated', async () => {
    const res = await http
      .patch(`${notificationsUrl}/${uuidv7()}/members`)
      .send({ read: true });
    expect(res.statusCode).toBe(401);
  });

  it('should mark a notification as read idempotently without overwriting readAt or creating duplicate rows', async () => {
    const notificationId = await publishNotificationForRecipients(
      'Idempotent read check',
      [memberAMembershipId, memberBMembershipId],
    );

    const firstReadRes = await http
      .patch(`${notificationsUrl}/${notificationId}/members`)
      .set('Authorization', `Bearer ${memberAAccessToken}`)
      .send({ read: true })
      .expect(201);

    expect(firstReadRes.body.success).toBe(true);
    expect(firstReadRes.body.data.isRead).toBe(true);
    expect(firstReadRes.body.data.readAt).toBeTruthy();

    const recipientRepo = dataSource.getRepository(NotificationRecipientEntity);
    const afterFirstRead = await recipientRepo.findOne({
      where: {
        notificationId,
        membershipId: memberAMembershipId,
      },
    });
    const initialReadAtMs = new Date(afterFirstRead!.readAt!).getTime();

    await new Promise((resolve) => setTimeout(resolve, 15));

    const secondReadRes = await http
      .patch(`${notificationsUrl}/${notificationId}/members`)
      .set('Authorization', `Bearer ${memberAAccessToken}`)
      .send({ read: true })
      .expect(201);

    expect(secondReadRes.body.success).toBe(true);
    expect(secondReadRes.body.data.isRead).toBe(true);

    const recipientRowsForA = await recipientRepo.find({
      where: {
        notificationId,
        membershipId: memberAMembershipId,
      },
    });
    expect(recipientRowsForA).toHaveLength(1);
    expect(new Date(recipientRowsForA[0].readAt!).getTime()).toBe(
      initialReadAtMs,
    );

    // member B's read state must remain untouched
    const recipientRowForB = await recipientRepo.findOne({
      where: {
        notificationId,
        membershipId: memberBMembershipId,
      },
    });
    expect(recipientRowForB?.readAt).toBeNull();
  });

  it('should toggle a read notification back to unread by clearing readAt', async () => {
    const notificationId = await publishNotificationForRecipients(
      'Unread toggle check',
      [memberAMembershipId],
    );

    await http
      .patch(`${notificationsUrl}/${notificationId}/members`)
      .set('Authorization', `Bearer ${memberAAccessToken}`)
      .send({ read: true })
      .expect(201);

    const unreadRes = await http
      .patch(`${notificationsUrl}/${notificationId}/members`)
      .set('Authorization', `Bearer ${memberAAccessToken}`)
      .send({ read: false })
      .expect(201);

    expect(unreadRes.body.success).toBe(true);
    expect(unreadRes.body.data.isRead).toBe(false);
    expect(unreadRes.body.data.readAt).toBeNull();

    const persisted = await dataSource
      .getRepository(NotificationRecipientEntity)
      .findOne({
        where: {
          notificationId,
          membershipId: memberAMembershipId,
        },
      });
    expect(persisted?.readAt).toBeNull();
  });

  it('should isolate read state across memberships and reject non-recipients and cross-org callers', async () => {
    // published only to member-A-MembershipId; member-B-MembershipId has no recipient row
    const notificationId = await publishNotificationForRecipients(
      'Member A exclusive notice',
      [memberAMembershipId],
    );

    const memberBAttempt = await http
      .patch(`${notificationsUrl}/${notificationId}/members`)
      .set('Authorization', `Bearer ${memberBAccessToken}`)
      .send({ read: true });

    expect(memberBAttempt.statusCode).toBe(404);

    const crossOrgAttempt = await http
      .patch(`${notificationsUrl}/${notificationId}/members`)
      .set('Authorization', `Bearer ${secondOrgAccessToken}`)
      .send({ read: true });

    expect(crossOrgAttempt.statusCode).toBe(404);
  });

  it('should reject updating read state on a DRAFT notification', async () => {
    const draftRes = await http
      .post(notificationsUrl)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({
        title: 'Draft notice cannot be marked read',
        message: 'Only published notifications support read state.',
        status: NotificationStatusEnum.DRAFT,
        recipientMembershipIds: [memberAMembershipId],
      })
      .expect(201);

    const draftId: string = draftRes.body.data.id;
    createdNotificationIds.push(draftId);

    const patchRes = await http
      .patch(`${notificationsUrl}/${draftId}/members`)
      .set('Authorization', `Bearer ${memberAAccessToken}`)
      .send({ read: true });

    expect(patchRes.statusCode).toBe(400);
  });
});
