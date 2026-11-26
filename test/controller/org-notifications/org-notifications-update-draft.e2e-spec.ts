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
import { PasswordService } from '@/password/password.service';
import {
  NotificationStatusEnum,
  NotificationTypeEnum,
  OrganisationMembershipStatusEnum,
  RoleEnum,
  TOrganisationMembershipStatusEnum,
  TRoleEnum,
} from '@/database/database.enums';
import { NotificationEntity } from '@/notification/notification.entity';
import { UserSessionEntity } from '@/user_sessions/user-session.entity';
import { uuidv7 } from 'uuidv7';

const SHARED_PASSWORD = 'StrongPassword123#';

describe('Organisation Notification Draft Update (e2e)', () => {
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
  let secondOrgId: string;

  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdNotificationIds: string[] = [];

  const notificationsUrl = '/api/v1/organisation-notifications';

  const createRegistrationPayload = (prefix = 'notif-upd') => {
    const uniqueId = randomUUID().replace(/-/g, '');
    return {
      email: `${prefix}-${uniqueId}@example.com`,
      password: SHARED_PASSWORD,
      confirmPassword: SHARED_PASSWORD,
      acceptTerms: true,
      firstname: 'Grace',
      lastname: 'Hopper',
      organisationName: `Update Draft Org ${uniqueId}`,
      organisationDescription: 'Notification update draft E2E test org.',
      organisationEmail: `upd-org-${uniqueId}@example.com`,
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

    const email = `upd-member-${randomUUID().slice(0, 8)}@example.com`;
    const user = await userRepo.save(
      userRepo.create({
        email,
        firstName: 'Barbara',
        lastName: 'Liskov',
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

    const ownerPayload = createRegistrationPayload('notif-upd-owner');
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

    const secondOrg = await registerVerifyAndLogin('notif-upd-other');
    secondOrgId = secondOrg.orgId;
    secondOrgAccessToken = secondOrg.accessToken;
    await grantPermissionToMembership(
      secondOrg.membershipId,
      'notification:update',
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
      .patch(`${notificationsUrl}/${uuidv7()}`)
      .send({ title: 'Unauthorized update' });

    expect(res.statusCode).toBe(401);
  });

  it('should update title, message, and type while preserving draftExpiresAt, creator, and organisation', async () => {
    const createRes = await http
      .post(notificationsUrl)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({
        title: 'Initial draft title',
        message: 'Initial draft body',
        type: NotificationTypeEnum.ANNOUNCEMENT,
        status: 'DRAFT',
        recipientMembershipIds: [ownerMembershipId],
      })
      .expect(201);

    const draftId: string = createRes.body.data.id;
    const originalExpiresAt: string = createRes.body.data.draftExpiresAt;
    const originalCreatorId: string = createRes.body.data.createdByMembershipId;
    createdNotificationIds.push(draftId);

    const patchRes = await http
      .patch(`${notificationsUrl}/${draftId}`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({
        title: 'Updated draft title',
        message: 'Updated draft body',
        type: NotificationTypeEnum.ALERT,
      });
    // console.log(
    //   '++++++++++++++++++++++++++',
    //   JSON.stringify(patchRes.body.data),
    // );
    expect(patchRes.statusCode).toBe(201);

    expect(patchRes.body.success).toBe(true);
    expect(patchRes.body.data.title).toBe('Updated draft title');
    expect(patchRes.body.data.message).toBe('Updated draft body');
    expect(patchRes.body.data.type).toBe(NotificationTypeEnum.ALERT);
    expect(patchRes.body.data.status).toBe(NotificationStatusEnum.DRAFT);
    expect(patchRes.body.data.organisationId).toBe(ownerOrgId);
    expect(patchRes.body.data.createdByMembershipId).toBe(originalCreatorId);
    expect(patchRes.body.data.publishedAt).toBeNull();
    expect(patchRes.body.data.draftExpiresAt).toBe(originalExpiresAt);
  });

  it('should reject empty update payloads', async () => {
    const createRes = await http
      .post(notificationsUrl)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({
        title: 'Non-empty guard draft',
        message: 'Body text',
        status: 'DRAFT',
      })
      .expect(201);

    const draftId: string = createRes.body.data.id;
    createdNotificationIds.push(draftId);

    const res = await http
      .patch(`${notificationsUrl}/${draftId}`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({});

    expect(res.statusCode).toBe(400);
  });

  it('should reject updating a PUBLISHED notification with 409', async () => {
    const member = await createMemberInOrg(ownerOrgId, RoleEnum.ORG_MEMBER);

    const createRes = await http
      .post(notificationsUrl)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({
        title: 'Already published notice',
        message: 'Published content cannot be edited via draft endpoint',
        status: 'PUBLISHED',
        recipientMembershipIds: [member.membershipId],
      })
      .expect(201);

    const publishedId: string = createRes.body.data.id;
    createdNotificationIds.push(publishedId);

    const res = await http
      .patch(`${notificationsUrl}/${publishedId}`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({
        title: 'Attempted edit on published',
      });

    expect(res.statusCode).toBe(409);
  });

  it('should delete an expired draft and return 410', async () => {
    const createRes = await http
      .post(notificationsUrl)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({
        title: 'Draft about to expire',
        message: 'Will be backdated in DB',
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

    const res = await http
      .patch(`${notificationsUrl}/${expiredDraftId}`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({
        title: 'Too late to update',
      });

    expect(res.statusCode).toBe(410);

    const persisted = await dataSource
      .getRepository(NotificationEntity)
      .findOne({ where: { id: expiredDraftId } });
    expect(persisted).toBeNull();
  });

  it('should reject updating a draft belonging to another organisation', async () => {
    const createRes = await http
      .post(notificationsUrl)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({
        title: 'Org 1 private draft',
        message: 'Should not be accessible from Org 2',
        status: 'DRAFT',
      })
      .expect(201);

    const draftId: string = createRes.body.data.id;
    createdNotificationIds.push(draftId);

    const res = await http
      .patch(`${notificationsUrl}/${draftId}`)
      .set('Authorization', `Bearer ${secondOrgAccessToken}`)
      .send({
        title: 'Cross-org hijack attempt',
      });

    expect([403, 404]).toContain(res.statusCode);
  });

  it('should reject inactive or cross-org recipientMembershipIds during draft update', async () => {
    const createRes = await http
      .post(notificationsUrl)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({
        title: 'Draft with recipient list',
        message: 'Testing recipient validation on update',
        status: 'DRAFT',
        recipientMembershipIds: [ownerMembershipId],
      })
      .expect(201);

    const draftId: string = createRes.body.data.id;
    createdNotificationIds.push(draftId);

    const suspendedMember = await createMemberInOrg(
      ownerOrgId,
      RoleEnum.ORG_MEMBER,
      OrganisationMembershipStatusEnum.SUSPENDED,
    );

    const res = await http
      .patch(`${notificationsUrl}/${draftId}`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({
        recipientMembershipIds: [suspendedMember.membershipId],
      });

    expect(res.statusCode).toBe(400);
  });
});
