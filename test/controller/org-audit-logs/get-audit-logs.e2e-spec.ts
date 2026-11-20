import { generateRandomIPv4 } from '@/commons/util/generateRandomIPv4';

import { EmailVerificationService } from '@/email-verification/email-verification.service';
import { OrganisationAuditEntity } from '@/organisation_audit/organisation_audit.entity';
import { PasswordService } from '@/password/password.service';
import { createE2eApp } from '@/test/fixtures/create-e2e-app';
import { createHttpClient } from '@/test/fixtures/helpers/http-request';
import { INestApplication } from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';

describe('Get Organisation Audits e2e ', () => {
  let app: INestApplication;
  let http: ReturnType<typeof createHttpClient>;
  let dataSource: DataSource;
  let emailVerificationService: EmailVerificationService;
  let passwordService: PasswordService;
  let orgAuditRepo: Repository<OrganisationAuditEntity>;

  let registrationPayload: ReturnType<typeof createRegistrationPayload>;
  let registeredUserId: string;
  let registeredOrganisationId: string;
  let rawVerificationToken: string;
  let getRegistrationTokenSpy: jest.SpyInstance;
  let accessToken: string;

  // Secondary org & user for cross-org and non-admin RBAC tests
  let secondOrgAccesToken: string;

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
    orgAuditRepo = dataSource.getRepository(OrganisationAuditEntity);

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
    secondOrgAccesToken = secondAccount.accessToken;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should return 401 when fetching invitations without authorization', async () => {
    const res = await http.get('organisation-audits');
    expect(res.statusCode).toBe(401);
  });

  it('should paginate organisation audits accurately with page, limit, and meta fields', async () => {
    await orgAuditRepo.save(
      orgAuditRepo.create({
        actor: { id: registeredUserId },
        eventType: 'TEST',
        metadata: { placeholder: 'Data' },
        organisation: { id: registeredOrganisationId },
      }),
    );
    const page1Res = await http
      .get('organisation-audits')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Forwared-For', generateRandomIPv4())
      .query({ page: 1, limit: 2 });
    // console.log(JSON.stringify(page1Res.body));

    expect(page1Res.statusCode).toBe(200);

    expect(page1Res.body.data).toMatchObject([
      {
        id: expect.any(String),
        eventType: 'TEST',
        metadata: { placeholder: 'Data' },
        createdAt: expect.any(String),
        actor: {
          id: registeredUserId,
          firstName: expect.any(String),
          lastName: expect.any(String),
          email: expect.any(String),
        },
      },
    ]);

    expect(page1Res.body.success).toBe(true);
    expect(Array.isArray(page1Res.body.data)).toBe(true);
    expect(page1Res.body.data.length).toBeLessThanOrEqual(1);
    expect(page1Res.body.meta).toMatchObject({
      page: 1,
      limit: 2,
      hasPreviousPage: false,
      hasNextPage: false,
    });
    expect(typeof page1Res.body.meta.total).toBe('number');
    expect(typeof page1Res.body.meta.totalPages).toBe('number');
  });

  it('should not retrieve another organisation audit-logs', async () => {
    const matchRes = await http
      .get('organisation-audits')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(matchRes.body.data).toHaveLength(1);

    const foreignRes = await http
      .get('organisation-audits')
      .set('Authorization', `Bearer ${secondOrgAccesToken}`)
      .expect(200);

    expect(foreignRes.body.data).toHaveLength(0);
    expect(foreignRes.body.meta.total).toBe(0);
  });
});
