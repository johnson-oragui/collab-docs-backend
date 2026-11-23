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
import { PermissionEntity } from '@/permissions/permissions.entity';
import { RoleEntity } from '@/roles/roles.entity';
import { OrganisationAuditEntity } from '@/organisation_audit/organisation_audit.entity';
import { OrganisationOwnershipHistoryEntity } from '@/organisation-ownership-history/organisation-ownership-history.entity';
import { UserSessionEntity } from '@/user_sessions/user-session.entity';
import { UserSessionTokenEntity } from '@/user-session-token/user-session-token.entity';
import { EmailVerificationService } from '@/email-verification/email-verification.service';
import {
  OrganisationMembershipStatusEnum,
  RoleEnum,
  TRoleEnum,
} from '@/database/database.enums';
import { OrganisationAuditEventEnum } from '@/commons/enums';
import { PasswordService } from '@/password/password.service';
import { snakeCaseToCamelcase } from '@/commons/util/snakeCaseToCamelcase';
import { uuidv7 } from 'uuidv7';

describe('Membership-Permissions (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof createHttpClient>;
  let dataSource: DataSource;
  let emailVerificationService: EmailVerificationService;
  let passwordService: PasswordService;

  let ownerPayload: ReturnType<typeof createRegistrationPayload>;
  let ownerUserId: string;
  let ownerOrgId: string;
  let ownerAccessToken: string;
  let getTokenSpy: jest.SpyInstance;

  let targetMemberId: string;
  let targetMembershipId: string;

  let secondOrgId: string;
  let secondUserId: string;
  let secondOrgAccessToken: string;

  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];

  const createRegistrationPayload = (prefix = 'perm-admin') => {
    const uniqueId = randomUUID().replace(/-/g, '');
    return {
      email: `${prefix}-${uniqueId}@example.com`,
      password: 'StrongPassword123#',
      confirmPassword: 'StrongPassword123#',
      acceptTerms: true,
      firstname: 'Ada',
      lastname: 'Lovelace',
      organisationName: `Perm Org ${uniqueId}`,
      organisationDescription: 'Membership permissions E2E test org.',
      organisationEmail: `perm-org-${uniqueId}@example.com`,
    };
  };

  const registerVerifyAndLogin = async (prefix: string) => {
    const payload = createRegistrationPayload(prefix);
    const token = randomBytes(32).toString('base64url');
    getTokenSpy.mockReturnValueOnce(token);

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
      passwordHash: regRes.body.data.user.passwordHash as string,
      accessToken: loginRes.body.data.accessToken as string,
    };
  };

  /**
   * Create memberhips without no permissions
   *
   */
  const createMemberInOrg = async (
    orgId: string,
    roleName: TRoleEnum,
    passwordHash: string,
  ) => {
    const userRepo = dataSource.getRepository(UserEntity);
    const membershipRepo = dataSource.getRepository(
      OrganisationMembershipEntity,
    );
    const roleRepo = dataSource.getRepository(RoleEntity);

    const role = await roleRepo.findOne({ where: { name: roleName } });
    if (!role) {
      throw new Error(`Role ${roleName} not seeded in test database`);
    }

    const email = `member-${roleName.toLowerCase()}-${randomUUID().slice(0, 8)}@example.com`;
    const user = await userRepo.save(
      userRepo.create({
        email,
        firstName: 'Test',
        lastName: 'Member',
        password: await passwordService.hash(passwordHash),
        emailVerifiedAt: new Date(),
        isActive: true,
        acceptTerms: true,
      }),
    );
    createdUserIds.push(user.id);

    const membership = await membershipRepo.save(
      membershipRepo.create({
        user: { id: user.id } as UserEntity,
        organisation: { id: orgId } as OrganisationEntity,
        role,
        status: OrganisationMembershipStatusEnum.ACTIVE,
      }),
    );

    return { userId: user.id, membershipId: membership.id };
  };

  beforeAll(async () => {
    app = await createE2eApp();
    http = createHttpClient(app);
    dataSource = app.get(DataSource);
    emailVerificationService = app.get(EmailVerificationService);
    passwordService = app.get(PasswordService);

    ownerPayload = createRegistrationPayload('perm-owner');
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

    const targetMember = await createMemberInOrg(
      ownerOrgId,
      RoleEnum.ORG_MEMBER,
      ownerPayload.password,
    );
    targetMemberId = targetMember.userId;
    targetMembershipId = targetMember.membershipId;

    const secondAccount = await registerVerifyAndLogin('perm-other-org');
    secondOrgId = secondAccount.orgId;
    secondUserId = secondAccount.userId;
    secondOrgAccessToken = secondAccount.accessToken;
    void targetMemberId;
    void secondUserId;
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

  describe('Authentication & Guards', () => {
    it('should return 401 when adding permissions without authorization token', async () => {
      const res = await http
        .post(`organisation-memberships/${targetMembershipId}/permissions`)
        .send({ permissions: { document: { read: true } } });

      expect(res.statusCode).toBe(401);
    });

    it('should return 401 when removing permissions without authorization token', async () => {
      const res = await http
        .patch(`organisation-memberships/${targetMembershipId}/permissions`)
        .send({ permissions: { document: { read: true } } });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('Add Membership Permissions', () => {
    it('should add allowed role permissions, persist rows, and record an audit log', async () => {
      const roleWithPerms = await dataSource.getRepository(RoleEntity).findOne({
        where: { name: RoleEnum.ORG_MEMBER },
        relations: { permissions: true },
      });
      const allowedPermName = roleWithPerms?.permissions?.[0]?.name;
      expect(allowedPermName).toBeDefined();

      const [category, action] = allowedPermName!.split(':');

      // targetMembershipId added without a permision

      const res = await http
        .post(`organisation-memberships/${targetMembershipId}/permissions`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          permissions: {
            [snakeCaseToCamelcase(category)]: { [action]: true },
          },
        })
        .expect(201);

      expect(res.body.success).toBe(true);

      const persisted = await dataSource
        .getRepository(MembershipPermissionEntity)
        .find({
          where: { membership: { id: targetMembershipId } },
          relations: { permission: true },
        });

      // ensure assigned permission matches
      expect(
        persisted.some((mp) => mp.permission?.name === allowedPermName),
      ).toBe(true);

      const audits = await dataSource
        .getRepository(OrganisationAuditEntity)
        .find({
          where: {
            organisation: { id: ownerOrgId },
            eventType:
              OrganisationAuditEventEnum.MEMBERSHIP_PERMISSIONS_UPDATED,
          },
          order: { createdAt: 'DESC' },
        });

      expect(audits.length).toBeGreaterThanOrEqual(1);
      expect(audits[0].metadata).toMatchObject({
        action: 'ADD',
        membershipId: targetMembershipId,
      });
    });

    it('should return 404 when adding permissions to a non-existent membership', async () => {
      const res = await http
        .post(`organisation-memberships/${uuidv7()}/permissions`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          permissions: { document: { read: true } },
        });

      expect(res.statusCode).toBe(404);
    });

    it('should reject cross-organisation membership permission changes', async () => {
      const res = await http
        .post(`organisation-memberships/${targetMembershipId}/permissions`)
        .set('Authorization', `Bearer ${secondOrgAccessToken}`)
        .send({
          permissions: { document: { read: true } },
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe('Organisation membership not found');
    });

    it('should return 400 when attempting to assign a permission outside the member role', async () => {
      const roleWithPerms = await dataSource.getRepository(RoleEntity).findOne({
        where: { name: RoleEnum.ORG_MEMBER },
        relations: { permissions: true },
      });
      const assignedNames = new Set(
        (roleWithPerms?.permissions ?? []).map((p) => p.name),
      );
      const allPerms = await dataSource.getRepository(PermissionEntity).find();
      const disallowedPerm = allPerms.find((p) => !assignedNames.has(p.name));

      const [category, action] = disallowedPerm!.name.split(':');
      const res = await http
        .post(`organisation-memberships/${targetMembershipId}/permissions`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          permissions: {
            [snakeCaseToCamelcase(category)]: { [action]: true },
          },
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe(
        'Permission "delete documentInvitation" is not permitted for role "ORG_MEMBER"',
      );
    });

    it('should return 400 when adding permissions to a SUSPENDED membership', async () => {
      const membershipRepo = dataSource.getRepository(
        OrganisationMembershipEntity,
      );
      await membershipRepo.update(targetMembershipId, {
        status: OrganisationMembershipStatusEnum.SUSPENDED,
        suspendedTill: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const res = await http
        .post(`organisation-memberships/${targetMembershipId}/permissions`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          permissions: { document: { read: true } },
        });

      await membershipRepo.update(targetMembershipId, {
        status: OrganisationMembershipStatusEnum.ACTIVE,
        suspendedTill: null,
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe(
        'Cannot modify permissions for a suspended membership',
      );
    });
  });

  describe('Remove Membership Permissions', () => {
    it('should remove existing membership permissions and record an audit log', async () => {
      const roleWithPerms = await dataSource.getRepository(RoleEntity).findOne({
        where: { name: RoleEnum.ORG_MEMBER },
        relations: { permissions: true },
      });
      const permName = roleWithPerms?.permissions?.[0]?.name;
      expect(permName).toBeDefined();

      const [category, action] = permName!.split(':');

      // ensure permission is present first
      await http
        .post(`organisation-memberships/${targetMembershipId}/permissions`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          permissions: { [snakeCaseToCamelcase(category)]: { [action]: true } },
        })
        .expect(201);

      // then delete permission
      const delRes = await http
        .patch(`organisation-memberships/${targetMembershipId}/permissions`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          permissions: { [category]: { [action]: true } },
        })
        .expect(201);

      expect(delRes.body.success).toBe(true);

      const remaining = await dataSource
        .getRepository(MembershipPermissionEntity)
        .find({
          where: { membership: { id: targetMembershipId } },
          relations: { permission: true },
        });

      expect(remaining.some((mp) => mp.permission?.name === permName)).toBe(
        false,
      );

      const audits = await dataSource
        .getRepository(OrganisationAuditEntity)
        .find({
          where: {
            organisation: { id: ownerOrgId },
            eventType:
              OrganisationAuditEventEnum.MEMBERSHIP_PERMISSIONS_UPDATED,
          },
          order: { createdAt: 'DESC' },
        });

      expect(audits[0].metadata).toMatchObject({
        action: 'REMOVE',
        membershipId: targetMembershipId,
      });
    });

    it('should return 404 when removing permissions from a non-existent membership', async () => {
      const res = await http
        .patch(`organisation-memberships/${uuidv7()}/permissions`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          permissions: { document: { read: true } },
        });

      expect(res.statusCode).toBe(404);
    });

    it('should return 400 when no permissions are provided to remove', async () => {
      const res = await http
        .patch(`organisation-memberships/${targetMembershipId}/permissions`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          permissions: {},
        });

      expect(res.statusCode).toBe(400);
    });
  });
});
