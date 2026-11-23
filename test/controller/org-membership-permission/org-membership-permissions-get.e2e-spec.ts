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
  TRoleEnum,
} from '@/database/database.enums';
import { OrganisationMembershipSuspensionHistoryEntity } from '@/org_membership_suspension_histories/org_membership_suspension_histories.entity';
import { uuidv7 } from 'uuidv7';
import { PasswordService } from '@/password/password.service';
import { snakeCaseToCamelcase } from '@/commons/util/snakeCaseToCamelcase';

describe('Get Membership Permissions (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof createHttpClient>;
  let dataSource: DataSource;
  let emailVerificationService: EmailVerificationService;
  let passwordService: PasswordService;

  let ownerAccessToken: string;
  let ownerOrgId: string;
  let passwordHash: string;
  let getTokenSpy: jest.SpyInstance;

  let emptyMembershipId: string;
  let grantedMembershipId: string;
  let grantedPermissionName: string;

  let secondOrgAccessToken: string;

  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];

  const createRegistrationPayload = (prefix = 'get-perm') => {
    const uniqueId = randomUUID().replace(/-/g, '');
    return {
      email: `${prefix}-${uniqueId}@example.com`,
      password: 'StrongPassword123#',
      confirmPassword: 'StrongPassword123#',
      acceptTerms: true,
      firstname: 'Linus',
      lastname: 'Torvalds',
      organisationName: `GetPerm Org ${uniqueId}`,
      organisationDescription: 'Get membership permissions E2E test org.',
      organisationEmail: `getperm-org-${uniqueId}@example.com`,
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
      passwordHash: regRes.body.data.user.passwordHash as string,
      accessToken: loginRes.body.data.accessToken as string,
    };
  };

  const createMemberInOrg = async (
    orgId: string,
    roleName: TRoleEnum,
    sharedPasswordHash: string,
  ) => {
    const userRepo = dataSource.getRepository(UserEntity);
    const membershipRepo = dataSource.getRepository(
      OrganisationMembershipEntity,
    );
    const roleRepo = dataSource.getRepository(RoleEntity);

    const role = await roleRepo.findOne({ where: { name: roleName } });
    if (!role) {
      throw new Error(`Role ${roleName} not seeded in test database`);
    }

    const email = `getperm-member-${randomUUID().slice(0, 8)}@example.com`;
    const user = await userRepo.save(
      userRepo.create({
        email,
        firstName: 'Test',
        lastName: 'User',
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
        status: OrganisationMembershipStatusEnum.ACTIVE,
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

    const ownerPayload = createRegistrationPayload('get-perm-owner');
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

    const emptyMember = await createMemberInOrg(
      ownerOrgId,
      RoleEnum.ORG_MEMBER,
      ownerPayload.password,
    );
    emptyMembershipId = emptyMember.membershipId;

    const grantedMember = await createMemberInOrg(
      ownerOrgId,
      RoleEnum.ORG_MEMBER,
      ownerPayload.password,
    );
    grantedMembershipId = grantedMember.membershipId;

    const permission = await dataSource
      .getRepository(PermissionEntity)
      .findOne({ where: {} });
    if (!permission) {
      throw new Error('No PermissionEntity rows seeded in test database');
    }
    grantedPermissionName = permission.name;

    await dataSource.getRepository(MembershipPermissionEntity).save(
      dataSource.getRepository(MembershipPermissionEntity).create({
        membership: { id: grantedMembershipId } as OrganisationMembershipEntity,
        permission: { id: permission.id } as PermissionEntity,
      }),
    );

    const secondAccount = await registerVerifyAndLogin('get-perm-other');
    secondOrgAccessToken = secondAccount.accessToken;
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

  describe('Guards & Validation', () => {
    it('should return 401 when no bearer token is provided', async () => {
      const res = await http.get(
        `organisation-memberships/${emptyMembershipId}`,
      );
      expect(res.statusCode).toBe(401);
    });

    it('should return 400 for a non-UUID membershipId param', async () => {
      const res = await http
        .get('organisation-memberships/not-a-valid-uuid')
        .set('Authorization', `Bearer ${ownerAccessToken}`);

      expect(res.statusCode).toBe(400);
    });
  });

  describe('Retrieving Membership Permissions', () => {
    it('should return empty data object when membership has no custom permissions', async () => {
      const res = await http
        .get(`organisation-memberships/${emptyMembershipId}`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Permissions retrieved successfully');
      expect(res.body.data).toEqual({});
    });

    it('should return grouped permissions when membership has assigned permissions', async () => {
      const res = await http
        .get(`organisation-memberships/${grantedMembershipId}`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Permissions retrieved successfully');

      const [category, action] = grantedPermissionName.split(':');
      expect(res.body.data?.[snakeCaseToCamelcase(category)]?.[action]).toBe(
        true,
      );
    });

    it('should return 404 when membershipId does not exist', async () => {
      const nonExistentId = uuidv7();
      const res = await http
        .get(`organisation-memberships/${nonExistentId}`)
        .set('Authorization', `Bearer ${ownerAccessToken}`);

      expect(res.statusCode).toBe(404);
    });

    it('should reject access from another organisation', async () => {
      const res = await http
        .get(`organisation-memberships/${grantedMembershipId}`)
        .set('Authorization', `Bearer ${secondOrgAccessToken}`);

      expect(res.statusCode).toBe(404);
    });
  });
});
