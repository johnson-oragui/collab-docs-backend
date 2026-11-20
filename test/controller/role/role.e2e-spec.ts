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

describe('ROLES and PERMISSIONS (e2e)', () => {
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

  it('should return the roles with permissions', async () => {
    const response = await http
      .get('roles-permissions')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    // console.log(JSON.stringify(response.body.data));

    expect(response.body.data).toEqual([
      {
        id: expect.any(String),
        name: 'APP_SUPER_ADMIN',
        description: 'Super administrator with full application access',
        permissions: {
          document: { create: true, delete: true, update: true, read: true },
          documentComment: {
            create: true,
            delete: true,
            update: true,
            read: true,
          },
          documentInvitation: {
            create: true,
            delete: true,
            update: true,
            read: true,
          },
          externalDocumentInvitation: {
            create: true,
            delete: true,
            update: true,
            read: true,
          },
          organisation: {
            create: true,
            delete: true,
            update: true,
            read: true,
          },
          organisationInvitation: {
            create: true,
            delete: true,
            update: true,
            read: true,
          },
          organisationMembership: {
            create: true,
            delete: true,
            update: true,
            read: true,
          },
          organisationChat: {
            create: true,
            delete: true,
            update: true,
            read: true,
          },
          platformMember: {
            delete: true,
            create: true,
            update: true,
            read: true,
          },
          memberOrganisation: {
            create: true,
            delete: true,
            update: true,
            read: true,
          },
          admin: { create: true, delete: true, update: true, read: true },
          member: { create: true, delete: true, update: true, read: true },
          role: { create: true, delete: true, update: true, read: true },
          audit: { read: true },
        },
      },
      {
        id: expect.any(String),
        name: 'ORG_SUB_ADMIN',
        description:
          'Organization sub-administrator managing members, roles, and documents',
        permissions: {
          document: { create: true, delete: true, update: true, read: true },
          documentComment: {
            create: true,
            delete: true,
            update: true,
            read: true,
          },
          documentInvitation: {
            create: true,
            delete: false,
            update: true,
            read: true,
          },
          externalDocumentInvitation: {
            create: true,
            delete: false,
            update: true,
            read: true,
          },
          organisation: {
            create: false,
            delete: false,
            update: false,
            read: true,
          },
          organisationInvitation: {
            create: true,
            delete: false,
            update: true,
            read: true,
          },
          organisationMembership: {
            create: true,
            delete: true,
            update: true,
            read: true,
          },
          organisationChat: {
            create: true,
            delete: true,
            update: true,
            read: true,
          },
          platformMember: {
            delete: false,
            create: false,
            update: false,
            read: false,
          },
          memberOrganisation: {
            create: false,
            delete: false,
            update: false,
            read: false,
          },
          admin: { create: false, delete: false, update: false, read: false },
          member: { create: false, delete: false, update: false, read: false },
          role: { create: false, delete: false, update: false, read: true },
          audit: { read: false },
        },
      },
      {
        id: expect.any(String),
        name: 'ORG_MEMBER',
        description:
          'Standard organization member with read/write access to documents',
        permissions: {
          document: { create: true, delete: true, update: true, read: true },
          documentComment: {
            create: true,
            delete: true,
            update: true,
            read: true,
          },
          documentInvitation: {
            create: true,
            delete: false,
            update: true,
            read: true,
          },
          externalDocumentInvitation: {
            create: false,
            delete: false,
            update: false,
            read: true,
          },
          organisation: {
            create: false,
            delete: false,
            update: false,
            read: true,
          },
          organisationInvitation: {
            create: false,
            delete: false,
            update: false,
            read: true,
          },
          organisationMembership: {
            create: false,
            delete: false,
            update: false,
            read: true,
          },
          organisationChat: {
            create: true,
            delete: false,
            update: true,
            read: true,
          },
          platformMember: {
            delete: false,
            create: false,
            update: false,
            read: false,
          },
          memberOrganisation: {
            create: false,
            delete: false,
            update: false,
            read: false,
          },
          admin: { create: false, delete: false, update: false, read: false },
          member: { create: false, delete: false, update: false, read: false },
          role: { create: false, delete: false, update: false, read: true },
          audit: { read: false },
        },
      },
      {
        id: expect.any(String),
        name: 'ORG_ADMIN',
        description:
          'Organization administrator managing members, roles, and documents',
        permissions: {
          document: { create: true, delete: true, update: true, read: true },
          documentComment: {
            create: true,
            delete: true,
            update: true,
            read: true,
          },
          documentInvitation: {
            create: true,
            delete: true,
            update: true,
            read: true,
          },
          externalDocumentInvitation: {
            create: true,
            delete: true,
            update: true,
            read: true,
          },
          organisation: {
            create: false,
            delete: false,
            update: false,
            read: true,
          },
          organisationInvitation: {
            create: true,
            delete: true,
            update: true,
            read: true,
          },
          organisationMembership: {
            create: true,
            delete: true,
            update: true,
            read: true,
          },
          organisationChat: {
            create: true,
            delete: true,
            update: true,
            read: true,
          },
          platformMember: {
            delete: false,
            create: false,
            update: false,
            read: false,
          },
          memberOrganisation: {
            create: false,
            delete: false,
            update: false,
            read: false,
          },
          admin: { create: false, delete: false, update: false, read: false },
          member: { create: false, delete: false, update: false, read: false },
          role: { create: false, delete: false, update: false, read: true },
          audit: { read: true },
        },
      },
    ]);
  });
});
