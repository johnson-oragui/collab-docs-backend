
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';

import { createE2eApp } from '@/test/fixtures/create-e2e-app';
import { createHttpClient } from '@/test/fixtures/helpers/http-request';

import { UserEntity } from '@/user/user.entity';
import { ProfileEntity } from '@/profile/profile.entity';
import { OrganisationEntity } from '@/organisations/organisations.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { OrganisationOwnershipHistoryEntity } from '@/organisation-ownership-history/organisation-ownership-history.entity';
import { UserSessionEntity } from '@/user_sessions/user-session.entity';
import { UserSessionTokenEntity } from '@/user-session-token/user-session-token.entity';

import { UserSessionTokenStatusEnum } from '@/database/database.enums';

describe('Authentication Login (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof createHttpClient>;
  let dataSource: DataSource;

  let registrationPayload: ReturnType<typeof createRegistrationPayload>;
  let registeredUserId: string;
  let registeredOrganisationId: string;

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

    registrationPayload = createRegistrationPayload();

    const registrationResponse = await http
      .post('/api/v1/auth/register')
      .send(registrationPayload)
      .expect(201);

    registeredUserId = registrationResponse.body.data.user.id;
    registeredOrganisationId =
      registrationResponse.body.data.organisation.id;
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

        await dataSource
          .getRepository(UserSessionEntity)
          .delete(sessionIds);
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

  describe('POST /api/v1/auth/login', () => {
    it('should register without creating a session', async () => {
      const sessions = await dataSource
        .getRepository(UserSessionEntity)
        .find({
          where: {
            user: { id: registeredUserId },
          },
        });

      expect(sessions).toHaveLength(0);
    });

    it('should authenticate a registered user and create a session', async () => {
      const response = await http
        .post('/api/v1/auth/login')
        .send({
          email: registrationPayload.email,
          password: registrationPayload.password,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Login successful.',
        data: {
          requiresOrganisationSelection: false,
          accessToken: expect.any(String),
          tokenType: 'Bearer',
          user: {
            id: registeredUserId,
            email: registrationPayload.email,
            firstName: registrationPayload.firstname,
            lastName: registrationPayload.lastname,
          },
          organisationId: registeredOrganisationId,
          organisationName: registrationPayload.organisationName,
          organisationRole: 'ORG_ADMIN',
        },
      });

      expect(response.body.data.accessToken.length).toBeGreaterThan(0);
      expect(Date.parse(response.body.data.expiresAt)).not.toBeNaN();

      // Refresh token should be returned in the response header.
      const refreshToken = response.headers['x-refresh-token'];

      expect(refreshToken).toEqual(expect.any(String));
      expect(refreshToken.length).toBeGreaterThan(0);

      // Refresh token must not be exposed in the response body.
      expect(response.body.data).not.toHaveProperty('refreshToken');

      // Verify that a session was persisted.
      const sessions = await dataSource
        .getRepository(UserSessionEntity)
        .find({
          where: {
            user: { id: registeredUserId },
            organisation: { id: registeredOrganisationId },
          },
        });

      expect(sessions).toHaveLength(1);

      const session = sessions[0];

      expect(session.revokedAt).toBeNull();
      expect(session.expiresAt).toBeInstanceOf(Date);

      // Verify that the refresh token was persisted as a token record.
      const tokens = await dataSource
        .getRepository(UserSessionTokenEntity)
        .find({
          where: {
            session: { id: session.id },
          },
        });

      expect(tokens).toHaveLength(1);
      expect(tokens[0].status).toBe(UserSessionTokenStatusEnum.ACTIVE);

      // The raw refresh token should not be stored in the database.
      expect(tokens[0].tokenHash).not.toBe(refreshToken);
    });

    it('should reject a non-existent email', async () => {
      await http
        .post('/api/v1/auth/login')
        .send({
          email: `nonexistent-${randomUUID()}@example.com`,
          password: 'StrongPassword123#',
        })
        .expect(401);
    });

    it('should reject an incorrect password', async () => {
      await http
        .post('/api/v1/auth/login')
        .send({
          email: registrationPayload.email,
          password: 'IncorrectPassword123#',
        })
        .expect(401);
    });

    it('should reject a whitespace-only password', async () => {
      await http
        .post('/api/v1/auth/login')
        .send({
          email: registrationPayload.email,
          password: '   ',
        })
        .expect(401);
    });

    it('should reject login with an organisation the user does not belong to', async () => {
      await http
        .post('/api/v1/auth/login')
        .send({
          email: registrationPayload.email,
          password: registrationPayload.password,
          organisationId: randomUUID(),
        })
        .expect(403);
    });

    it('should normalise the email before authenticating', async () => {
      const response = await http
        .post('/api/v1/auth/login')
        .send({
          email: `  ${registrationPayload.email.toUpperCase()}  `,
          password: registrationPayload.password,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          requiresOrganisationSelection: false,
          user: {
            id: registeredUserId,
            email: registrationPayload.email,
          },
          organisationId: registeredOrganisationId,
        },
      });

      expect(response.headers['x-refresh-token']).toEqual(
        expect.any(String),
      );
    });
  });
});
