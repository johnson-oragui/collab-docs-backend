import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomBytes, randomUUID } from 'node:crypto';

import { createE2eApp } from '@/test/fixtures/create-e2e-app';
import { createHttpClient } from '@/test/fixtures/helpers/http-request';

import { UserEntity } from '@/user/user.entity';
import { ProfileEntity } from '@/profile/profile.entity';
import { OrganisationEntity } from '@/organisations/organisations.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { OrganisationOwnershipHistoryEntity } from '@/organisation-ownership-history/organisation-ownership-history.entity';
import { UserSessionEntity } from '@/user_sessions/user-session.entity';
import { UserSessionTokenEntity } from '@/user-session-token/user-session-token.entity';

import { EmailVerificationService } from '@/email-verification/email-verification.service';
import { OrganisationStatusEnum, RoleEnum } from '@/database/database.enums';

describe('USERS me (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof createHttpClient>;
  let dataSource: DataSource;
  let emailVerificationService: EmailVerificationService;

  let registrationPayload: ReturnType<typeof createRegistrationPayload>;
  let registeredUserId: string;
  let registeredOrganisationId: string;
  let rawToken: string;
  let getregistrationTokenSpy: jest.SpyInstance<any, unknown[], any>;
  let accessToken: string;

  const objectIDs: string[] = [];

  const createRegistrationPayload = () => {
    const uniqueId = randomUUID().replace(/-/g, '');

    return {
      email: `login-user-${uniqueId}@example.com`,
      password: 'StrongPassword123#',
      confirmPassword: 'StrongPassword123#',
      acceptTerms: true,
      firstname: 'Johnson',
      lastname: 'Dennis',
      organisationName: `Login Technologies ${uniqueId}`,
      organisationDescription: 'Login E2E test organisation.',
      organisationEmail: `login-organisation-${uniqueId}@example.com`,
    };
  };

  beforeAll(async () => {
    app = await createE2eApp();

    http = createHttpClient(app);
    dataSource = app.get(DataSource);
    emailVerificationService = app.get(EmailVerificationService);

    registrationPayload = createRegistrationPayload();

    rawToken = randomBytes(32).toString('base64url');
    getregistrationTokenSpy = jest
      .spyOn(emailVerificationService as any, 'getToken')
      .mockReturnValue(rawToken);

    const registrationResponse = await http
      .post('/api/v1/auth/register')
      .send(registrationPayload)
      .expect(201);

    registeredUserId = registrationResponse.body.data.user.id;
    registeredOrganisationId = registrationResponse.body.data.organisation.id;
    objectIDs.push(registeredUserId, registeredOrganisationId);

    const response = await http
      .post('auth/verify-email')
      .send({
        token: rawToken,
      })
      .expect(201);

    expect(response.body.success).toBeTruthy();
    expect(getregistrationTokenSpy).toHaveBeenCalledTimes(1);

    const loginResponse = await http
      .post('/api/v1/auth/login')
      .send({
        email: registrationPayload.email,
        password: registrationPayload.password,
      })
      .expect(200);

    accessToken = loginResponse.body.data.accessToken;
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      const users = await dataSource.getRepository(UserEntity).find({
        where: [{ id: registeredUserId }],
        relations: {
          profile: true,
        },
      });

      const organisations = await dataSource
        .getRepository(OrganisationEntity)
        .find({
          where: [{ id: registeredOrganisationId }],
        });

      const userIds = users.map((user) => user.id);
      const organisationIds = organisations.map(
        (organisation) => organisation.id,
      );

      // Find sessions belonging to the test user.
      const sessions =
        userIds.length > 0
          ? await dataSource.getRepository(UserSessionEntity).find({
              where: userIds.map((userId) => ({
                user: { id: userId },
              })),
            })
          : [];

      const sessionIds = sessions.map((session) => session.id);

      // Refresh-token records restrict deletion of their parent sessions.
      if (sessionIds.length > 0) {
        await dataSource
          .getRepository(UserSessionTokenEntity)
          .createQueryBuilder()
          .delete()
          .where('"session_id" IN (:...sessionIds)', { sessionIds })
          .execute();

        await dataSource.getRepository(UserSessionEntity).delete(sessionIds);
      }

      // Delete organisation ownership history.
      if (organisationIds.length > 0) {
        await dataSource
          .getRepository(OrganisationOwnershipHistoryEntity)
          .createQueryBuilder()
          .delete()
          .where('"organisation_id" IN (:...organisationIds)', {
            organisationIds,
          })
          .execute();

        await dataSource
          .getRepository(OrganisationMembershipEntity)
          .createQueryBuilder()
          .delete()
          .where('"organisation_id" IN (:...organisationIds)', {
            organisationIds,
          })
          .execute();

        await dataSource
          .getRepository(OrganisationEntity)
          .delete(organisationIds);
      }

      // Delete any remaining memberships belonging to the test user.
      if (userIds.length > 0) {
        await dataSource
          .getRepository(OrganisationMembershipEntity)
          .delete(userIds.map((userId) => ({ user: { id: userId } })));
      }

      if (userIds.length > 0) {
        await dataSource.getRepository(UserEntity).delete(userIds);
      }

      // UserEntity owns the profile foreign key, so delete profiles afterwards.
      const profileIds = users
        .map((user) => user.profile?.id)
        .filter((id): id is string => Boolean(id));

      if (profileIds.length > 0) {
        await dataSource.getRepository(ProfileEntity).delete(profileIds);
      }
    }

    if (app) {
      await app.close();
    }
  });

  it('should return the current user data', async () => {
    const response = await http
      .get('users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      message: expect.any(String),
      data: {
        id: registeredUserId,
        email: registrationPayload.email,
        firstName: registrationPayload.firstname,
        lastName: registrationPayload.lastname,
        profile: {
          id: expect.any(String),
          bio: null,
          avatarUrl: null,
        },
        organisationMemberships: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            status: OrganisationStatusEnum.ACTIVE,
            role: {
              id: expect.any(String),
              name: RoleEnum.ORG_ADMIN,
            },
          }),
        ]),
      },
    });
  });

  it('should return 401 for unauthorized access via RestFUL', async () => {
    const response = await http.get('users/me');

    expect(response.statusCode).toBe(401);

    expect(response.body?.data?.me?.data?.id).not.toBeDefined();
    expect(response.body?.data?.me?.data?.profile?.id).not.toBeDefined();
  });

  it('should return the current user data via GraphQL', async () => {
    const query = `
      query {
        me {
          success
          message
          data {
            id
            email
            firstName
            lastName
            profile {
              id
              bio
              avatarUrl
            }
            organisationMemberships {
              id
              status
              role {
                id
                name
              }
            }
          }
        }
      }
    `;

    const response = await http
      .post('/api/graphql')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ query });

    expect(response.statusCode).toBe(200);

    expect(response.body.data.me).toMatchObject({
      success: true,
      message: expect.any(String),
      data: {
        id: registeredUserId,
        email: registrationPayload.email,
        firstName: registrationPayload.firstname,
        lastName: registrationPayload.lastname,
        profile: {
          id: expect.any(String),
          bio: null,
          avatarUrl: null,
        },
        organisationMemberships: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            status: OrganisationStatusEnum.ACTIVE,
            role: {
              id: expect.any(String),
              name: RoleEnum.ORG_ADMIN,
            },
          }),
        ]),
      },
    });

    expect(response.body.data.me.data.id).toBeDefined();
    expect(response.body.data.me.data.profile.id).toBeDefined();
  });

  it('should return 401 for unauthorized access via GraphQL', async () => {
    const query = `
      query {
        me {
          success
          message
          data {
            id
            email
            firstName
            lastName
            profile {
              id
              bio
              avatarUrl
            }
            organisationMemberships {
              id
              status
              role {
                id
                name
              }
            }
          }
        }
      }
    `;

    const response = await http.post('/api/graphql').send({ query });
    // console.log('response: ', JSON.stringify(response.body));

    expect(response.body).toMatchObject({
      errors: [
        {
          message: 'Missing Authorization header',
          locations: [{ line: 3, column: 9 }],
          path: ['me'],
          extensions: {
            code: 'UNAUTHENTICATED',
            statusCode: 401,
            success: false,
            requestId: expect.any(String),
          },
        },
      ],
    });

    expect(response.body?.data?.me?.data?.id).not.toBeDefined();
    expect(response.body?.data?.me?.data?.profile?.id).not.toBeDefined();
  });
});
