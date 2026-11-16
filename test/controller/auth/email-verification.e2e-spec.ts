import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
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
import { PasswordResetTokenEntity } from '@/password-recovery/password-recovery.entity';
import { EmailEventTypeEnum } from '@/database/database.enums';
import { generateRandomIPv4 } from '@/commons/util/generateRandomIPv4';

describe('Authentication Account Verification (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof createHttpClient>;
  let dataSource: DataSource;
  let emailVerificationService: EmailVerificationService;
  let passwordResetTokenRepository: Repository<PasswordResetTokenEntity>;

  let registrationPayload: ReturnType<typeof createRegistrationPayload>;
  let registeredUserId: string;
  let registeredOrganisationId: string;
  let rawToken: string;
  let getregistrationTokenSpy: jest.SpyInstance<any, unknown[], any>;

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

    passwordResetTokenRepository = dataSource.getRepository(
      PasswordResetTokenEntity,
    );

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
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      const users = await dataSource.getRepository(UserEntity).find({
        where: [{ id: registeredUserId }],
        relations: {
          profile: true,
        },
      });

      await passwordResetTokenRepository.delete({
        user: { id: registeredUserId },
        purpose: EmailEventTypeEnum.EMAIL_VERIFICATION,
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

  it('should reject a non-verified email before email verification', async () => {
    const ipAddress = generateRandomIPv4();
    await http
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', ipAddress)
      .send({
        email: registrationPayload.email,
        password: registrationPayload.password,
      })
      .expect(409);
  });

  it('should accept a verified email after email verification', async () => {
    const ipAddress = generateRandomIPv4();
    const response = await http
      .post('auth/verify-email')
      .set('X-Forwarded-For', ipAddress)
      .send({
        token: rawToken,
      })
      .expect(201);

    expect(response.body.success).toBeTruthy();
    expect(getregistrationTokenSpy).toHaveBeenCalledTimes(1);

    // Reject used token
    await http
      .post('auth/verify-email')
      .set('X-Forwarded-For', ipAddress)
      .send({
        token: rawToken,
      })
      .expect(400);

    await http
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', ipAddress)
      .send({
        email: registrationPayload.email,
        password: registrationPayload.password,
      })
      .expect(200);
  });
});
