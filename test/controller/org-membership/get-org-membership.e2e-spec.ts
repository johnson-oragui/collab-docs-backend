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
import { PasswordService } from '@/password/password.service';
import { OrganisationMembershipSuspensionHistoryEntity } from '@/org_membership_suspension_histories/org_membership_suspension_histories.entity';
import { generateRandomIPv4 } from '@/commons/util/generateRandomIPv4';
import { runGraphql } from '@/test/fixtures/run-graphql';

const GET_ORGANISATION_MEMBERSHIPS_QUERY = `
  query GetOrganisationMemberships($filter: GetOrganisationMembershipsInput) {
    getOrganisationMemberships(filter: $filter) {
      success
      message
      data {
        id
        status
        suspendedTill
        user {
          id
          email
          firstName
          lastName
        }
        role {
          name
        }
        suspensionHistories {
          suspendedTill
          status
          suspendedAt
          action
          actor {
            id
            email
            firstName
            lastName
          }
          reason
        }
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

describe('Organisation-Memberships Query (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof createHttpClient>;
  let dataSource: DataSource;
  let emailVerificationService: EmailVerificationService;
  let passwordService: PasswordService;

  let ownerPayload: ReturnType<typeof createRegistrationPayload>;
  let ownerUserId: string;
  let ownerOrgId: string;
  let ownerAccessToken: string;
  let passwordHash: string;
  let getTokenSpy: jest.SpyInstance;

  let suspendedMember: {
    userId: string;
    membershipId: string;
    email: string;
    suspendedTill: Date;
  };
  let pendingMember: {
    userId: string;
    membershipId: string;
    email: string;
  };
  let activeMember: {
    userId: string;
    membershipId: string;
    email: string;
  };

  let secondOrgId: string;
  let secondOrgAccessToken: string;

  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];

  const createRegistrationPayload = (prefix = 'query-org') => {
    const uniqueId = randomUUID().replace(/-/g, '');
    return {
      email: `${prefix}-${uniqueId}@example.com`,
      password: 'StrongPassword123#',
      confirmPassword: 'StrongPassword123#',
      acceptTerms: true,
      firstname: 'Grace',
      lastname: 'Hopper',
      organisationName: `Query Org ${uniqueId}`,
      organisationDescription: 'Organisation memberships query E2E test org.',
      organisationEmail: `query-org-${uniqueId}@example.com`,
    };
  };

  const registerVerifyAndLogin = async (prefix: string) => {
    const payload = createRegistrationPayload(prefix);
    const token = randomBytes(32).toString('base64url');
    getTokenSpy.mockReturnValueOnce(token);

    const regRes = await http
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', generateRandomIPv4())
      .send(payload)
      .expect(201);

    const userId: string = regRes.body.data.user.id;
    const orgId: string = regRes.body.data.organisation.id;
    createdUserIds.push(userId);
    createdOrgIds.push(orgId);

    await http.post('/api/v1/auth/verify-email').send({ token }).expect(201);

    const loginRes = await http
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', generateRandomIPv4())
      .send({ email: payload.email, password: payload.password })
      .expect(200);

    return {
      userId,
      orgId,
      email: payload.email,
      passwordHash: regRes.body.data.user.passwordHash as string,
      accessToken: loginRes.body.data.accessToken as string,
    };
  };

  const seedMembership = async (params: {
    orgId: string;
    roleName: TRoleEnum;
    status: TOrganisationMembershipStatusEnum;
    sharedPasswordHash: string;
    suspendedTill?: Date | null;
    emailPrefix: string;
  }) => {
    const userRepo = dataSource.getRepository(UserEntity);
    const membershipRepo = dataSource.getRepository(
      OrganisationMembershipEntity,
    );
    const roleRepo = dataSource.getRepository(RoleEntity);

    const role = await roleRepo.findOne({ where: { name: params.roleName } });
    if (!role) {
      throw new Error(`Role ${params.roleName} not seeded in test database`);
    }

    const email = `${params.emailPrefix}-${randomUUID().slice(0, 8)}@example.com`;
    const user = await userRepo.save(
      userRepo.create({
        email,
        firstName: 'Test',
        lastName: 'Member',
        password: await passwordService.hash(params.sharedPasswordHash),
        emailVerifiedAt: new Date(),
        isActive: true,
        acceptTerms: true,
      }),
    );
    createdUserIds.push(user.id);

    const membership = await membershipRepo.save(
      membershipRepo.create({
        user: { id: user.id } as UserEntity,
        organisation: { id: params.orgId } as OrganisationEntity,
        role,
        status: params.status,
        suspendedTill: params.suspendedTill ?? null,
      }),
    );

    return {
      userId: user.id,
      membershipId: membership.id,
      email,
      suspendedTill: params.suspendedTill ?? null,
    };
  };

  beforeAll(async () => {
    app = await createE2eApp();
    http = createHttpClient(app);
    dataSource = app.get(DataSource);
    emailVerificationService = app.get(EmailVerificationService);
    passwordService = app.get(PasswordService);

    ownerPayload = createRegistrationPayload('query-owner');
    const initialToken = randomBytes(32).toString('base64url');
    getTokenSpy = jest
      .spyOn(emailVerificationService as any, 'getToken')
      .mockReturnValue(initialToken);

    const regRes = await http
      .post('/api/v1/auth/register')
      .send(ownerPayload)
      .expect(201);

    ownerUserId = regRes.body.data.user.id;
    ownerOrgId = regRes.body.data.organisation.id;
    passwordHash = ownerPayload.password;
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

    const now = Date.now();
    const suspendedTillDate = new Date(now + 5 * 24 * 60 * 60 * 1000);

    const suspendedSeed = await seedMembership({
      orgId: ownerOrgId,
      roleName: RoleEnum.ORG_MEMBER,
      status: OrganisationMembershipStatusEnum.SUSPENDED,
      sharedPasswordHash: passwordHash,
      suspendedTill: suspendedTillDate,
      emailPrefix: 'suspended-member',
    });
    suspendedMember = {
      ...suspendedSeed,
      suspendedTill: suspendedTillDate,
    };

    pendingMember = await seedMembership({
      orgId: ownerOrgId,
      roleName: RoleEnum.ORG_MEMBER,
      status: OrganisationMembershipStatusEnum.PENDING,
      sharedPasswordHash: passwordHash,
      emailPrefix: 'pending-member',
    });

    activeMember = await seedMembership({
      orgId: ownerOrgId,
      roleName: RoleEnum.ORG_MEMBER,
      status: OrganisationMembershipStatusEnum.ACTIVE,
      sharedPasswordHash: passwordHash,
      emailPrefix: 'active-member',
    });

    const otherOrg = await registerVerifyAndLogin('query-other-org');
    secondOrgId = otherOrg.orgId;
    secondOrgAccessToken = otherOrg.accessToken;
    void secondOrgId;
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

  describe('Authentication & Tenant Isolation', () => {
    it('should reject unauthenticated requests', async () => {
      const res = await runGraphql(http, GET_ORGANISATION_MEMBERSHIPS_QUERY, {
        filter: { page: 1, limit: 10 },
      });

      const hasAuthError =
        res.statusCode === 401 || Boolean(res.body?.errors?.length);
      expect(hasAuthError).toBe(true);
    });

    it('should only return memberships belonging to the authenticated user organisation', async () => {
      const res = await runGraphql(
        http,
        GET_ORGANISATION_MEMBERSHIPS_QUERY,
        { filter: { id: activeMember.membershipId } },
        secondOrgAccessToken,
      );

      //   console.log(JSON.stringify(res.body));

      expect(res.statusCode).toBe(200);

      const payload = res.body?.data?.getOrganisationMemberships;
      if (payload) {
        expect(payload.data).toHaveLength(0);
      } else {
        expect(res.body?.errors?.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Filtering & Pagination', () => {
    it('should filter memberships by id', async () => {
      const res = await runGraphql(
        http,
        GET_ORGANISATION_MEMBERSHIPS_QUERY,
        { filter: { id: activeMember.membershipId } },
        ownerAccessToken,
      );
      // console.log(JSON.stringify(res.body));
      expect(res.statusCode).toBe(200);

      expect(res.body.errors).toBeUndefined();
      const result = res.body.data.getOrganisationMemberships;
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(activeMember.membershipId);
      expect(result.data[0].user.email).toBe(activeMember.email);
    });

    it('should filter memberships by memberEmail', async () => {
      const res = await runGraphql(
        http,
        GET_ORGANISATION_MEMBERSHIPS_QUERY,
        { filter: { memberEmail: pendingMember.email } },
        ownerAccessToken,
      );
      expect(res.statusCode).toBe(200);

      expect(res.body.errors).toBeUndefined();
      const result = res.body.data.getOrganisationMemberships;
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(pendingMember.membershipId);
      expect(result.data[0].status).toBe(
        OrganisationMembershipStatusEnum.PENDING,
      );
    });

    it('should filter memberships by status', async () => {
      const res = await runGraphql(
        http,
        GET_ORGANISATION_MEMBERSHIPS_QUERY,
        {
          filter: {
            status: OrganisationMembershipStatusEnum.SUSPENDED,
          },
        },
        ownerAccessToken,
      );
      expect(res.statusCode).toBe(200);

      expect(res.body.errors).toBeUndefined();
      const result = res.body.data.getOrganisationMemberships;
      expect(result.data.length).toBeGreaterThanOrEqual(1);
      expect(
        result.data.every(
          (m: { status: string }) =>
            m.status === OrganisationMembershipStatusEnum.SUSPENDED,
        ),
      ).toBe(true);
      expect(
        result.data.some(
          (m: { id: string }) => m.id === suspendedMember.membershipId,
        ),
      ).toBe(true);
    });

    it('should filter suspended memberships within suspendedFrom and suspendedTo range', async () => {
      const from = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const to = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();

      const res = await runGraphql(
        http,
        GET_ORGANISATION_MEMBERSHIPS_QUERY,
        {
          filter: {
            status: OrganisationMembershipStatusEnum.SUSPENDED,
            suspendedFrom: from,
            suspendedTo: to,
          },
        },
        ownerAccessToken,
      );
      expect(res.statusCode).toBe(200);

      expect(res.body.errors).toBeUndefined();
      const result = res.body.data.getOrganisationMemberships;
      expect(
        result.data.some(
          (m: { id: string }) => m.id === suspendedMember.membershipId,
        ),
      ).toBe(true);
    });

    it('should paginate results with page, limit, and meta fields', async () => {
      const res = await runGraphql(
        http,
        GET_ORGANISATION_MEMBERSHIPS_QUERY,
        {
          filter: {
            page: 1,
            limit: 2,
          },
        },
        ownerAccessToken,
      );
      expect(res.statusCode).toBe(200);

      expect(res.body.errors).toBeUndefined();
      const result = res.body.data.getOrganisationMemberships;
      expect(result.data.length).toBeLessThanOrEqual(2);
      expect(result.meta).toMatchObject({
        page: 1,
        limit: 2,
      });
      expect(typeof result.meta.total).toBe('number');
      expect(typeof result.meta.totalPages).toBe('number');
      expect(typeof result.meta.hasNextPage).toBe('boolean');
      expect(typeof result.meta.hasPreviousPage).toBe('boolean');
    });
  });
});
