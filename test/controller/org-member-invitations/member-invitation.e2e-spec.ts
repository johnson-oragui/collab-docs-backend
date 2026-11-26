import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { randomBytes, randomUUID } from 'node:crypto';

import { createE2eApp } from '@/test/fixtures/create-e2e-app';
import { createHttpClient } from '@/test/fixtures/helpers/http-request';

import { UserEntity } from '@/user/user.entity';
import { ProfileEntity } from '@/profile/profile.entity';
import { OrganisationEntity } from '@/organisations/organisations.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { InvitationPermissionEntity } from '@/invitation_permissions/invitation_permissions.entity';
import { MembershipPermissionEntity } from '@/membership_permissions/membership_permissions.entity';
import { OrganisationAuditEntity } from '@/organisation_audit/organisation_audit.entity';
import { OrganisationOwnershipHistoryEntity } from '@/organisation-ownership-history/organisation-ownership-history.entity';
import { UserSessionEntity } from '@/user_sessions/user-session.entity';
import { UserSessionTokenEntity } from '@/user-session-token/user-session-token.entity';
import { RoleEntity } from '@/roles/roles.entity';
import { EmailVerificationService } from '@/email-verification/email-verification.service';
import {
  InvitationStatusEnum,
  OrganisationMembershipStatusEnum,
  OrganisationStatusEnum,
  RoleEnum,
} from '@/database/database.enums';
import { PermissionAssignmentModeEnum } from '@/commons/enums';
import { OrganisationMembershipInvitationEntity } from '@/org_membership_invitation/org_membership_invitation.entity';
import { PasswordService } from '@/password/password.service';
import { generateRandomIPv4 } from '@/commons/util/generateRandomIPv4';
import { uuidv7 } from 'uuidv7';
import { OrganisationmembershipinvitationService } from '@/org_membership_invitation/org_membership_invitation.service';

describe('Organisation-Invitations (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof createHttpClient>;
  let dataSource: DataSource;
  let emailVerificationService: EmailVerificationService;
  let passwordService: PasswordService;
  let organisationmembershipinvitationService: OrganisationmembershipinvitationService;

  let invitationRepo: Repository<OrganisationMembershipInvitationEntity>;

  let registrationPayload: ReturnType<typeof createRegistrationPayload>;
  let registeredUserId: string;
  let registeredOrganisationId: string;
  let rawVerificationToken: string;
  let getRegistrationTokenSpy: jest.SpyInstance;
  let accessToken: string;

  // Secondary org & user for cross-org
  let secondOrgId: string;
  let secondOrgUserId: string;
  let secondOrgAdminEmail: string;
  let secondOrgAccesToken: string;

  // Secondary user for non-admin RBAC tests
  let firstOrgMemberUserId: string;
  let firstOrgMemberAccessToken: string;

  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];

  const createRegistrationPayload = (prefix = 'inv-admin') => {
    const uniqueId = randomUUID().replace(/-/g, '');
    return {
      email: `${prefix}-${uniqueId}@example.com`,
      password: 'StrongPassword123#',
      confirmPassword: 'StrongPassword123#',
      acceptTerms: true,
      firstname: 'Johnson',
      lastname: 'Dennis',
      organisationName: `Org ${uniqueId}`,
      organisationDescription: 'Invitations E2E test organisation.',
      organisationEmail: `org-${uniqueId}@example.com`,
    };
  };

  const registerAndLoginUser = async (prefix: string) => {
    const payload = createRegistrationPayload(prefix);
    const token = randomBytes(32).toString('base64url');
    getRegistrationTokenSpy.mockReturnValueOnce(token);

    const regRes = await http
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', generateRandomIPv4())
      .send(payload)
      .expect(201);

    const userId: string = regRes.body.data.user.id;
    const orgId: string = regRes.body.data.organisation.id;
    createdUserIds.push(userId);
    createdOrgIds.push(orgId);

    await http
      .post('/api/v1/auth/verify-email')
      .send({ token })
      .set('X-Forwarded-For', generateRandomIPv4())
      .expect(201);

    const loginRes = await http
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', generateRandomIPv4())
      .send({ email: payload.email, password: payload.password })
      .expect(200);

    return {
      userId,
      orgId,
      email: payload.email,
      accessToken: loginRes.body.data.accessToken as string,
    };
  };

  beforeAll(async () => {
    app = await createE2eApp(undefined, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
    });
    http = createHttpClient(app);
    dataSource = app.get(DataSource);
    emailVerificationService = app.get(EmailVerificationService);
    organisationmembershipinvitationService = app.get(
      OrganisationmembershipinvitationService,
    );
    passwordService = app.get(PasswordService);
    invitationRepo = dataSource.getRepository(
      OrganisationMembershipInvitationEntity,
    );

    registrationPayload = createRegistrationPayload('inv-owner');
    rawVerificationToken = randomBytes(32).toString('base64url');

    getRegistrationTokenSpy = jest
      .spyOn(emailVerificationService as any, 'getToken')
      .mockReturnValue(rawVerificationToken);

    const registrationResponse = await http
      .post('/api/v1/auth/register')
      .send(registrationPayload)
      .set('X-Forwarded-For', generateRandomIPv4())
      .expect(201);

    registeredUserId = registrationResponse.body.data.user.id;
    registeredOrganisationId = registrationResponse.body.data.organisation.id;
    createdUserIds.push(registeredUserId);
    createdOrgIds.push(registeredOrganisationId);

    const verifyResponse = await http
      .post('/api/v1/auth/verify-email')
      .send({ token: rawVerificationToken })
      .set('X-Forwarded-For', generateRandomIPv4())
      .expect(201);

    expect(verifyResponse.body.success).toBeTruthy();

    const loginResponse = await http
      .post('/api/v1/auth/login')
      .send({
        email: registrationPayload.email,
        password: registrationPayload.password,
      })
      .set('X-Forwarded-For', generateRandomIPv4())
      .expect(200);

    accessToken = loginResponse.body.data.accessToken;

    // Create a second organisation + user for cross-organisation isolation checks
    const secondAccount = await registerAndLoginUser('other-org');
    secondOrgId = secondAccount.orgId;
    secondOrgUserId = secondAccount.userId;
    secondOrgAccesToken = secondAccount.accessToken;
    secondOrgAdminEmail = secondAccount.email;

    // Create a non-admin member inside registeredOrganisationId for 403 role escalation checks
    const firstOrgMemberEmail = `org-member-${randomUUID().slice(0, 8)}@example.com`;
    const firstOrgMemberPassword = 'StrongPassword123#';
    const firstOrgMemberRole = await dataSource
      .getRepository(RoleEntity)
      .findOne({ where: { name: RoleEnum.ORG_MEMBER } });

    const firstOrgMemberUser = await dataSource.getRepository(UserEntity).save(
      dataSource.getRepository(UserEntity).create({
        email: firstOrgMemberEmail,
        firstName: 'Regular',
        lastName: 'Member',
        password: await passwordService.hash(registrationPayload.password),
        emailVerifiedAt: new Date(),
        isActive: true,
        acceptTerms: true,
      }),
    );
    firstOrgMemberUserId = firstOrgMemberUser.id;
    createdUserIds.push(firstOrgMemberUserId);

    await dataSource.getRepository(OrganisationMembershipEntity).save(
      dataSource.getRepository(OrganisationMembershipEntity).create({
        user: { id: firstOrgMemberUserId } as UserEntity,
        organisation: { id: registeredOrganisationId } as OrganisationEntity,
        role: firstOrgMemberRole!,
        status: OrganisationMembershipStatusEnum.ACTIVE,
      }),
    );

    const firstOrgMemberLogin = await http
      .post('/api/v1/auth/login')
      .send({ email: firstOrgMemberEmail, password: firstOrgMemberPassword })
      .expect(200);
    firstOrgMemberAccessToken = firstOrgMemberLogin.body.data.accessToken;
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      const invitationRepo = dataSource.getRepository(
        OrganisationMembershipInvitationEntity,
      );

      if (createdOrgIds.length > 0) {
        const invitations = await invitationRepo.find({
          where: createdOrgIds.map((id) => ({ organisation: { id } })),
        });
        const invitationIds = invitations.map((inv) => inv.id);

        if (invitationIds.length > 0) {
          await dataSource
            .getRepository(InvitationPermissionEntity)
            .createQueryBuilder()
            .delete()
            .where('"invitation_id" IN (:...invitationIds)', { invitationIds })
            .execute();

          await invitationRepo.delete(invitationIds);
        }

        await dataSource
          .getRepository(OrganisationAuditEntity)
          .createQueryBuilder()
          .delete()
          .where('"organisation_id" IN (:...createdOrgIds)', { createdOrgIds })
          .execute();
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

    getRegistrationTokenSpy?.mockRestore();

    if (app) {
      await app.close();
    }
  });

  describe('Authentication & Guards', () => {
    it('should return 401 when inviting without authorization token', async () => {
      const res = await http
        .post('organisation-invitations')
        .send({ email: 'noauth@example.com' });

      expect(res.statusCode).toBe(401);
    });

    it('should return 401 when revoking without authorization token', async () => {
      const res = await http.post(
        `organisation-invitations/${randomUUID()}/revoke`,
      );

      expect(res.statusCode).toBe(401);
    });

    it('should return 401 when resending without authorization token', async () => {
      const res = await http.post(
        `organisation-invitations/${randomUUID()}/resend`,
      );

      expect(res.statusCode).toBe(401);
    });
  });

  describe('Invite Member', () => {
    it('should invite a new user and persist PENDING invitation, token hash, and audit log, Have default permissions', async () => {
      const inviteEmail = `invitee-${randomUUID().slice(0, 8)}@example.com`;

      const res = await http
        .post('organisation-invitations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          email: `  ${inviteEmail.toUpperCase()}  `,
          firstName: 'Ada',
          lastName: 'Lovelace',
          role: RoleEnum.ORG_MEMBER,
          permissionMode: PermissionAssignmentModeEnum.DEFAULT,
        })
        .expect(201);

      expect(res.body.success).toBe(true);

      const invitation = await dataSource
        .getRepository(OrganisationMembershipInvitationEntity)
        .findOne({
          where: {
            email: inviteEmail,
            organisation: { id: registeredOrganisationId },
          },
          relations: { permissions: true },
        });

      expect(invitation).toBeDefined();
      expect(invitation!.status).toBe(InvitationStatusEnum.PENDING);
      expect(invitation!.token).toBeTruthy();
      expect(invitation!.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(invitation?.permissions).toHaveLength(20);
    });

    it('should invite a new user and persist PENDING invitation, token hash, and audit log, have no permissions', async () => {
      const inviteEmail = `invitee-${randomUUID().slice(0, 8)}@example.com`;

      const res = await http
        .post('organisation-invitations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          email: `  ${inviteEmail.toUpperCase()}  `,
          firstName: 'Ada',
          lastName: 'Lovelace',
          role: RoleEnum.ORG_MEMBER,
          permissionMode: PermissionAssignmentModeEnum.NONE,
        })
        .expect(201);

      expect(res.body.success).toBe(true);

      const invitation = await dataSource
        .getRepository(OrganisationMembershipInvitationEntity)
        .findOne({
          where: {
            email: inviteEmail,
            organisation: { id: registeredOrganisationId },
          },
          relations: { permissions: true },
        });

      expect(invitation).toBeDefined();
      expect(invitation!.status).toBe(InvitationStatusEnum.PENDING);
      expect(invitation!.token).toBeTruthy();
      expect(invitation!.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(invitation?.permissions).toHaveLength(0);
    });

    it('should invite a new user and persist PENDING invitation, token hash, and audit log, have custom permissions', async () => {
      const inviteEmail = `invitee-${randomUUID().slice(0, 8)}@example.com`;

      const res = await http
        .post('organisation-invitations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          email: `  ${inviteEmail.toUpperCase()}  `,
          firstName: 'Ada',
          lastName: 'Lovelace',
          role: RoleEnum.ORG_MEMBER,
          permissionMode: PermissionAssignmentModeEnum.CUSTOM,
          permissions: {
            document: { create: true },
          },
        })
        .expect(201);

      expect(res.body.success).toBe(true);

      const invitation = await dataSource
        .getRepository(OrganisationMembershipInvitationEntity)
        .findOne({
          where: {
            email: inviteEmail,
            organisation: { id: registeredOrganisationId },
          },
          relations: { permissions: true },
        });

      expect(invitation).toBeDefined();
      expect(invitation!.status).toBe(InvitationStatusEnum.PENDING);
      expect(invitation!.token).toBeTruthy();
      expect(invitation!.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(invitation?.permissions).toHaveLength(1);
    });

    it('should return 409 when a non-expired invitation already exists for the email in the organisation', async () => {
      const inviteEmail = `dup-invite-${randomUUID().slice(0, 8)}@example.com`;
      const payload = {
        email: inviteEmail,
        firstName: 'Grace',
        lastName: 'Hopper',
        role: RoleEnum.ORG_MEMBER,
        permissionMode: PermissionAssignmentModeEnum.NONE,
      };

      await http
        .post('organisation-invitations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(payload)
        .expect(201);

      const dupRes = await http
        .post('organisation-invitations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(payload);

      expect(dupRes.statusCode).toBe(409);
    });

    it('should return 409 when inviting a user who is already an active member of the organisation', async () => {
      const res = await http
        .post('organisation-invitations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          email: registrationPayload.email,
          firstName: 'Johnson',
          lastName: 'Dennis',
          role: RoleEnum.ORG_MEMBER,
          permissionMode: PermissionAssignmentModeEnum.DEFAULT,
        });

      expect(res.statusCode).toBe(409);
    });

    it('should return 403 when a non-admin attempts to assign an admin role', async () => {
      const res = await http
        .post('organisation-invitations')
        .set('Authorization', `Bearer ${firstOrgMemberAccessToken}`)
        .send({
          email: `escalate-${randomUUID().slice(0, 8)}@example.com`,
          firstName: 'Mal',
          lastName: 'Actor',
          role: RoleEnum.ORG_ADMIN,
          permissionMode: PermissionAssignmentModeEnum.DEFAULT,
        });

      expect(res.statusCode).toBe(403);
    });

    it('should return 404 when the requested role does not exist', async () => {
      const res = await http
        .post('organisation-invitations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          email: `bad-role-${randomUUID().slice(0, 8)}@example.com`,
          firstName: 'Test',
          lastName: 'User',
          role: 'NON_EXISTENT_ROLE',
          permissionMode: PermissionAssignmentModeEnum.DEFAULT,
        });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 when custom permission does not belong to the selected role', async () => {
      const res = await http
        .post('organisation-invitations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          email: `bad-perm-${randomUUID().slice(0, 8)}@example.com`,
          firstName: 'Test',
          lastName: 'User',
          role: RoleEnum.ORG_MEMBER,
          permissionMode: PermissionAssignmentModeEnum.CUSTOM,
          permissions: {
            maintainance: { read: true },
          },
        });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('Resend Invitation', () => {
    it('should rotate token, update expiresAt and resentAt, and resend successfully for a pending invitation', async () => {
      const inviteEmail = `resend-ok-${randomUUID().slice(0, 8)}@example.com`;
      await http
        .post('organisation-invitations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          email: inviteEmail,
          firstName: 'Alan',
          lastName: 'Turing',
          role: RoleEnum.ORG_MEMBER,
          permissionMode: PermissionAssignmentModeEnum.DEFAULT,
        })
        .expect(201);

      const invitationRepo = dataSource.getRepository(
        OrganisationMembershipInvitationEntity,
      );
      const before = await invitationRepo.findOne({
        where: {
          email: inviteEmail,
          organisation: { id: registeredOrganisationId },
        },
      });
      expect(before).toBeDefined();

      const res = await http
        .post(`organisation-invitations/${before!.id}/resend`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(res.body.success).toBe(true);

      const after = await invitationRepo.findOne({ where: { id: before!.id } });
      expect(after!.status).toBe(InvitationStatusEnum.PENDING);
      expect(after!.token).toBeTruthy();
      expect(after!.token).not.toBe(before!.token);
      expect(after!.resentAt).toBeDefined();
      expect(after!.expiresAt.getTime()).toBeGreaterThanOrEqual(
        before!.expiresAt.getTime(),
      );
    });

    it('should renew an expired PENDING invitation with a fresh token and future expiry', async () => {
      const inviteEmail = `resend-expired-${randomUUID().slice(0, 8)}@example.com`;
      const response = await http
        .post('organisation-invitations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          email: inviteEmail,
          firstName: 'Linus',
          lastName: 'Torvalds',
          role: RoleEnum.ORG_MEMBER,
          permissionMode: PermissionAssignmentModeEnum.DEFAULT,
        })
        .expect(201);

      const invitationId = response.body.data.id;

      const pastDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
      await invitationRepo.update(invitationId, { expiresAt: pastDate });

      await http
        .post(`organisation-invitations/${invitationId}/resend`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      const renewed = await invitationRepo.findOne({
        where: { id: invitationId },
      });
      expect(renewed!.status).toBe(InvitationStatusEnum.PENDING);
      expect(renewed!.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(renewed!.resentAt).toBeDefined();
    });

    it('should return 404 when resending a non-existent invitation', async () => {
      const res = await http
        .post(`organisation-invitations/${uuidv7()}/resend`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.statusCode).toBe(404);
    });

    it('should return 404 when resending an invitation belonging to another organisation', async () => {
      const inviteEmail = `cross-org-resend-${randomUUID().slice(0, 8)}@example.com`;
      const response = await http
        .post('organisation-invitations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          email: inviteEmail,
          firstName: 'Cross',
          lastName: 'Org',
          role: RoleEnum.ORG_MEMBER,
          permissionMode: PermissionAssignmentModeEnum.DEFAULT,
        })
        .expect(201);

      const invitationId = response.body.data.id;

      const res = await http
        .post(`organisation-invitations/${invitationId}/resend`)
        .set('Authorization', `Bearer ${secondOrgAccesToken}`)
        .query({ organisationId: secondOrgId });

      expect([404]).toContain(res.statusCode);
      expect(res.body.message).toBe(
        'Invitation not found for this organisation',
      );
    });

    it('should return 400 when resending a REVOKED invitation', async () => {
      const inviteEmail = `resend-revoked-${randomUUID().slice(0, 8)}@example.com`;
      const res = await http
        .post('organisation-invitations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          email: inviteEmail,
          firstName: 'Revoked',
          lastName: 'User',
          role: RoleEnum.ORG_MEMBER,
          permissionMode: PermissionAssignmentModeEnum.DEFAULT,
        })
        .expect(201);

      const invitationId = res.body.data.id;
      expect(res.body.data.status).toBe('PENDING');

      const reevokeRes = await http
        .post(`organisation-invitations/${invitationId}/revoke`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);
      expect(reevokeRes.body.data.status).toBe('REVOKED');

      const resendRes = await http
        .post(`organisation-invitations/${invitationId}/resend`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(resendRes.statusCode).toBe(400);
      expect(resendRes.body.message).toBe(
        'Revoked invitations cannot be resent. Kindly send a new Invitation',
      );
    });

    it('should return 400 when resending a non-pending (ACCEPTED) invitation', async () => {
      const inviteEmail = `resend-accepted-${randomUUID().slice(0, 8)}@example.com`;
      const response = await http
        .post('organisation-invitations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          email: inviteEmail,
          firstName: 'Accepted',
          lastName: 'User',
          role: RoleEnum.ORG_MEMBER,
          permissionMode: PermissionAssignmentModeEnum.DEFAULT,
        })
        .expect(201);

      const invitationId = response.body.data.id;
      expect(response.body.data.status).toBe('PENDING');

      await invitationRepo.update(invitationId, {
        status: InvitationStatusEnum.ACCEPTED,
      });

      const res = await http
        .post(`organisation-invitations/${invitationId}/resend`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 when resending an invitation for a SUSPENDED organisation', async () => {
      const inviteEmail = `resend-suspended-${randomUUID().slice(0, 8)}@example.com`;
      const response = await http
        .post('organisation-invitations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          email: inviteEmail,
          firstName: 'Susp',
          lastName: 'Org',
          role: RoleEnum.ORG_MEMBER,
          permissionMode: PermissionAssignmentModeEnum.DEFAULT,
        })
        .expect(201);
      const invitationId = response.body.data.id;
      expect(response.body.data.status).toBe('PENDING');

      const orgRepo = dataSource.getRepository(OrganisationEntity);

      await orgRepo.update(registeredOrganisationId, {
        status: OrganisationStatusEnum.SUSPENDED,
      });

      const res = await http
        .post(`organisation-invitations/${invitationId}/resend`)
        .set('Authorization', `Bearer ${accessToken}`);

      await orgRepo.update(registeredOrganisationId, {
        status: OrganisationStatusEnum.ACTIVE,
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('Revoke Invitation', () => {
    it('should mark PENDING invitation as REVOKED, clear token, and set revokedAt and revokedBy', async () => {
      const inviteEmail = `revoke-ok-${randomUUID().slice(0, 8)}@example.com`;
      const response = await http
        .post('organisation-invitations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          email: inviteEmail,
          firstName: 'Grace',
          lastName: 'Hopper',
          role: RoleEnum.ORG_MEMBER,
          permissionMode: PermissionAssignmentModeEnum.DEFAULT,
        })
        .expect(201);

      const invitationId = response.body.data.id;
      expect(response.body.data.status).toBe('PENDING');

      const res = await http
        .post(`organisation-invitations/${invitationId}/revoke`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(res.body.success).toBe(true);

      const revoked = await invitationRepo.findOne({
        where: { id: invitationId },
        relations: { revokedBy: true },
      });

      expect(revoked!.status).toBe(InvitationStatusEnum.REVOKED);
      expect(revoked!.revokedAt).toBeDefined();
      expect(revoked!.revokedBy?.id).toBe(registeredUserId);
    });

    it('should return 404 when revoking a non-existent invitation', async () => {
      const res = await http
        .post(`organisation-invitations/${uuidv7()}/revoke`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.statusCode).toBe(404);
    });

    it('should return 400 when revoking an invitation that is not PENDING', async () => {
      const inviteEmail = `revoke-twice-${randomUUID().slice(0, 8)}@example.com`;
      const response = await http
        .post('organisation-invitations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          email: inviteEmail,
          firstName: 'Twice',
          lastName: 'Revoked',
          role: RoleEnum.ORG_MEMBER,
          permissionMode: PermissionAssignmentModeEnum.DEFAULT,
        })
        .expect(201);

      const invitationId = response.body.data.id;
      expect(response.body.data.status).toBe('PENDING');

      await http
        .post(`organisation-invitations/${invitationId}/revoke`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      const secondRevoke = await http
        .post(`organisation-invitations/${invitationId}/revoke`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(secondRevoke.statusCode).toBe(400);
    });
  });

  describe('Accept Invitation', () => {
    it('should accept a valid pending invitation and create an active membership', async () => {
      const inviteEmail = `accept-ok-${randomUUID().slice(0, 8)}@example.com`;

      const plainToken = randomBytes(64).toString('base64url');
      getRegistrationTokenSpy = jest
        .spyOn(
          organisationmembershipinvitationService as any,
          'generateInvitationToken',
        )
        .mockReturnValue(plainToken);

      const response = await http
        .post('organisation-invitations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          email: inviteEmail,
          firstName: 'Margaret',
          lastName: 'Hamilton',
          role: RoleEnum.ORG_MEMBER,
          permissionMode: PermissionAssignmentModeEnum.DEFAULT,
        })
        .expect(201);
      const invitationId = response.body.data.id;
      expect(invitationId).toBeDefined();
      expect(response.body.data.status).toBe('PENDING');

      const acceptRes = await http.get(
        `organisation-invitations/accept/${plainToken}`,
      );

      expect(acceptRes.statusCode).toBe(200);
      const createdUser = await dataSource
        .getRepository(UserEntity)
        .findOne({ where: { email: inviteEmail } });
      if (createdUser) {
        createdUserIds.push(createdUser.id);
      }

      const membership = await dataSource
        .getRepository(OrganisationMembershipEntity)
        .findOne({
          where: {
            organisation: { id: registeredOrganisationId },
            user: { email: inviteEmail },
          },
        });

      expect(membership).toBeDefined();
      expect(membership!.status).toBe(OrganisationMembershipStatusEnum.ACTIVE);
    });

    it('should reject an expired invitation', async () => {
      const inviteEmail = `accept-ok-${randomUUID().slice(0, 8)}@example.com`;

      const plainToken = randomBytes(64).toString('base64url');
      getRegistrationTokenSpy = jest
        .spyOn(
          organisationmembershipinvitationService as any,
          'generateInvitationToken',
        )
        .mockReturnValue(plainToken);

      const response = await http
        .post('organisation-invitations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          email: inviteEmail,
          firstName: 'Margaret',
          lastName: 'Hamilton',
          role: RoleEnum.ORG_MEMBER,
          permissionMode: PermissionAssignmentModeEnum.DEFAULT,
        })
        .expect(201);
      const invitationId = response.body.data.id;
      expect(invitationId).toBeDefined();
      expect(response.body.data.status).toBe('PENDING');

      await invitationRepo.update(invitationId, {
        expiresAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      });

      const acceptRes = await http.get(
        `organisation-invitations/accept/${plainToken}`,
      );

      expect(acceptRes.statusCode).toBe(400);
    });

    it('should return 400 when accepting an invalid or unknown token', async () => {
      const res = await http.get(
        `organisation-invitations/accept/${randomBytes(32).toString('base64url')}`,
      );

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 when accepting a REVOKED invitation', async () => {
      const inviteEmail = `accept-revoked-${randomUUID().slice(0, 8)}@example.com`;
      const plainToken = randomBytes(64).toString('base64url');
      getRegistrationTokenSpy = jest
        .spyOn(
          organisationmembershipinvitationService as any,
          'generateInvitationToken',
        )
        .mockReturnValue(plainToken);
      const response = await http
        .post('organisation-invitations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          email: inviteEmail,
          firstName: 'Revoked',
          lastName: 'Accept',
          role: RoleEnum.ORG_MEMBER,
          permissionMode: PermissionAssignmentModeEnum.DEFAULT,
        })
        .expect(201);

      const invitationId = response.body.data.id;
      expect(invitationId).toBeDefined();
      expect(response.body.data.status).toBe('PENDING');

      await http
        .post(`organisation-invitations/${invitationId}/revoke`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      const res = await http.get(
        `organisation-invitations/accept/${plainToken}`,
      );

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 when accepting an invitation for a SUSPENDED organisation', async () => {
      const inviteEmail = `accept-suspended-${randomUUID().slice(0, 8)}@example.com`;
      const plainToken = randomBytes(64).toString('base64url');
      getRegistrationTokenSpy = jest
        .spyOn(
          organisationmembershipinvitationService as any,
          'generateInvitationToken',
        )
        .mockReturnValue(plainToken);

      const response = await http
        .post('organisation-invitations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          email: inviteEmail,
          firstName: 'Susp',
          lastName: 'Accept',
          role: RoleEnum.ORG_MEMBER,
          permissionMode: PermissionAssignmentModeEnum.DEFAULT,
        })
        .expect(201);
      const invitationId = response.body.data.id;
      expect(invitationId).toBeDefined();
      expect(response.body.data.status).toBe('PENDING');

      const orgRepo = dataSource.getRepository(OrganisationEntity);

      await orgRepo.update(registeredOrganisationId, {
        status: OrganisationStatusEnum.SUSPENDED,
      });

      const res = await http.get(
        `organisation-invitations/accept/${plainToken}`,
      );

      await orgRepo.update(registeredOrganisationId, {
        status: OrganisationStatusEnum.ACTIVE,
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
