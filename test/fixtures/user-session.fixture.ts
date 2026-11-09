import { DataSource } from 'typeorm';

import { UserEntity } from '@/user/user.entity';
import { UserSessionEntity } from '@/user_sessions/user-session.entity';
import { UserSessionTokenEntity } from '@/user-session-token/user-session-token.entity';
import { UserSessionTokenStatusEnum } from '@/database/database.enums';

export async function createUserSessionFixture(dataSource: DataSource) {
  const uniqueId = () =>
    `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const id = uniqueId();

  const userRepository = dataSource.getRepository(UserEntity);
  const sessionRepository = dataSource.getRepository(UserSessionEntity);
  const tokenRepository = dataSource.getRepository(UserSessionTokenEntity);

  const user = await userRepository.save(
    userRepository.create({
      email: `session-test-${id}@collabdocs.com`,
      firstName: 'Johnson',
      lastName: 'Dennis',
    }),
  );

  const now = new Date();

  const session = await sessionRepository.save(
    sessionRepository.create({
      user,
      deviceName: 'Chrome on Linux',
      userAgent: 'Mozilla/5.0',
      ipAddress: '127.0.0.1',
      lastUsedAt: now,
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      revokedAt: null,
      revokeReason: null,
    }),
  );

  const token = await tokenRepository.save(
    tokenRepository.create({
      session,
      tokenHash: `test-token-hash-${id}`,
      status: UserSessionTokenStatusEnum.ACTIVE,
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      usedAt: null,
      replacedByTokenId: null,
    }),
  );

  return {
    user,
    session,
    token,
  };
}
