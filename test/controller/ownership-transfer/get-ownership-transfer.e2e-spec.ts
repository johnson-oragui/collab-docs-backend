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
import { RoleEntity } from '@/roles/roles.entity';
import { OrganisationOwnershipHistoryEntity } from '@/organisation-ownership-history/organisation-ownership-history.entity';
import { OrganisationAuditEntity } from '@/organisation_audit/organisation_audit.entity';
import { UserSessionEntity } from '@/user_sessions/user-session.entity';
import { UserSessionTokenEntity } from '@/user-session-token/user-session-token.entity';
import { EmailVerificationService } from '@/email-verification/email-verification.service';
import {
  OrganisationMembershipStatusEnum,
  RoleEnum,
  TRoleEnum,
} from '@/database/database.enums';
import { PasswordService } from '@/password/password.service';

describe('Organisation Ownership & History Endpoints (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof createHttpClient>;
  let dataSource: DataSource;
  let emailVerificationService: EmailVerificationService;
  let passwordService: PasswordService;

  let ownerAccessToken: string;
  let ownerUserId: string;
  let ownerEmail: string;
  let ownerOrgId: string;
  let password: string;
  let getTokenSpy: jest.SpyInstance;

  let secondOrgAccessToken: string;
  let secondOrgId: string;

  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];

  const ownershipUrl = 'organisation-ownership';

  const createRegistrationPayload = (prefix = 'own-read') => {
    const uniqueId = randomUUID().replace(/-/g, '');
    return {
      email: `${prefix}-${uniqueId}@example.com`,
      password: 'StrongPassword123#',
      confirmPassword: 'StrongPassword123#',
      acceptTerms: true,
      firstname: 'Grace',
      lastname: 'Hopper',
      organisationName: `Ownership Read Org ${uniqueId}`,
      organisationDescription: 'Ownership read & history E2E test org.',
      organisationEmail: `own-read-org-${uniqueId}@example.com`,
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
      email: payload.email,
      orgId,
      password: payload.password,
      accessToken: loginRes.body.data.accessToken as string,
    };
  };

  const createMemberInOrg = async (
    orgId: string,
    roleName: TRoleEnum,
    sharedPassword: string,
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

    const email = `own-hist-member-${randomUUID().slice(0, 8)}@example.com`;
    const user = await userRepo.save(
      userRepo.create({
        email,
        firstName: 'Johnson',
        lastName: 'rnijmewko',
        password: await passwordService.hash(sharedPassword),
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

    return { userId: user.id, email, membershipId: membership.id };
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

    const ownerPayload = createRegistrationPayload('own-read-owner');
    const regRes = await http
      .post('/api/v1/auth/register')
      .send(ownerPayload)
      .expect(201);

    ownerUserId = regRes.body.data.user.id;
    ownerEmail = ownerPayload.email;
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

    const secondOrg = await registerVerifyAndLogin('own-read-second');
    secondOrgId = secondOrg.orgId;
    secondOrgAccessToken = secondOrg.accessToken;
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
            .getRepository(MembershipPermissionEntity)
            .createQueryBuilder()
            .delete()
            .where('"membership_id" IN (:...membershipIds)', { membershipIds })
            .execute();
        }

        await dataSource
          .getRepository(OrganisationOwnershipHistoryEntity)
          .createQueryBuilder()
          .delete()
          .where(
            '"previous_owner_id" IN (:...userIds) OR "new_owner_id" IN (:...userIds)',
            { userIds: createdUserIds },
          )
          .execute();

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
          .getRepository(OrganisationAuditEntity)
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

  describe('GET /api/v1/organisation-ownership', () => {
    it('should return 401 when unauthenticated', async () => {
      const res = await http.get(ownershipUrl);
      expect(res.statusCode).toBe(401);
    });

    it('should return current owner and creator fields without sensitive columns', async () => {
      const res = await http
        .get(ownershipUrl)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data?.organisationId).toBe(ownerOrgId);
      expect(res.body.data?.owner).toMatchObject({
        id: ownerUserId,
        email: ownerEmail,
      });
      expect(res.body.data?.creator).toMatchObject({
        id: ownerUserId,
        email: ownerEmail,
      });
      expect(res.body.data?.owner?.password).toBeUndefined();
      expect(res.body.data?.creator?.password).toBeUndefined();
    });

    it('should remain scoped to each caller organisation', async () => {
      const member = await createMemberInOrg(
        ownerOrgId,
        RoleEnum.ORG_MEMBER,
        password,
      );

      const secondOrgRes = await http
        .get(ownershipUrl)
        .set('Authorization', `Bearer ${secondOrgAccessToken}`)
        .expect(200);

      expect(secondOrgRes.body.data?.organisationId).toBe(secondOrgId);
      expect(secondOrgRes.body.data?.owner?.id).not.toBe(member.userId);
    });
  });
});
