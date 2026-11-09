import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { createE2eApp } from '@/test/fixtures/create-e2e-app';
import { createHttpClient } from '@/test/fixtures/helpers/http-request';

import { UserEntity } from '@/user/user.entity';
import { ProfileEntity } from '@/profile/profile.entity';
import { OrganisationEntity } from '@/organisations/organisations.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { OrganisationOwnershipHistoryEntity } from '@/organisation-ownership-history/organisation-ownership-history.entity';
import { UserSessionEntity } from '@/user_sessions/user-session.entity';

import { RoleEnum } from '@/database/database.enums';
import { PasswordService } from '@/password/password.service';
import { uuidv7 } from 'uuidv7';

describe('Authentication Registration (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof createHttpClient>;
  let dataSource: DataSource;
  let passwordService: PasswordService;

  const createdUserEmails: string[] = [];
  const createdOrganisationEmails: string[] = [];

  const createRegistrationPayload = () => {
    const uniqueId = uuidv7().replace(/-/g, '');

    const userEmail = `user-${uniqueId}@example.com`;
    const organisationEmail = `organisation-${uniqueId}@example.com`;

    createdUserEmails.push(userEmail);
    createdOrganisationEmails.push(organisationEmail);

    return {
      email: userEmail,
      password: 'StrongPassword123#',
      confirmPassword: 'StrongPassword123#',
      acceptTerms: true,
      firstname: 'Johnson',
      lastname: 'Dennis',
      organisationName: `Johnson Technologies ${uniqueId}`,
      organisationDescription: 'E2E test organisation.',
      organisationEmail,
    };
  };

  beforeAll(async () => {
    app = await createE2eApp();

    http = createHttpClient(app);
    dataSource = app.get(DataSource);
    passwordService = app.get(PasswordService);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      const users = await dataSource.getRepository(UserEntity).find({
        where: createdUserEmails.map((email) => ({ email })),
        relations: {
          profile: true,
        },
      });

      const organisations = await dataSource
        .getRepository(OrganisationEntity)
        .find({
          where: createdOrganisationEmails.map((email) => ({ email })),
        });

      const userIds = users.map((user) => user.id);
      const organisationIds = organisations.map(
        (organisation) => organisation.id,
      );

      for (const organisationId of organisationIds) {
        await dataSource
          .getRepository(OrganisationOwnershipHistoryEntity)
          .createQueryBuilder()
          .delete()
          .where('"organisation_id" = :organisationId', { organisationId })
          .execute();

        await dataSource
          .getRepository(OrganisationMembershipEntity)
          .createQueryBuilder()
          .delete()
          .where('"organisation_id" = :organisationId', { organisationId })
          .execute();
      }

      for (const userId of userIds) {
        await dataSource
          .getRepository(UserSessionEntity)
          .delete({ user: { id: userId } });

        await dataSource
          .getRepository(OrganisationMembershipEntity)
          .delete({ user: { id: userId } });
      }

      if (organisationIds.length > 0) {
        await dataSource
          .getRepository(OrganisationEntity)
          .delete(organisationIds);
      }

      if (userIds.length > 0) {
        await dataSource.getRepository(UserEntity).delete(userIds);
      }

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

  describe('POST /api/v1/auth/register', () => {
    it('should register a user and create an organisation with an active ORG_ADMIN membership', async () => {
      const payload = createRegistrationPayload();

      const response = await http
        .post('/api/v1/auth/register')
        .send(payload)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Registration completed successfully.',
        data: {
          user: {
            email: payload.email,
            firstName: payload.firstname,
            lastName: payload.lastname,
          },
          organisation: {
            name: payload.organisationName,
            email: payload.organisationEmail,
            slug: expect.any(String),
          },
          membership: {
            role: RoleEnum.ORG_ADMIN,
            status: 'ACTIVE',
          },
        },
      });

      const userId = response.body.data.user.id;
      const organisationId = response.body.data.organisation.id;

      expect(userId).toEqual(expect.any(String));
      expect(organisationId).toEqual(expect.any(String));

      // Verify the user and profile were actually persisted.
      const user = await dataSource.getRepository(UserEntity).findOne({
        where: { id: userId },
        relations: {
          profile: true,
        },
      });

      expect(user).not.toBeNull();
      expect(user?.email).toBe(payload.email);
      expect(user?.isActive).toBe(true);
      expect(user?.acceptTerms).toBe(true);
      expect(user?.profile).toBeDefined();

      // Password must be hashed, not stored as plaintext.
      expect(user?.password).not.toBe(payload.password);
      expect(user?.password).toBeTruthy();

      const passwordIsValid = await passwordService.verify(
        user!.password!,
        payload.password,
      );

      expect(passwordIsValid).toBe(true);

      // Verify the organisation and ownership relations.
      const organisation = await dataSource
        .getRepository(OrganisationEntity)
        .findOne({
          where: { id: organisationId },
          relations: {
            owner: true,
            creator: true,
          },
        });

      expect(organisation).not.toBeNull();
      expect(organisation?.name).toBe(payload.organisationName);
      expect(organisation?.email).toBe(payload.organisationEmail);
      expect(organisation?.slug).toBe(response.body.data.organisation.slug);
      expect(organisation?.owner.id).toBe(userId);
      expect(organisation?.creator.id).toBe(userId);

      // Verify the active ORG_ADMIN membership.
      const membership = await dataSource
        .getRepository(OrganisationMembershipEntity)
        .findOne({
          where: {
            user: { id: userId },
            organisation: { id: organisationId },
          },
          relations: {
            user: true,
            organisation: true,
            role: true,
          },
        });

      expect(membership).not.toBeNull();
      expect(membership?.status).toBe('ACTIVE');
      expect(membership?.role.name).toBe(RoleEnum.ORG_ADMIN);
      expect(membership?.user.id).toBe(userId);
      expect(membership?.organisation.id).toBe(organisationId);

      // Verify the initial ownership history.
      const ownershipHistory = await dataSource
        .getRepository(OrganisationOwnershipHistoryEntity)
        .findOne({
          where: {
            organisation: { id: organisationId },
          },
          relations: {
            organisation: true,
            previousOwner: true,
            newOwner: true,
          },
        });

      expect(ownershipHistory).not.toBeNull();
      expect(ownershipHistory?.previousOwner).toBeNull();
      expect(ownershipHistory?.newOwner.id).toBe(userId);
      expect(ownershipHistory?.reason).toBe(
        'Initial organisation registration',
      );

      // Registration must not create an authenticated session.
      const sessionCount = await dataSource
        .getRepository(UserSessionEntity)
        .count({
          where: {
            user: { id: userId },
          },
        });

      expect(sessionCount).toBe(0);

      // Registration must not return authentication tokens.
      expect(response.body.data.accessToken).toBeUndefined();
      expect(response.headers['x-refresh-token']).toBeUndefined();
    });

    it('should reject an already registered user email', async () => {
      const originalPayload = createRegistrationPayload();

      await http
        .post('/api/v1/auth/register')
        .send(originalPayload)
        .expect(201);

      const duplicatePayload = createRegistrationPayload();

      duplicatePayload.email = originalPayload.email;

      await http
        .post('/api/v1/auth/register')
        .send(duplicatePayload)
        .expect(400);

      // The second registration must not create another user.
      const userCount = await dataSource.getRepository(UserEntity).count({
        where: { email: originalPayload.email },
      });

      expect(userCount).toBe(1);
    });

    it('should reject an already registered organisation email', async () => {
      const originalPayload = createRegistrationPayload();

      await http
        .post('/api/v1/auth/register')
        .send(originalPayload)
        .expect(201);

      const duplicatePayload = createRegistrationPayload();

      duplicatePayload.organisationEmail = originalPayload.organisationEmail;

      await http
        .post('/api/v1/auth/register')
        .send(duplicatePayload)
        .expect(400);

      // The failed registration must not persist its user.
      const userCount = await dataSource.getRepository(UserEntity).count({
        where: { email: duplicatePayload.email },
      });

      expect(userCount).toBe(0);
    });

    it('should reject an invalid email address', async () => {
      const payload = createRegistrationPayload();

      payload.email = 'invalid-email';

      await http.post('/api/v1/auth/register').send(payload).expect(400);
    });

    it('should reject a weak password', async () => {
      const payload = createRegistrationPayload();

      payload.password = 'password';
      payload.confirmPassword = 'password';

      await http.post('/api/v1/auth/register').send(payload).expect(400);
    });

    it('should reject mismatched password confirmation', async () => {
      const payload = createRegistrationPayload();

      payload.confirmPassword = 'DifferentPassword123#';

      await http.post('/api/v1/auth/register').send(payload).expect(400);
    });

    it('should reject registration when terms are not accepted', async () => {
      const payload = createRegistrationPayload();

      payload.acceptTerms = false;

      await http.post('/api/v1/auth/register').send(payload).expect(400);
    });

    it('should reject a missing organisation name', async () => {
      const payload = createRegistrationPayload();

      delete (payload as Partial<typeof payload>).organisationName;

      await http.post('/api/v1/auth/register').send(payload).expect(400);
    });

    it('should reject a missing organisation email', async () => {
      const payload = createRegistrationPayload();

      delete (payload as Partial<typeof payload>).organisationEmail;

      await http.post('/api/v1/auth/register').send(payload).expect(400);
    });

    it('should generate different slugs for organisations with the same name', async () => {
      const firstPayload = createRegistrationPayload();
      const secondPayload = createRegistrationPayload();

      firstPayload.organisationName = 'Johnson Technologies';
      secondPayload.organisationName = 'Johnson TechnologieS';

      const firstResponse = await http
        .post('/api/v1/auth/register')
        .send(firstPayload)
        .expect(201);

      const secondResponse = await http
        .post('/api/v1/auth/register')
        .send(secondPayload)
        .expect(201);

      const firstSlug = firstResponse.body.data.organisation.slug;
      const secondSlug = secondResponse.body.data.organisation.slug;

      expect(firstSlug).toBe('johnson-technologies');
      expect(secondSlug).toBe('johnson-technologies-1');
      expect(firstSlug).not.toBe(secondSlug);
    });

    it('should reject unexpected properties', async () => {
      const payload = {
        ...createRegistrationPayload(),
        isAdmin: true,
      };

      await http.post('/api/v1/auth/register').send(payload).expect(400);
    });

    it('should reject registration when the organisation name already exists', async () => {
      const firstPayload = createRegistrationPayload();
      const secondPayload = createRegistrationPayload();

      secondPayload.organisationName = firstPayload.organisationName;

      await http.post('/api/v1/auth/register').send(firstPayload).expect(201);

      const secondResponse = await http
        .post('/api/v1/auth/register')
        .send(secondPayload)
        .expect(409);

      expect(secondResponse.body).toMatchObject({
        message: 'Organisation already exists',
      });
    });
  });
});
