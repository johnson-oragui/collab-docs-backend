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

const SHARED_PASSWORD = 'StrongPassword123#';

describe('Mark All Organisation Notificaion(s) as Read (e2e)', () => {
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

  let memberBMembershipId: string;

  let secondOrgAccessToken: string;
  let secondOrgMembershipId: string;

  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdNotificationIds: string[] = [];

  const notificationsUrl = '/api/v1/organisation-notifications';

  const readAllUrl = (membershipId: string) =>
    `${notificationsUrl}/memberships/${membershipId}/read-all`;

  const createRegistrationPayload = (prefix = 'notif-read-all') => {
    const uniqueId = randomUUID().replace(/-/g, '');
    return {
      email: `${prefix}-${uniqueId}@example.com`,
      password: SHARED_PASSWORD,
      confirmPassword: SHARED_PASSWORD,
      acceptTerms: true,
      firstname: 'Barbara',
      lastname: 'Liskov',
      organisationName: `Read All Org ${uniqueId}`,
      organisationDescription: 'Bulk mark-all-read E2E test org.',
      organisationEmail: `read-all-org-${uniqueId}@example.com`,
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

    const rawEmail = `read-all-member-${randomUUID().slice(0, 8)}@example.com`;
    const user = await userRepo.save(
      userRepo.create({
        email: rawEmail,
        firstName: 'Frances',
        lastName: 'Allen',
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
        message: `Payload for ${title}`,
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

    const ownerPayload = createRegistrationPayload('notif-read-all-owner');
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
    memberBMembershipId = memberB.membershipId;
    await grantPermissionToMembership(memberBMembershipId, 'notification:read');

    const secondOrg = await registerVerifyAndLogin('notif-read-all-other');
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

  it('should return 401 when unauthenticated', async () => {
    const res = await http.patch(readAllUrl(randomUUID()));
    expect(res.statusCode).toBe(401);
  });

  it('should bulk-mark unread notifications as read while preserving already-read readAt and isolating other memberships', async () => {
    const alreadyReadNotificationId = await publishNotificationForRecipients(
      'Already read earlier',
      [memberAMembershipId, memberBMembershipId],
    );
    const unreadOneId = await publishNotificationForRecipients(
      'Unread batch item 1',
      [memberAMembershipId, memberBMembershipId],
    );
    const unreadTwoId = await publishNotificationForRecipients(
      'Unread batch item 2',
      [memberAMembershipId],
    );

    const recipientRepo = dataSource.getRepository(NotificationRecipientEntity);
    const earlierReadAt = new Date(Date.now() - 3_600_000);

    await recipientRepo.update(
      {
        notificationId: alreadyReadNotificationId,
        membershipId: memberAMembershipId,
      },
      { readAt: earlierReadAt },
    );

    const res = await http
      .patch(readAllUrl(memberAMembershipId))
      .set('Authorization', `Bearer ${memberAAccessToken}`)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.updatedCount).toBe(2);

    // calling read-all a second time should update 0 rows idempotently
    const secondRes = await http
      .patch(readAllUrl(memberAMembershipId))
      .set('Authorization', `Bearer ${memberAAccessToken}`)
      .expect(201);

    expect(secondRes.body.data.updatedCount).toBe(0);

    // previously read row keeps its original readAt timestamp
    const preservedRow = await recipientRepo.findOne({
      where: {
        notificationId: alreadyReadNotificationId,
        membershipId: memberAMembershipId,
      },
    });
    expect(
      Math.abs(
        new Date(preservedRow!.readAt!).getTime() - earlierReadAt.getTime(),
      ),
    ).toBeLessThan(1000);

    // newly bulk-marked rows now have readAt set
    for (const id of [unreadOneId, unreadTwoId]) {
      const row = await recipientRepo.findOne({
        where: {
          notificationId: id,
          membershipId: memberAMembershipId,
        },
      });
      expect(row?.readAt).toBeTruthy();
    }

    // member B's recipient rows must remain unread
    for (const id of [alreadyReadNotificationId, unreadOneId]) {
      const memberBRow = await recipientRepo.findOne({
        where: {
          notificationId: id,
          membershipId: memberBMembershipId,
        },
      });
      expect(memberBRow?.readAt).toBeNull();
    }
  });

  it('should reject marking another member or cross-organisation membership read-all', async () => {
    const otherMemberAttempt = await http
      .patch(readAllUrl(memberBMembershipId))
      .set('Authorization', `Bearer ${memberAAccessToken}`);

    expect(otherMemberAttempt.statusCode).toBe(403);

    const crossOrgAttempt = await http
      .patch(readAllUrl(secondOrgMembershipId))
      .set('Authorization', `Bearer ${memberAAccessToken}`);

    expect(crossOrgAttempt.statusCode).toBe(403);
  });
});
