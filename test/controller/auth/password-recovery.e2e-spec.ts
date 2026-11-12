import { INestApplication } from '@nestjs/common';
import { DataSource, In, Repository } from 'typeorm';
import { createHash, randomUUID } from 'node:crypto';

import { createE2eApp } from '@/test/fixtures/create-e2e-app';
import { generateRandomIPv4 } from '@/commons/util/generateRandomIPv4';

import { UserEntity } from '@/user/user.entity';
import { PasswordRecoveryService } from '@/password-recovery/password-recovery.service';
import { PasswordResetTokenEntity } from '@/password-recovery/password-recovery.entity';
import { createHttpClient } from '@/test/fixtures/helpers/http-request';
import { PasswordService } from '@/password/password.service';
import { UserSessionService } from '@/user_sessions/user-session.service';
import { UserSessionTokenEntity } from '@/user-session-token/user-session-token.entity';
import { UserSessionEntity } from '@/user_sessions/user-session.entity';
import { OrganisationEntity } from '@/organisations/organisations.entity';
import {
  OrganisationMembershipStatusEnum,
  UserSessionTokenStatusEnum,
} from '@/database/database.enums';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { RoleEntity } from '@/roles/roles.entity';

describe('TEST PasswordRecovery (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let http: ReturnType<typeof createHttpClient>;

  let userRepository: Repository<UserEntity>;
  let passwordResetTokenRepository: Repository<PasswordResetTokenEntity>;

  let passwordRecoveryService: PasswordRecoveryService;

  let user: UserEntity;
  let passwordService: PasswordService;

  const initialPassword = 'ExistingPassword123!';
  const newPassword = 'NewSecurePassword123!';

  let originalPasswordHash: string;

  const rawToken = 'known-password-reset-token-for-testing';
  let organisationRepository: Repository<OrganisationEntity>;
  let organisationMembershipRepository: Repository<OrganisationMembershipEntity>;
  let sessionRepository: Repository<UserSessionEntity>;
  let sessionTokenRepository: Repository<UserSessionTokenEntity>;
  let roleRepository: Repository<RoleEntity>;

  let userSessionService: UserSessionService;

  const objectIDs: string[] = [];

  beforeAll(async () => {
    app = await createE2eApp();
    http = createHttpClient(app);

    dataSource = app.get(DataSource);

    userRepository = dataSource.getRepository<UserEntity>(UserEntity);
    passwordResetTokenRepository = dataSource.getRepository(
      PasswordResetTokenEntity,
    );

    organisationRepository = dataSource.getRepository(OrganisationEntity);
    sessionRepository = dataSource.getRepository(UserSessionEntity);
    sessionTokenRepository = dataSource.getRepository(UserSessionTokenEntity);
    organisationMembershipRepository = dataSource.getRepository(
      OrganisationMembershipEntity,
    );
    roleRepository = dataSource.getRepository(RoleEntity);

    userSessionService = app.get(UserSessionService);

    passwordRecoveryService = app.get(PasswordRecoveryService);
    passwordService = app.get(PasswordService);

    originalPasswordHash = await passwordService.hash(initialPassword);

    user = await userRepository.save(
      userRepository.create({
        email: `password-recovery-${randomUUID()}@example.com`,
        firstName: 'Recovery',
        lastName: 'Test',
        password: originalPasswordHash,
        requestId: null,
        isActive: true,
        acceptTerms: true,
      }),
    );
  });

  afterAll(async () => {
    await sessionTokenRepository.delete({
      session: { id: In(objectIDs) },
    });

    await sessionRepository.delete({
      id: In(objectIDs),
    });

    await organisationMembershipRepository.delete({ id: In(objectIDs) });
    await roleRepository.delete({ id: In(objectIDs) });
    await organisationRepository.delete({
      owner: { id: user.id },
    });
    if (user?.id) {
      await userRepository.delete({ id: user.id });
    }

    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    await passwordResetTokenRepository.delete({
      user: { id: user.id },
    });

    user.password = originalPasswordHash;
    await userRepository.save(user);
  });

  async function createPasswordResetToken(
    token: string,
    expiresAt = new Date(Date.now() + 15 * 60 * 1000),
  ): Promise<PasswordResetTokenEntity> {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    return passwordResetTokenRepository.save(
      passwordResetTokenRepository.create({
        user: { id: user.id } as UserEntity,
        tokenHash,
        expiresAt,
        usedAt: null,
        revokedAt: null,
        requestedFromIp: generateRandomIPv4(),
      }),
    );
  }

  it('should create and persist a hashed password-reset token', async () => {
    const getPasswordTokenSpy = jest
      .spyOn(passwordRecoveryService as any, 'getPasswordToken')
      .mockReturnValue(rawToken);

    const ipAddress = generateRandomIPv4();

    const response = await http
      .post('/api/v1/auth/password/forgot')
      .set('X-Forwarded-For', ipAddress)
      .send({
        email: user.email,
      });

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      success: true,
      data: { status: 'successful' },
      message:
        'If an account with that email exists, the password reset request has been accepted.',
    });

    expect(getPasswordTokenSpy).toHaveBeenCalledTimes(1);

    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const savedToken = await passwordResetTokenRepository.findOne({
      where: {
        tokenHash,
        user: { id: user.id },
      },
    });

    expect(savedToken).toBeDefined();
    expect(savedToken?.tokenHash).toBe(tokenHash);
    expect(savedToken?.tokenHash).not.toBe(rawToken);
    expect(savedToken?.usedAt).toBeNull();
    expect(savedToken?.revokedAt).toBeNull();
    expect(savedToken?.requestedFromIp).toBe(ipAddress);

    expect(savedToken?.expiresAt.getTime()).toBeGreaterThan(Date.now());

    // The raw token must never appear in the HTTP response.
    expect(JSON.stringify(response.body)).not.toContain(rawToken);

    getPasswordTokenSpy.mockClear();
    getPasswordTokenSpy.mockRestore();
  });

  it('should return the same response when the email does not exist', async () => {
    const getPasswordTokenSpy = jest
      .spyOn(passwordRecoveryService as any, 'getPasswordToken')
      .mockReturnValue(rawToken);

    const response = await http
      .post('/api/v1/auth/password/forgot')
      .set('X-Forwarded-For', generateRandomIPv4())
      .send({
        email: `unknown-${randomUUID()}@example.com`,
      });

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      success: true,
      data: { status: 'successful' },
      message:
        'If an account with that email exists, the password reset request has been accepted.',
    });

    // No token should be generated for an unknown account.
    expect(getPasswordTokenSpy).not.toHaveBeenCalled();

    getPasswordTokenSpy.mockRestore();
  });

  it('should reset the password and consume the reset token', async () => {
    await createPasswordResetToken(rawToken);

    const response = await http.post('auth/password/reset').send({
      token: rawToken,
      newPassword,
    });

    expect(response.status).toBe(200);

    const updatedUser = await userRepository.findOne({
      where: { id: user.id },
    });

    expect(updatedUser).toBeDefined();
    expect(updatedUser?.password).not.toBe(originalPasswordHash);

    expect(
      await passwordService.verify(updatedUser!.password!, newPassword),
    ).toBe(true);

    expect(
      await passwordService.verify(updatedUser!.password!, initialPassword),
    ).toBe(false);

    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const savedToken = await passwordResetTokenRepository.findOne({
      where: {
        tokenHash,
        user: { id: user.id },
      },
    });

    expect(savedToken?.usedAt).toBeInstanceOf(Date);
    expect(savedToken?.revokedAt).toBeNull();
  });

  it('should revoke other outstanding reset tokens after a successful reset', async () => {
    const firstToken = 'first-reset-token-for-testing';
    const secondToken = 'second-reset-token-for-testing';
    const thirdToken = 'third-reset-token-for-testing';

    await createPasswordResetToken(firstToken);
    await createPasswordResetToken(secondToken);
    await createPasswordResetToken(thirdToken);

    const response = await http.post('/api/v1/auth/password/reset').send({
      token: firstToken,
      newPassword,
    });

    expect(response.status).toBe(200);

    const firstTokenHash = createHash('sha256')
      .update(firstToken)
      .digest('hex');

    const secondTokenHash = createHash('sha256')
      .update(secondToken)
      .digest('hex');

    const thirdTokenHash = createHash('sha256')
      .update(thirdToken)
      .digest('hex');

    const savedTokens = await passwordResetTokenRepository.find({
      where: {
        user: { id: user.id },
      },
    });

    const savedFirstToken = savedTokens.find(
      (token) => token.tokenHash === firstTokenHash,
    );

    const savedSecondToken = savedTokens.find(
      (token) => token.tokenHash === secondTokenHash,
    );

    const savedThirdToken = savedTokens.find(
      (token) => token.tokenHash === thirdTokenHash,
    );

    expect(savedFirstToken?.usedAt).toBeInstanceOf(Date);
    expect(savedFirstToken?.revokedAt).toBeNull();

    expect(savedSecondToken?.revokedAt).toBeInstanceOf(Date);
    expect(savedThirdToken?.revokedAt).toBeInstanceOf(Date);

    expect(savedSecondToken?.usedAt).toBeNull();
    expect(savedThirdToken?.usedAt).toBeNull();
  });

  it('should reject an expired reset token', async () => {
    const expiredToken = 'expired-reset-token-for-testing';

    await createPasswordResetToken(
      expiredToken,
      new Date(Date.now() - 60 * 1000),
    );

    const response = await http.post('/api/v1/auth/password/reset').send({
      token: expiredToken,
      newPassword,
    });

    expect(response.status).toBe(400);

    const savedUser = await userRepository.findOne({
      where: { id: user.id },
    });

    expect(savedUser?.password).toBe(originalPasswordHash);
  });

  it('should reject an unknown reset token', async () => {
    const response = await http.post('/api/v1/auth/password/reset').send({
      token: 'unknown-reset-token',
      newPassword,
    });

    expect(response.status).toBe(400);

    const savedUser = await userRepository.findOne({
      where: { id: user.id },
    });

    expect(savedUser?.password).toBe(originalPasswordHash);
  });

  it('should reject a reset token that has already been used', async () => {
    await createPasswordResetToken(rawToken);

    const firstResponse = await http.post('/api/v1/auth/password/reset').send({
      token: rawToken,
      newPassword,
    });

    expect(firstResponse.status).toBe(200);

    const secondResponse = await http.post('/api/v1/auth/password/reset').send({
      token: rawToken,
      newPassword: 'AnotherSecurePassword123!',
    });

    expect(secondResponse.status).toBe(400);

    const savedUser = await userRepository.findOne({
      where: { id: user.id },
    });

    expect(
      await passwordService.verify(savedUser!.password!, newPassword),
    ).toBe(true);
  });

  it('should allow only one successful password reset when the same token is used concurrently', async () => {
    await createPasswordResetToken(rawToken);

    const [firstResponse, secondResponse] = await Promise.all([
      http.post('/api/v1/auth/password/reset').send({
        token: rawToken,
        newPassword,
      }),

      http.post('/api/v1/auth/password/reset').send({
        token: rawToken,
        newPassword: 'AnotherSecurePassword123!',
      }),
    ]);

    const statuses = [firstResponse.status, secondResponse.status].sort();

    expect(statuses).toEqual([200, 400]);

    const savedUser = await userRepository.findOne({
      where: { id: user.id },
    });

    const passwordIsFirst = await passwordService.verify(
      savedUser!.password!,
      newPassword,
    );

    const passwordIsSecond = await passwordService.verify(
      savedUser!.password!,
      'AnotherSecurePassword123!',
    );

    expect(passwordIsFirst || passwordIsSecond).toBe(true);
    expect(passwordIsFirst && passwordIsSecond).toBe(false);
  });

  it('should revoke all active sessions and refresh tokens after password reset', async () => {
    const getPasswordTokenSpy = jest
      .spyOn(passwordRecoveryService as any, 'getPasswordToken')
      .mockReturnValue(rawToken);

    const organisation = await organisationRepository.save(
      organisationRepository.create({
        name: `Recovery Test ${randomUUID()}`,
        slug: `recovery-test-${randomUUID()}`,
        owner: user,
        creator: user,
        email: `recovery-${randomUUID()}@collabdocs.com`,
      }),
    );
    objectIDs.push(organisation.id);
    let role = await roleRepository.findOne({ where: { name: 'ORG_ADMIN' } });
    if (!role) {
      role = await roleRepository.save(
        roleRepository.create({ name: 'ORG_ADMIN' }),
      );
    }
    objectIDs.push(role.id);
    const member = await organisationMembershipRepository.save(
      organisationMembershipRepository.create({
        organisation,
        role,
        status: OrganisationMembershipStatusEnum.ACTIVE,
        user,
      }),
    );
    objectIDs.push(member.id);

    const firstSession = await userSessionService.createSession({
      userId: user.id,
      organisationId: organisation.id,
      deviceName: 'Linux Desktop',
      userAgent: 'Mozilla/5.0',
      ipAddress: '127.0.0.1',
    });
    objectIDs.push(firstSession.sessionId);

    const secondSession = await userSessionService.createSession({
      userId: user.id,
      organisationId: organisation.id,
      deviceName: 'Mobile Device',
      userAgent: 'Mozilla/5.0 Mobile',
      ipAddress: '127.0.0.2',
    });
    objectIDs.push(secondSession.sessionId);

    const sessionIds = [firstSession.sessionId, secondSession.sessionId];

    const tokensBeforeReset = await sessionTokenRepository.find({
      where: {
        session: {
          id: In(sessionIds),
        },
      },
    });

    expect(tokensBeforeReset).toHaveLength(2);

    // Create a valid password-reset token.
    await createPasswordResetToken(rawToken);

    const response = await http.post('/api/v1/auth/password/reset').send({
      token: rawToken,
      newPassword: newPassword,
    });

    expect(response.status).toBe(200);

    // Verify that both sessions were revoked.
    const sessionsAfterReset = await sessionRepository.find({
      where: {
        id: In(sessionIds),
      },
    });

    expect(sessionsAfterReset).toHaveLength(2);

    for (const session of sessionsAfterReset) {
      expect(session.revokedAt).toBeInstanceOf(Date);
      expect(session.revokeReason).toBe('PASSWORD_RESET');
    }

    // Verify that both refresh tokens were revoked.
    const tokensAfterReset = await sessionTokenRepository.find({
      where: {
        session: {
          id: In(sessionIds),
        },
      },
    });

    expect(tokensAfterReset).toHaveLength(2);

    for (const token of tokensAfterReset) {
      expect(token.status).toBe(UserSessionTokenStatusEnum.REVOKED);
    }

    getPasswordTokenSpy.mockRestore();
  });
});
