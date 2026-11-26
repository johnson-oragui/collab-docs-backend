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
  NotificationOutboxEventTypeEnum,
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

describe('Organisation Notification Deletion (e2e)', () => {
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

  const createRegistrationPayload = (prefix = 'notif-del') => {
    const uniqueId = randomUUID().replace(/-/g, '');
    return {
      email: `${prefix}-${uniqueId}@example.com`,
      password: SHARED_PASSWORD,
      confirmPassword: SHARED_PASSWORD,
      acceptTerms: true,
      firstname: 'Radia',
      lastname: 'Perlman',
      organisationName: `Delete Draft Org ${uniqueId}`,
      organisationDescription: 'Notification delete draft E2E test org.',
      organisationEmail: `del-org-${uniqueId}@example.com`,
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

    const email = `del-member-${randomUUID().slice(0, 8)}@example.com`;
    const user = await userRepo.save(
      userRepo.create({
        email,
        firstName: 'Hedy',
        lastName: 'Lamarr',
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

    const ownerPayload = createRegistrationPayload('notif-del-owner');
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
    await grantPermissionToMembership(ownerMembershipId, 'notification:delete');

    const secondOrg = await registerVerifyAndLogin('notif-del-other');
    secondOrgAccessToken = secondOrg.accessToken;
    await grantPermissionToMembership(
      secondOrg.membershipId,
      'notification:delete',
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
    const res = await http.delete(`${notificationsUrl}/${uuidv7()}`);
    expect(res.statusCode).toBe(401);
  });

  it('should delete a non-expired DRAFT notification', async () => {
    const createRes = await http
      .post(notificationsUrl)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({
        title: 'Temporary draft to delete',
        message: 'Will be removed cleanly.',
        type: NotificationTypeEnum.ANNOUNCEMENT,
        status: 'DRAFT',
        recipientMembershipIds: [ownerMembershipId],
      })
      .expect(201);

    const draftId: string = createRes.body.data.id;
    createdNotificationIds.push(draftId);

    const delRes = await http
      .delete(`${notificationsUrl}/${draftId}`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200);

    expect(delRes.body.success).toBe(true);

    const persisted = await dataSource
      .getRepository(NotificationEntity)
      .findOne({ where: { id: draftId } });
    expect(persisted).toBeNull();
  });

  it('should reject deleting a PUBLISHED notification with 409 and preserve it', async () => {
    const member = await createMemberInOrg(ownerOrgId, RoleEnum.ORG_MEMBER);

    const createRes = await http
      .post(notificationsUrl)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({
        title: 'Published notice',
        message: 'Must not be deleted via draft delete endpoint.',
        status: 'PUBLISHED',
        recipientMembershipIds: [member.membershipId],
      })
      .expect(201);

    const publishedId: string = createRes.body.data.id;
    createdNotificationIds.push(publishedId);

    const delRes = await http
      .delete(`${notificationsUrl}/${publishedId}`)
      .set('Authorization', `Bearer ${ownerAccessToken}`);

    expect(delRes.statusCode).toBe(409);

    const persisted = await dataSource
      .getRepository(NotificationEntity)
      .findOne({ where: { id: publishedId } });
    expect(persisted).not.toBeNull();
    expect(persisted?.status).toBe(NotificationStatusEnum.PUBLISHED);
  });

  it('should remove an expired draft and return 410', async () => {
    const createRes = await http
      .post(notificationsUrl)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({
        title: 'Expired draft',
        message: 'Past draftExpiresAt timestamp.',
        status: 'DRAFT',
      })
      .expect(201);

    const expiredDraftId: string = createRes.body.data.id;
    createdNotificationIds.push(expiredDraftId);

    await dataSource
      .getRepository(NotificationEntity)
      .update(
        { id: expiredDraftId },
        { draftExpiresAt: new Date(Date.now() - 60_000) },
      );

    const delRes = await http
      .delete(`${notificationsUrl}/${expiredDraftId}`)
      .set('Authorization', `Bearer ${ownerAccessToken}`);

    expect(delRes.statusCode).toBe(410);

    const persisted = await dataSource
      .getRepository(NotificationEntity)
      .findOne({ where: { id: expiredDraftId } });
    expect(persisted).toBeNull();
  });

  it('should return 404 when attempting to delete a draft belonging to another organisation', async () => {
    const createRes = await http
      .post(notificationsUrl)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({
        title: 'Org 1 isolated draft',
        message: 'Should not be deleted by Org 2.',
        status: 'DRAFT',
      })
      .expect(201);

    const draftId: string = createRes.body.data.id;
    createdNotificationIds.push(draftId);

    const delRes = await http
      .delete(`${notificationsUrl}/${draftId}`)
      .set('Authorization', `Bearer ${secondOrgAccessToken}`);

    expect(delRes.statusCode).toBe(404);

    const persisted = await dataSource
      .getRepository(NotificationEntity)
      .findOne({ where: { id: draftId } });
    expect(persisted).not.toBeNull();
  });

  it('should reject deletion with 409 and preserve outbox rows when a DRAFT has unexpected outbox records', async () => {
    const member = await createMemberInOrg(ownerOrgId, RoleEnum.ORG_MEMBER);

    const createRes = await http
      .post(notificationsUrl)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({
        title: 'Draft with anomalous outbox row',
        message: 'Integrity guard should prevent blind deletion.',
        status: 'DRAFT',
      })
      .expect(201);

    const draftId: string = createRes.body.data.id;
    createdNotificationIds.push(draftId);

    const outboxRepo = dataSource.getRepository(NotificationOutboxEntity);
    await outboxRepo.save(
      outboxRepo.create({
        notificationId: draftId,
        notification: { id: draftId } as NotificationEntity,
        recipientMembershipId: member.membershipId,
        eventType: NotificationOutboxEventTypeEnum.NOTIFICATION_PUBLISHED,
        status: NotificationOutboxStatusEnum.PENDING,
        attempts: 0,
        nextAttemptAt: new Date(),
        dispatchedAt: null,
        lastError: null,
      }),
    );

    const delRes = await http
      .delete(`${notificationsUrl}/${draftId}`)
      .set('Authorization', `Bearer ${ownerAccessToken}`);

    expect(delRes.statusCode).toBe(409);

    const persistedDraft = await dataSource
      .getRepository(NotificationEntity)
      .findOne({ where: { id: draftId } });
    expect(persistedDraft).not.toBeNull();

    const remainingOutbox = await outboxRepo.count({
      where: { notificationId: draftId },
    });
    expect(remainingOutbox).toBe(1);
  });
});
