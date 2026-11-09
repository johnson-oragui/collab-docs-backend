import { TestingModule } from '@nestjs/testing';
import { DataSource, In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';

import { UserEntity } from '@/user/user.entity';
import { UserSessionEntity } from '@/user_sessions/user-session.entity';
import { UserSessionTokenEntity } from '@/user-session-token/user-session-token.entity';
import { UserSessionTokenStatusEnum } from '@/database/database.enums';
import { createSessionTestingModule } from '@/test/fixtures/create-session-testing-module';
import { OrganisationEntity } from '@/organisations/organisations.entity';

describe('UserSessionEntity and UserSessionTokenEntity', () => {
  let module: TestingModule;
  let dataSource: DataSource;

  let userRepository: Repository<UserEntity>;
  let sessionRepository: Repository<UserSessionEntity>;
  let tokenRepository: Repository<UserSessionTokenEntity>;
  let organisationRepository: Repository<OrganisationEntity>;

  const userIds: string[] = [];
  const sessionIds: string[] = [];
  const tokenIds: string[] = [];
  const organisationIds: string[] = [];

  beforeAll(async () => {
    const testingModule = await createSessionTestingModule();

    module = testingModule.module;
    dataSource = testingModule.dataSource;

    userRepository = dataSource.getRepository(UserEntity);
    organisationRepository = dataSource.getRepository(OrganisationEntity);

    sessionRepository =
      dataSource.getRepository<UserSessionEntity>(UserSessionEntity);

    tokenRepository = dataSource.getRepository<UserSessionTokenEntity>(
      UserSessionTokenEntity,
    );
  });

  afterEach(async () => {
    if (tokenIds.length) {
      await tokenRepository.delete({ id: In([...tokenIds]) });
      tokenIds.length = 0;
    }

    if (sessionIds.length) {
      await sessionRepository.delete({ id: In([...sessionIds]) });
      sessionIds.length = 0;
    }

    if (organisationIds.length) {
      await organisationRepository.delete({ id: In([...organisationIds]) });
      organisationIds.length = 0;
    }

    if (userIds.length) {
      await userRepository.delete({ id: In([...userIds]) });
      userIds.length = 0;
    }
  });

  afterAll(async () => {
    await module.close();
  });

  async function createUser(): Promise<UserEntity> {
    const savedUser = await userRepository.save(
      userRepository.create({
        email: `session-test-${randomUUID()}@example.com`,
        firstName: 'Session',
        lastName: 'Test',
        password: null,
        requestId: null,
      }),
    );

    userIds.push(
      Array.isArray(savedUser)
        ? savedUser?.[0]?.id
        : (savedUser as UserEntity).id,
    );

    return Array.isArray(savedUser) ? savedUser?.[0] : savedUser;
  }

  async function createOrg(user: UserEntity) {
    const organisation = await organisationRepository.save(
      organisationRepository.create({
        name: `Acme ${randomUUID()} X2w`,
        slug: `acme-${randomUUID()}-cds`,
        owner: user,
        creator: user,
        email: `test-${randomUUID()}@collabdocs.com`,
      }),
    );

    organisationIds.push(organisation.id);

    return organisation;
  }

  async function createSession(
    user: UserEntity,
    organisation: OrganisationEntity,
  ): Promise<UserSessionEntity> {
    const session = sessionRepository.create({
      user,
      deviceName: 'Linux Desktop',
      userAgent: 'Mozilla/5.0',
      ipAddress: '127.0.0.1',
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      revokedAt: null,
      revokeReason: null,
      organisation,
    });

    const savedSession = await sessionRepository.save(session);

    sessionIds.push(savedSession.id);

    return savedSession;
  }

  async function createToken(
    session: UserSessionEntity,
    tokenHash = randomUUID(),
  ): Promise<UserSessionTokenEntity> {
    const token = tokenRepository.create({
      session,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      usedAt: null,
      replacedByTokenId: null,
    });

    const savedToken = await tokenRepository.save(token);

    tokenIds.push(savedToken.id);

    return savedToken;
  }

  describe('UserSessionEntity', () => {
    it('should create and persist a user session', async () => {
      const user = await createUser();
      const org = await createOrg(user);

      const session = await createSession(user, org);

      expect(session.id).toBeDefined();
      expect(session.expiresAt).toBeInstanceOf(Date);
      expect(session.revokedAt).toBeNull();
      expect(session.revokeReason).toBeNull();
    });

    it('should associate a session with its user', async () => {
      const user = await createUser();

      const org = await createOrg(user);

      const session = await createSession(user, org);

      const foundSession = await sessionRepository.findOne({
        where: { id: session.id },
        relations: { user: true },
      });

      expect(foundSession).not.toBeNull();
      expect(foundSession?.user.id).toBe(user.id);
      expect(foundSession?.user.email).toBe(user.email);
    });

    it('should allow nullable session metadata', async () => {
      const user = await createUser();
      const organisation = await createOrg(user);

      const session = sessionRepository.create({
        user,
        deviceName: null,
        userAgent: null,
        ipAddress: null,
        lastUsedAt: null,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        revokedAt: null,
        revokeReason: null,
        organisation,
      });

      const savedSession = await sessionRepository.save(session);

      sessionIds.push(savedSession.id);

      expect(savedSession.deviceName).toBeNull();
      expect(savedSession.userAgent).toBeNull();
      expect(savedSession.ipAddress).toBeNull();
      expect(savedSession.lastUsedAt).toBeNull();
      expect(savedSession.organisation.id).not.toBeNull();
    });

    it('should allow a user to have multiple sessions', async () => {
      const user = await createUser();
      const org = await createOrg(user);

      const firstSession = await createSession(user, org);
      const secondSession = await createSession(user, org);

      const sessions = await sessionRepository.find({
        where: { user: { id: user.id } },
      });

      expect(sessions).toHaveLength(2);
      expect(sessions.map((session) => session.id)).toEqual(
        expect.arrayContaining([firstSession.id, secondSession.id]),
      );
    });

    it('should prevent deleting a user that has sessions', async () => {
      const user = await createUser();
      const org = await createOrg(user);

      await createSession(user, org);

      await expect(userRepository.delete(user.id)).rejects.toThrow();
    });
  });

  // --------------------------------------------------
  // UserSessionTokenEntity tests
  // --------------------------------------------------

  describe('UserSessionTokenEntity', () => {
    it('should create and persist a session token', async () => {
      const user = await createUser();
      const org = await createOrg(user);

      const session = await createSession(user, org);

      const token = await createToken(session);

      expect(token.id).toBeDefined();
      expect(token.tokenHash).toBeDefined();
      expect(token.expiresAt).toBeInstanceOf(Date);
      expect(token.usedAt).toBeNull();
      expect(token.replacedByTokenId).toBeNull();
    });

    it('should default token status to ACTIVE', async () => {
      const user = await createUser();
      const org = await createOrg(user);

      const session = await createSession(user, org);

      const token = await createToken(session);

      expect(token.status).toBe(UserSessionTokenStatusEnum.ACTIVE);
    });

    it('should associate a token with its session', async () => {
      const user = await createUser();
      const org = await createOrg(user);

      const session = await createSession(user, org);

      const token = await createToken(session);

      const foundToken = await tokenRepository.findOne({
        where: { id: token.id },
        relations: {
          session: {
            user: true,
          },
        },
      });

      expect(foundToken).not.toBeNull();
      expect(foundToken?.session.id).toBe(session.id);
      expect(foundToken?.session.user.id).toBe(user.id);
    });

    it('should enforce unique token hashes', async () => {
      const user = await createUser();
      const org = await createOrg(user);

      const session = await createSession(user, org);

      const tokenHash = randomUUID();

      await createToken(session, tokenHash);

      const duplicateToken = tokenRepository.create({
        session,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: null,
        replacedByTokenId: null,
      });

      await expect(tokenRepository.save(duplicateToken)).rejects.toThrow();
    });

    it('should prevent deleting a session that has tokens', async () => {
      const user = await createUser();
      const org = await createOrg(user);

      const session = await createSession(user, org);

      await createToken(session);

      await expect(sessionRepository.delete(session.id)).rejects.toThrow();
    });

    it('should allow separate sessions to have separate active tokens', async () => {
      const user = await createUser();
      const org = await createOrg(user);

      const firstSession = await createSession(user, org);
      const secondSession = await createSession(user, org);

      const firstToken = await createToken(firstSession);
      const secondToken = await createToken(secondSession);

      expect(firstToken.status).toBe(UserSessionTokenStatusEnum.ACTIVE);
      expect(secondToken.status).toBe(UserSessionTokenStatusEnum.ACTIVE);
      expect(firstToken.session.id).not.toBe(secondToken.session.id);
    });
  });
});
