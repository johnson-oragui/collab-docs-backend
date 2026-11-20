import { PermissionAssignmentModeEnum } from '@/commons/enums';
import { generateRandomIPv4 } from '@/commons/util/generateRandomIPv4';
import {
  InvitationStatusEnum,
  OrganisationMembershipStatusEnum,
  RoleEnum,
  TInvitationStatusEnum,
  TRoleEnum,
} from '@/database/database.enums';
import { EmailVerificationService } from '@/email-verification/email-verification.service';
import { OrganisationMembershipInvitationEntity } from '@/org_membership_invitation/org_membership_invitation.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { OrganisationEntity } from '@/organisations/organisations.entity';
import { PasswordService } from '@/password/password.service';
import { RoleEntity } from '@/roles/roles.entity';
import { createE2eApp } from '@/test/fixtures/create-e2e-app';
import { createHttpClient } from '@/test/fixtures/helpers/http-request';
import { UserEntity } from '@/user/user.entity';
import { INestApplication } from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';

describe('Get Invitations e2e ', () => {
  let app: INestApplication;
  let http: ReturnType<typeof createHttpClient>;
  let dataSource: DataSource;
  let emailVerificationService: EmailVerificationService;
  let passwordService: PasswordService;
  let invitationRepo: Repository<OrganisationMembershipInvitationEntity>;

  let registrationPayload: ReturnType<typeof createRegistrationPayload>;
  let registeredUserId: string;
  let registeredOrganisationId: string;
  let rawVerificationToken: string;
  let getRegistrationTokenSpy: jest.SpyInstance;
  let accessToken: string;

  // Secondary org & user for cross-org and non-admin RBAC tests
  let secondOrgId: string;
  let secondOrgUserId: string;
  let secondOrgAccesToken: string;

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
      email: payload.email,
      accessToken: loginRes.body.data.accessToken as string,
    };
  };

  beforeAll(async () => {
    app = await createE2eApp();
    http = createHttpClient(app);
    dataSource = app.get(DataSource);
    emailVerificationService = app.get(EmailVerificationService);
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
      .set('X-Forwared-For', generateRandomIPv4())
      .send(registrationPayload)
      .expect(201);

    registeredUserId = registrationResponse.body.data.user.id;
    registeredOrganisationId = registrationResponse.body.data.organisation.id;
    createdUserIds.push(registeredUserId);
    createdOrgIds.push(registeredOrganisationId);

    const verifyResponse = await http
      .post('/api/v1/auth/verify-email')
      .set('X-Forwared-For', generateRandomIPv4())
      .send({ token: rawVerificationToken })
      .expect(201);

    expect(verifyResponse.body.success).toBeTruthy();

    const loginResponse = await http
      .post('/api/v1/auth/login')
      .set('X-Forwared-For', generateRandomIPv4())
      .send({
        email: registrationPayload.email,
        password: registrationPayload.password,
      })
      .expect(200);

    accessToken = loginResponse.body.data.accessToken;

    // Create a second organisation + user for cross-organisation isolation checks
    const secondAccount = await registerAndLoginUser('other-org');
    secondOrgId = secondAccount.orgId;
    secondOrgUserId = secondAccount.userId;
    secondOrgAccesToken = secondAccount.accessToken;

    // Create a non-admin member inside registeredOrganisationId for 403 role escalation checks
    const memberEmail = `org-member-${randomUUID().slice(0, 8)}@example.com`;
    const memberPassword = 'StrongPassword123#';
    const memberRole = await dataSource
      .getRepository(RoleEntity)
      .findOne({ where: { name: RoleEnum.ORG_MEMBER } });

    const memberUser = await dataSource.getRepository(UserEntity).save(
      dataSource.getRepository(UserEntity).create({
        email: memberEmail,
        firstName: 'Regular',
        lastName: 'Member',
        password: await passwordService.hash(memberPassword),
        emailVerifiedAt: new Date(),
        isActive: true,
        acceptTerms: true,
      }),
    );
    firstOrgMemberUserId = memberUser.id;
    createdUserIds.push(firstOrgMemberUserId);

    await dataSource.getRepository(OrganisationMembershipEntity).save(
      dataSource.getRepository(OrganisationMembershipEntity).create({
        user: { id: firstOrgMemberUserId } as UserEntity,
        organisation: { id: registeredOrganisationId } as OrganisationEntity,
        role: memberRole!,
        status: OrganisationMembershipStatusEnum.ACTIVE,
      }),
    );

    const memberLogin = await http
      .post('/api/v1/auth/login')
      .set('X-Forwared-For', generateRandomIPv4())
      .send({ email: memberEmail, password: memberPassword })
      .expect(200);
    firstOrgMemberAccessToken = memberLogin.body.data.accessToken;
  });

  const roleRepo = () => dataSource.getRepository(RoleEntity);

  const createInvitedRecord = async (options: {
    emailPrefix: string;
    status?: TInvitationStatusEnum;
    expiresAt?: Date;
    roleName?: TRoleEnum;
    orgId?: string;
  }) => {
    const targetOrgId = options.orgId ?? registeredOrganisationId;
    const email = `${options.emailPrefix}-${randomUUID().slice(0, 8)}@example.com`;

    const response = await http
      .post('organisation-invitations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        email,
        firstName: 'Filter',
        lastName: 'Test',
        role: RoleEnum.ORG_MEMBER,
        permissionMode: PermissionAssignmentModeEnum.DEFAULT,
      })
      .set('X-Forwared-For', generateRandomIPv4())
      .expect(201);

    const invitationId = response.body.data.id;

    const updates: Partial<OrganisationMembershipInvitationEntity> = {};

    if (options.status) {
      updates.status = options.status;
    }
    if (options.expiresAt) {
      updates.expiresAt = options.expiresAt;
    }
    if (options.roleName) {
      const roleEntity = await roleRepo().findOne({
        where: { name: options.roleName },
      });
      if (roleEntity) {
        updates.role = roleEntity;
      }
    }
    if (targetOrgId !== registeredOrganisationId) {
      updates.organisation = { id: targetOrgId } as OrganisationEntity;
    }

    if (Object.keys(updates).length > 0) {
      await invitationRepo.update(invitationId, updates);
    }

    return invitationRepo.findOne({
      where: { id: invitationId },
      relations: { role: true, organisation: true },
    });
  };

  it('should return 401 when fetching invitations without authorization', async () => {
    const res = await http.get('organisation-invitations');
    expect(res.statusCode).toBe(401);
  });

  it('should paginate invitations accurately with page, limit, and meta fields', async () => {
    await Promise.all([
      createInvitedRecord({ emailPrefix: 'page-1' }),
      createInvitedRecord({ emailPrefix: 'page-2' }),
      createInvitedRecord({ emailPrefix: 'page-3' }),
    ]);

    const page1Res = await http
      .get('organisation-invitations')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Forwared-For', generateRandomIPv4())
      .query({ page: 1, limit: 2 });
    // console.log(JSON.stringify(page1Res.body));

    expect(page1Res.statusCode).toBe(200);

    expect(page1Res.body.success).toBe(true);
    expect(Array.isArray(page1Res.body.data)).toBe(true);
    expect(page1Res.body.data.length).toBeLessThanOrEqual(2);
    expect(page1Res.body.meta).toMatchObject({
      page: 1,
      limit: 2,
      hasPreviousPage: false,
    });
    expect(typeof page1Res.body.meta.total).toBe('number');
    expect(typeof page1Res.body.meta.totalPages).toBe('number');
  });

  it('should filter invitations by status (PENDING, REVOKED, ACCEPTED, EXPIRED)', async () => {
    const revokedTarget = await createInvitedRecord({
      emailPrefix: 'status-revoked',
      status: InvitationStatusEnum.REVOKED,
    });
    const expiredTarget = await createInvitedRecord({
      emailPrefix: 'status-expired',
      status: InvitationStatusEnum.EXPIRED,
    });
    const pendingTarget = await createInvitedRecord({
      emailPrefix: 'status-pending',
      status: InvitationStatusEnum.PENDING,
    });

    let res = await http
      .get('organisation-invitations')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ status: InvitationStatusEnum.REVOKED })
      .expect(200);

    expect(
      res.body.data.every(
        (item: { status: string }) =>
          item.status === InvitationStatusEnum.REVOKED,
      ),
    ).toBe(true);
    expect(
      res.body.data.some(
        (item: { id: string }) => item.id === revokedTarget!.id,
      ),
    ).toBe(true);

    res = await http
      .get('organisation-invitations')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ status: InvitationStatusEnum.PENDING })
      .expect(200);

    expect(
      res.body.data.every(
        (item: { status: string }) =>
          item.status === InvitationStatusEnum.PENDING,
      ),
    ).toBe(true);
    expect(
      res.body.data.some(
        (item: { id: string }) => item.id === pendingTarget!.id,
      ),
    ).toBe(true);

    res = await http
      .get('organisation-invitations')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ status: InvitationStatusEnum.EXPIRED })
      .expect(200);

    expect(
      res.body.data.every(
        (item: { status: string }) =>
          item.status === InvitationStatusEnum.EXPIRED,
      ),
    ).toBe(true);
    expect(
      res.body.data.some(
        (item: { id: string }) => item.id === expiredTarget!.id,
      ),
    ).toBe(true);
  });

  it('should filter invitations by expired boolean flag (true vs false)', async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const expiredInv = await createInvitedRecord({
      emailPrefix: 'exp-true',
      expiresAt: pastDate,
    });
    const activeInv = await createInvitedRecord({
      emailPrefix: 'exp-false',
      expiresAt: futureDate,
    });

    const expiredRes = await http
      .get('organisation-invitations')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ expired: 'true' })
      .expect(200);

    const nowIso = new Date().toISOString();
    expect(
      expiredRes.body.data.some(
        (item: { id: string }) => item.id === expiredInv!.id,
      ),
    ).toBe(true);
    expect(
      expiredRes.body.data.every(
        (item: { expiresAt: string }) => item.expiresAt <= nowIso,
      ),
    ).toBe(true);

    const nonExpiredRes = await http
      .get('organisation-invitations')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ expired: 'false' })
      .expect(200);

    expect(
      nonExpiredRes.body.data.some(
        (item: { id: string }) => item.id === activeInv!.id,
      ),
    ).toBe(true);
    expect(
      nonExpiredRes.body.data.every(
        (item: { expiresAt: string }) => item.expiresAt > nowIso,
      ),
    ).toBe(true);
  });

  it('should filter invitations by expiredFrom and expiredTo date range', async () => {
    const baseMs = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const insideDate = new Date(baseMs + 2 * 60 * 60 * 1000);
    const outsideDate = new Date(baseMs + 48 * 60 * 60 * 1000);

    const insideInv = await createInvitedRecord({
      emailPrefix: 'range-inside',
      expiresAt: insideDate,
    });
    const outsideInv = await createInvitedRecord({
      emailPrefix: 'range-outside',
      expiresAt: outsideDate,
    });

    const expiredFrom = new Date(baseMs).toISOString();
    const expiredTo = new Date(baseMs + 6 * 60 * 60 * 1000).toISOString();

    const res = await http
      .get('organisation-invitations')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ expiredFrom, expiredTo })
      .expect(200);

    const ids = res.body.data.map((item: { id: string }) => item.id);
    expect(ids).toContain(insideInv!.id);
    expect(ids).not.toContain(outsideInv!.id);
  });

  it('should filter invitations by role', async () => {
    const adminInv = await createInvitedRecord({
      emailPrefix: 'role-admin',
      roleName: RoleEnum.ORG_ADMIN,
    });

    const res = await http
      .get('organisation-invitations')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ role: RoleEnum.ORG_ADMIN })
      .expect(200);

    expect(
      res.body.data.some((item: { id: string }) => item.id === adminInv!.id),
    ).toBe(true);
    expect(
      res.body.data.every(
        (item: { role?: { name?: string } }) =>
          item.role?.name === RoleEnum.ORG_ADMIN,
      ),
    ).toBe(true);
  });

  it('should filter invitations by invitationId and exclude other organisations', async () => {
    const targetInv = await createInvitedRecord({
      emailPrefix: 'by-id-target',
    });
    const otherOrgInv = await createInvitedRecord({
      emailPrefix: 'other-org-inv',
      orgId: secondOrgId,
    });

    const matchRes = await http
      .get('organisation-invitations')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ invitationId: targetInv!.id })
      .expect(200);

    expect(matchRes.body.data).toHaveLength(1);
    expect(matchRes.body.data[0].id).toBe(targetInv!.id);
    expect(matchRes.body.meta.total).toBe(1);

    const foreignRes = await http
      .get('organisation-invitations')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ invitationId: otherOrgInv!.id })
      .expect(200);

    expect(foreignRes.body.data).toHaveLength(0);
    expect(foreignRes.body.meta.total).toBe(0);
  });

  it('should reject invalid query parameters (e.g., invalid status, non-UUID invitationId, or page < 1) with 400', async () => {
    const badStatus = await http
      .get('organisation-invitations')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ status: 'NOT_A_REAL_STATUS' });
    expect(badStatus.statusCode).toBe(400);

    const badUuid = await http
      .get('organisation-invitations')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ invitationId: 'not-a-uuid' });
    expect(badUuid.statusCode).toBe(400);

    const badPage = await http
      .get('organisation-invitations')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ page: 0 });
    expect(badPage.statusCode).toBe(400);
  });
});
