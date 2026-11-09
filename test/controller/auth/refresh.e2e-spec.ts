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

describe('Authentication Refresh (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof createHttpClient>;
  let dataSource: DataSource;

  const testUsers: Array<{
    userId: string;
    organisationId: string;
    email: string;
    password: string;
  }> = [];

  const createRegistrationPayload = () => {
    const uniqueId = randomUUID().replace(/-/g, '');

    return {
      email: `refresh-user-${uniqueId}@example.com`,
      password: 'StrongPassword123#',
      confirmPassword: 'StrongPassword123#',
      acceptTerms: true,
      firstname: 'Johnson',
      lastname: 'Dennis',
      organisationName: `Refresh Technologies ${uniqueId}`,
      organisationDescription: 'Refresh E2E test organisation.',
      organisationEmail: `refresh-organisation-${uniqueId}@example.com`,
    };
  };

  const createAuthenticatedUser = async () => {
    const payload = createRegistrationPayload();

    const registrationResponse = await http
      .post('/api/v1/auth/register')
      .send(payload)
      .expect(201);

    const userId = registrationResponse.body.data.user.id;
    const organisationId = registrationResponse.body.data.organisation.id;

    testUsers.push({
      userId,
      organisationId,
      email: payload.email,
      password: payload.password,
    });

    const loginResponse = await http
      .post('/api/v1/auth/login')
      .send({
        email: payload.email,
        password: payload.password,
      })
      .expect(200);

    const refreshToken = loginResponse.headers['x-refresh-token'];

    expect(refreshToken).toEqual(expect.any(String));

    const session = await dataSource.getRepository(UserSessionEntity).findOne({
      where: {
        user: { id: userId },
        organisation: { id: organisationId },
      },
    });

    expect(session).not.toBeNull();

    return {
      userId,
      organisationId,
      refreshToken,
      sessionId: session!.id,
    };
  };

  beforeAll(async () => {
    app = await createE2eApp();

    http = createHttpClient(app);
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    try {
      if (dataSource?.isInitialized) {
        const userIds = testUsers.map((user) => user.userId);
        const organisationIds = testUsers.map((user) => user.organisationId);

        if (userIds.length > 0) {
          const sessions = await dataSource
            .getRepository(UserSessionEntity)
            .find({
              where: userIds.map((userId) => ({
                user: { id: userId },
              })),
            });

          const sessionIds = sessions.map((session) => session.id);

          if (sessionIds.length > 0) {
            await dataSource
              .getRepository(UserSessionTokenEntity)
              .createQueryBuilder()
              .delete()
              .where('"session_id" IN (:...sessionIds)', {
                sessionIds,
              })
              .execute();

            await dataSource
              .getRepository(UserSessionEntity)
              .delete(sessionIds);
          }
        }

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

        if (userIds.length > 0) {
          await dataSource.getRepository(OrganisationMembershipEntity).delete(
            userIds.map((userId) => ({
              user: { id: userId },
            })),
          );

          const users = await dataSource.getRepository(UserEntity).find({
            where: userIds.map((id) => ({ id })),
            relations: { profile: true },
          });

          await dataSource.getRepository(UserEntity).delete(userIds);

          const profileIds = users
            .map((user) => user.profile?.id)
            .filter((id): id is string => Boolean(id));

          if (profileIds.length > 0) {
            await dataSource.getRepository(ProfileEntity).delete(profileIds);
          }
        }
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should rotate a valid refresh token and issue new tokens', async () => {
      const authenticatedUser = await createAuthenticatedUser();

      const oldToken = await dataSource
        .getRepository(UserSessionTokenEntity)
        .findOne({
          where: {
            session: { id: authenticatedUser.sessionId },
          },
        });

      expect(oldToken).not.toBeNull();

      const response = await http
        .post('/api/v1/auth/refresh')
        .set('X-REFRESH-TOKEN', authenticatedUser.refreshToken)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Token refreshed successfully.',
        data: {
          accessToken: expect.any(String),
          tokenType: 'Bearer',
          user: {
            id: authenticatedUser.userId,
          },
          organisationId: authenticatedUser.organisationId,
        },
      });

      expect(response.body.data.accessToken.length).toBeGreaterThan(0);
      expect(Date.parse(response.body.data.expiresAt)).not.toBeNaN();

      const newRefreshToken = response.headers['x-refresh-token'];

      expect(newRefreshToken).toEqual(expect.any(String));
      expect(newRefreshToken).not.toBe(authenticatedUser.refreshToken);

      expect(response.body.data).not.toHaveProperty('refreshToken');

      // veerify that the original token was marked USED.
      const updatedOldToken = await dataSource
        .getRepository(UserSessionTokenEntity)
        .findOne({
          where: {
            id: oldToken!.id,
          },
        });

      expect(updatedOldToken!.status).toBe(UserSessionTokenStatusEnum.USED);

      expect(updatedOldToken!.usedAt).toBeInstanceOf(Date);
      expect(updatedOldToken!.replacedByTokenId).toEqual(expect.any(String));

      // veerify that a replacement token was created.
      const replacementToken = await dataSource
        .getRepository(UserSessionTokenEntity)
        .findOne({
          where: {
            id: updatedOldToken!.replacedByTokenId!,
          },
          relations: { session: true },
        });

      expect(replacementToken).not.toBeNull();
      expect(replacementToken!.session).not.toBeNull();

      expect(replacementToken!.session.id).toBe(authenticatedUser.sessionId);

      expect(replacementToken!.status).toBe(UserSessionTokenStatusEnum.ACTIVE);

      expect(replacementToken!.tokenHash).not.toBe(newRefreshToken);
      expect(replacementToken!.expiresAt).toEqual(oldToken!.expiresAt);

      // The session itself must remain unchanged and active.
      const session = await dataSource
        .getRepository(UserSessionEntity)
        .findOne({
          where: { id: authenticatedUser.sessionId },
        });

      expect(session).not.toBeNull();
      expect(session!.revokedAt).toBeNull();
      expect(session!.lastUsedAt).toBeInstanceOf(Date);
    });

    it('should reject a non-existent refresh token', async () => {
      await http
        .post('/api/v1/auth/refresh')
        .set('X-REFRESH-TOKEN', randomUUID())
        .expect(401);
    });

    it('should reject a missing refresh token', async () => {
      await http.post('/api/v1/auth/refresh').expect(401);
    });

    it('should revoke the session when a previously used refresh token is reused', async () => {
      const authenticatedUser = await createAuthenticatedUser();

      const originalRefreshToken = authenticatedUser.refreshToken;

      // first refresh: original token becomes USED and a replacement
      // token becomes ACTIVE.
      const firstRefreshResponse = await http
        .post('/api/v1/auth/refresh')
        .set('X-REFRESH-TOKEN', originalRefreshToken)
        .expect(200);

      const replacementRefreshToken =
        firstRefreshResponse.headers['x-refresh-token'];

      expect(replacementRefreshToken).toEqual(expect.any(String));

      // second refresh using the original token must trigger reuse detection.
      await http
        .post('/api/v1/auth/refresh')
        .set('X-REFRESH-TOKEN', originalRefreshToken)
        .expect(401);

      // The session must have been revoked.
      const session = await dataSource
        .getRepository(UserSessionEntity)
        .findOne({
          where: { id: authenticatedUser.sessionId },
        });

      expect(session).not.toBeNull();
      expect(session!.revokedAt).toBeInstanceOf(Date);

      // all tokens belonging to the session must now be REVOKED.
      const tokens = await dataSource
        .getRepository(UserSessionTokenEntity)
        .find({
          where: {
            session: { id: authenticatedUser.sessionId },
          },
        });

      expect(tokens.length).toBeGreaterThanOrEqual(2);

      expect(
        tokens.every(
          (token) => token.status === UserSessionTokenStatusEnum.REVOKED,
        ),
      ).toBe(true);

      // The replacement token must also fail because its session
      // has been revoked.
      await http
        .post('/api/v1/auth/refresh')
        .set('X-REFRESH-TOKEN', replacementRefreshToken)
        .expect(401);
    });
  });
});
