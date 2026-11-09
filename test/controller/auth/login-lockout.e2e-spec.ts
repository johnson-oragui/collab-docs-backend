import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID, createHash } from 'node:crypto';

import { createE2eApp } from '@/test/fixtures/create-e2e-app';
import { createHttpClient } from '@/test/fixtures/helpers/http-request';

import { UserEntity } from '@/user/user.entity';
import { ProfileEntity } from '@/profile/profile.entity';
import { OrganisationEntity } from '@/organisations/organisations.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { OrganisationOwnershipHistoryEntity } from '@/organisation-ownership-history/organisation-ownership-history.entity';
import { UserSessionEntity } from '@/user_sessions/user-session.entity';
import { UserSessionTokenEntity } from '@/user-session-token/user-session-token.entity';

import { LoginLockoutService } from '@/login-lockout/login-lockout.service';
import { ILoginFailureResult } from '@/login-lockout/login-lockout.interface';

describe('Login Lockout (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof createHttpClient>;
  let dataSource: DataSource;

  let loginLockoutService: LoginLockoutService;

  let registrationPayload: ReturnType<typeof createRegistrationPayload>;
  let registeredUserId: string;
  let registeredOrganisationId: string;

  const createRegistrationPayload = () => {
    const uniqueId = randomUUID().replace(/-/g, '');

    return {
      email: `lockout-user-${uniqueId}@example.com`,
      password: 'StrongPassword123#',
      confirmPassword: 'StrongPassword123#',
      acceptTerms: true,
      firstname: 'Johnson',
      lastname: 'Dennis',
      organisationName: `Lockout Technologies ${uniqueId}`,
      organisationDescription: 'Login lockout E2E test organisation.',
      organisationEmail: `lockout-organisation-${uniqueId}@example.com`,
    };
  };

  const progressiveTestEmail = `progressive-${randomUUID()}@example.com`;

  const getLockoutKey = (email: string) => {
    const hash = createHash('sha256')
      .update(email.trim().toLowerCase())
      .digest('hex');

    return `auth:login:lockout:${hash}`;
  };

  beforeAll(async () => {
    app = await createE2eApp();

    http = createHttpClient(app);
    dataSource = app.get(DataSource);

    loginLockoutService = app.get(LoginLockoutService);

    registrationPayload = createRegistrationPayload();

    const registrationResponse = await http
      .post('/api/v1/auth/register')
      .send(registrationPayload)
      .expect(201);

    registeredUserId = registrationResponse.body.data.user.id;
    registeredOrganisationId = registrationResponse.body.data.organisation.id;
  });

  afterAll(async () => {
    // Clean up Redis lockout state before closing the application.
    if (loginLockoutService) {
      await loginLockoutService.resetLockout(registrationPayload.email);
      await loginLockoutService.resetLockout(progressiveTestEmail);
    }

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

      // Delete organisation ownership history and memberships.
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

      // UserEntity owns the profile foreign key.
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

  beforeEach(async () => {
    await loginLockoutService.resetLockout(registrationPayload.email);
  });

  describe('POST /api/v1/auth/login', () => {
    it('should increment failed attempts and lock the account after five failures', async () => {
      for (let attempt = 1; attempt <= 5; attempt++) {
        const res = await http
          .post('/api/v1/auth/login')
          .send({
            email: registrationPayload.email,
            password: 'IncorrectPassword123#',
          })
          .expect(401);

        console.log(res.body.message);
      }

      const status = await loginLockoutService.getLockoutStatus(
        registrationPayload.email,
      );

      expect(status.isLocked).toBe(true);
      expect(status.remainingSeconds).toBeGreaterThan(0);
      expect(status.remainingSeconds).toBeLessThanOrEqual(60);

      // Even correct credentials should be rejected while locked.
      const response = await http
        .post('/api/v1/auth/login')
        .send({
          email: registrationPayload.email,
          password: registrationPayload.password,
        })
        .expect(429);

      expect(response.body.message).toContain('Too many failed login attempts');
    });

    it('should reset the failure count and escalation level after successful login', async () => {
      // Four incorrect attempts should not trigger a lockout.
      for (let attempt = 1; attempt <= 4; attempt++) {
        await http
          .post('/api/v1/auth/login')
          .send({
            email: registrationPayload.email,
            password: 'IncorrectPassword123#',
          })
          .expect(401);
      }

      // A successful login should clear the complete lockout history.
      await http
        .post('/api/v1/auth/login')
        .send({
          email: registrationPayload.email,
          password: registrationPayload.password,
        })
        .expect(200);

      const status = await loginLockoutService.getLockoutStatus(
        registrationPayload.email,
      );

      expect(status.isLocked).toBe(false);
      expect(status.remainingSeconds).toBe(0);

      let result: ILoginFailureResult | null = null;

      // verify that the next lockout starts from the first escalation level.
      for (let attempt = 1; attempt <= 5; attempt++) {
        result = await loginLockoutService.recordFailedAttempt(
          registrationPayload.email,
        );
      }

      expect(result?.lockoutTriggered).toBe(true);
      expect(result?.lockoutLevel).toBe(1);
      expect(result?.lockoutDurationSeconds).toBe(60);
    });
  });
});
