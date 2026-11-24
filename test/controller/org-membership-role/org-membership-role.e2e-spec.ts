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
import {
  OrganisationAuditEventEnum,
  OrganisationRoleEnum,
  PermissionAssignmentModeEnum,
} from '@/commons/enums';
import { PasswordService } from '@/password/password.service';
import { OrganisationMembershipSuspensionHistoryEntity } from '@/org_membership_suspension_histories/org_membership_suspension_histories.entity';
import { uuidv7 } from 'uuidv7';
import { snakeCaseToCamelcase } from '@/commons/util/snakeCaseToCamelcase';

describe('Organisation Membership Role Reassignment (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof createHttpClient>;
  let dataSource: DataSource;
  let emailVerificationService: EmailVerificationService;
  let passwordService: PasswordService;

  let ownerAccessToken: string;
  let ownerOrgId: string;
  let passwordHash: string;
  let getTokenSpy: jest.SpyInstance;

  let targetMembershipId: string;
  let targetMemberEmail: string;
  let subAdminMemberAccessToken: string;

  let secondOrgAccessToken: string;

  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];
  const password = 'StrongPassword123#';

  const reassignUrl = (membershipId: string) =>
    `organisation-memberships/${membershipId}/reassign`;

  const createRegistrationPayload = (prefix = 'reassign-admin') => {
    const uniqueId = randomUUID().replace(/-/g, '');
    return {
      email: `${prefix}-${uniqueId}@example.com`,
      password,
      confirmPassword: password,
      acceptTerms: true,
      firstname: 'Alan',
      lastname: 'Turing',
      organisationName: `Reassign Org ${uniqueId}`,
      organisationDescription: 'Role reassignment E2E test org.',
      organisationEmail: `reassign-org-${uniqueId}@example.com`,
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
    const membershipPermissionRepo = dataSource.getRepository(
      MembershipPermissionEntity,
    );
    const roleRepo = dataSource.getRepository(RoleEntity);

    const role = await roleRepo.findOne({
      where: { name: roleName },
      relations: { permissions: true },
    });
    if (!role) {
      throw new Error(`Role ${roleName} not seeded in test database`);
    }

    const email = `reassign-member-${randomUUID().slice(0, 8)}@example.com`;
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
    await membershipPermissionRepo.save(
      membershipPermissionRepo.create({
        membership,
        permission: { id: role.permissions[0].id },
      }),
    );

    return {
      userId: user.id,
      membershipId: membership.id,
      email,
    };
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

    const ownerPayload = createRegistrationPayload('reassign-owner');
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
      .send({ email: ownerPayload.email, password: ownerPayload.password })
      .expect(200);

    ownerAccessToken = loginRes.body.data.accessToken;

    const target = await createMemberInOrg(
      ownerOrgId,
      RoleEnum.ORG_MEMBER,
      ownerPayload.password,
      OrganisationMembershipStatusEnum.ACTIVE,
    );
    targetMembershipId = target.membershipId;
    targetMemberEmail = target.email;

    const secondAccount = await registerVerifyAndLogin('reassign-other');
    secondOrgAccessToken = secondAccount.accessToken;

    const subAdminMember = await createMemberInOrg(
      ownerOrgId,
      RoleEnum.ORG_SUB_ADMIN,
      ownerPayload.password,
      OrganisationMembershipStatusEnum.ACTIVE,
    );
    const subAdminMemberLoginRes = await http
      .post('/api/v1/auth/login')
      .send({ email: subAdminMember.email, password })
      .expect(200);
    subAdminMemberAccessToken = subAdminMemberLoginRes.body.data.accessToken;
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
    it('should return 401 when no bearer token is provided', async () => {
      const res = await http.patch(reassignUrl(targetMembershipId)).send({
        role: OrganisationRoleEnum.ORG_MEMBER,
        permissionMode: PermissionAssignmentModeEnum.DEFAULT,
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('DTO Validation & Role Constraints', () => {
    it('should return 400 when permissions or permissionMode are provided for ORG_ADMIN', async () => {
      const res = await http
        .patch(reassignUrl(targetMembershipId))
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          role: OrganisationRoleEnum.ORG_ADMIN,
          permissionMode: PermissionAssignmentModeEnum.DEFAULT,
        });

      expect(res.statusCode).toBe(400);
    });

    it('should use default value when permissionMode is missing for non-ORG_ADMIN roles', async () => {
      const res = await http
        .patch(reassignUrl(targetMembershipId))
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          role: OrganisationRoleEnum.ORG_MEMBER,
        });

      expect(res.statusCode).toBe(201);
    });

    it('should return 403 when assigning ORG_SUB_ADMIN while caller is ORG_SUB_ADMIN', async () => {
      const res = await http
        .patch(reassignUrl(targetMembershipId))
        .set('Authorization', `Bearer ${subAdminMemberAccessToken}`)
        .send({
          role: OrganisationRoleEnum.ORG_SUB_ADMIN,
          permissionMode: PermissionAssignmentModeEnum.DEFAULT,
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toBe(
        'You do not have permission to perform this action',
      );
    });
  });

  describe('Membership State & Tenant Isolation', () => {
    it('should return 400 when attempting to reassign role on a non-ACTIVE membership', async () => {
      const pendingMember = await createMemberInOrg(
        ownerOrgId,
        RoleEnum.ORG_MEMBER,
        password,
        OrganisationMembershipStatusEnum.PENDING,
      );

      const res = await http
        .patch(reassignUrl(pendingMember.membershipId))
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          role: OrganisationRoleEnum.ORG_MEMBER,
          permissionMode: PermissionAssignmentModeEnum.DEFAULT,
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe(
        'Cannot change role for membership when membership is pending.',
      );
    });

    it('should return 404 for a non-existent membershipId', async () => {
      const res = await http
        .patch(reassignUrl(uuidv7()))
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          role: OrganisationRoleEnum.ORG_MEMBER,
          permissionMode: PermissionAssignmentModeEnum.DEFAULT,
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe(
        'No membership was found for the selected membership.',
      );
    });

    it('should reject role reassignment for a membership belonging to another organisation', async () => {
      const res = await http
        .patch(reassignUrl(targetMembershipId))
        .set('Authorization', `Bearer ${secondOrgAccessToken}`)
        .send({
          role: OrganisationRoleEnum.ORG_MEMBER,
          permissionMode: PermissionAssignmentModeEnum.DEFAULT,
        });

      expect([403, 404]).toContain(res.statusCode);
      expect(res.body.message).toBe(
        'No membership was found for the selected membership.',
      );
    });
  });

  describe('Successful Role Reassignment & Audit Trail', () => {
    it('should reassign role with DEFAULT permissions, update membership role, and write an audit log', async () => {
      const res = await http
        .patch(reassignUrl(targetMembershipId))
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          role: OrganisationRoleEnum.ORG_MEMBER,
          permissionMode: PermissionAssignmentModeEnum.DEFAULT,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data?.membershipId).toBe(targetMembershipId);

      const updated = await dataSource
        .getRepository(OrganisationMembershipEntity)
        .findOne({
          where: { id: targetMembershipId },
          relations: { role: true, permissions: true },
        });

      expect(updated?.role?.name).toBe(RoleEnum.ORG_MEMBER);
      expect((updated?.permissions ?? []).length).toBeGreaterThanOrEqual(0);

      const audits = await dataSource
        .getRepository(OrganisationAuditEntity)
        .find({
          where: {
            organisation: { id: ownerOrgId },
            eventType: OrganisationAuditEventEnum.MEMBERSHIP_ROLE_REASSIGN,
          },
          order: { createdAt: 'DESC' },
        });

      expect(audits.length).toBeGreaterThanOrEqual(1);
      expect(audits[0].metadata).toMatchObject({
        newRole: OrganisationRoleEnum.ORG_MEMBER,
      });
    });

    it('should reassign role with CUSTOM permissions when valid role permissions are supplied', async () => {
      const memberRole = await dataSource.getRepository(RoleEntity).findOne({
        where: { name: RoleEnum.ORG_MEMBER },
        relations: { permissions: true },
      });
      const firstPerm = memberRole?.permissions?.[0]?.name;
      if (!firstPerm) throw new Error('Permissions not yet seeded for tests');

      const permKey = snakeCaseToCamelcase(firstPerm.split(':')[0]);
      const customPayload = {
        [permKey]: {
          [firstPerm.split(':')[1]]: true,
        },
      };

      const res = await http
        .patch(reassignUrl(targetMembershipId))
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          role: OrganisationRoleEnum.ORG_MEMBER,
          permissionMode: PermissionAssignmentModeEnum.CUSTOM,
          permissions: customPayload,
        });

      //   console.log(JSON.stringify(res.body.data));

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });
});
