import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, In, IsNull, MoreThan } from 'typeorm';
import { createHash, randomBytes } from 'crypto';

import { UserSessionEntity } from './user-session.entity';
import { Repository } from 'typeorm';
import { UserSessionTokenEntity } from '@/user-session-token/user-session-token.entity';
import { UserSessionTokenStatusEnum } from '@/database/database.enums';
import {
  ICreateUserSessionInput,
  ICreateUserSessionResult,
  IRotateRefreshTokenResult,
} from './user-session.interface';
import { UserEntity } from '@/user/user.entity';
import { OrganisationEntity } from '@/organisations/organisations.entity';

const MAX_ACTIVE_SESSIONS = 5;

const SESSION_LIMIT_REVOKE_REASON = 'SESSION_LIMIT';

const REFRESH_TOKEN_REUSE_REVOKE_REASON = 'REFRESH_TOKEN_REUSE';

const LOGOUT_REVOKE_REASON = 'LOGOUT';

const LOGOUT_ALL_REVOKE_REASON = 'LOGOUT_ALL';

@Injectable()
export class UserSessionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    @InjectRepository(UserSessionEntity)
    private readonly sessionRepository: Repository<UserSessionEntity>,

    @InjectRepository(UserSessionTokenEntity)
    private readonly sessionTokenRepository: Repository<UserSessionTokenEntity>,
  ) {}

  /**
   * Creates a new user session.
   *
   * Enforces the maximum number of active sessions per user.
   * If the user already has five active sessions, the least
   * recently used session is revoked before the new one is created.
   */
  async createSession(
    input: ICreateUserSessionInput,
  ): Promise<ICreateUserSessionResult> {
    return this.dataSource.transaction(async (manager) => {
      const userRepository = manager.getRepository(UserEntity);
      const sessionRepository = manager.getRepository(UserSessionEntity);
      const sessionTokenRepository = manager.getRepository(
        UserSessionTokenEntity,
      );

      // lock the user row to serialize concurrent session creation
      // requests for the same user.
      const user = await userRepository.findOne({
        where: {
          id: input.userId,
          isDeleted: false,
          organisationMemberships: {
            organisation: { id: input.organisationId },
          },
        },
        lock: {
          mode: 'pessimistic_write',
        },
      });

      if (!user) {
        throw new HttpException(
          { message: 'User not found', successs: false },
          404,
        );
      }

      const now = new Date();

      // find all currently active sessions for this user.
      const activeSessions = await sessionRepository
        .createQueryBuilder('session')
        .where('session.user_id = :userId', {
          userId: user.id,
        })
        .andWhere('session.revoked_at IS NULL')
        .andWhere('session.expires_at > :now', {
          now,
        })
        .andWhere('session.is_deleted = false')
        .orderBy('session.last_used_at', 'ASC', 'NULLS FIRST')
        .addOrderBy('session.created_at', 'ASC')
        .getMany();

      // if the user has reached the limit, revoke the least
      // recently used active session.
      if (activeSessions.length >= MAX_ACTIVE_SESSIONS) {
        const leastRecentlyUsedSession = activeSessions[0];

        await sessionRepository.update(
          {
            id: leastRecentlyUsedSession.id,
          },
          {
            revokedAt: now,
            revokeReason: SESSION_LIMIT_REVOKE_REASON,
          },
        );

        // revoke any active refresh tokens belonging to that session.
        await sessionTokenRepository.update(
          {
            session: {
              id: leastRecentlyUsedSession.id,
            },
            status: UserSessionTokenStatusEnum.ACTIVE,
            isDeleted: false,
          },
          {
            status: UserSessionTokenStatusEnum.REVOKED,
          },
        );
      }

      // create the new session.
      const refreshTokenExpiry = this.getRefreshTokenExpiry(now);

      const session = sessionRepository.create({
        user,
        deviceName: input.deviceName ?? null,
        userAgent: input.userAgent ?? null,
        ipAddress: input.ipAddress ?? null,
        lastUsedAt: now,
        expiresAt: refreshTokenExpiry,
        revokedAt: null,
        revokeReason: null,
        organisation: { id: input.organisationId } as OrganisationEntity,
      });

      const savedSession = await sessionRepository.save(session);

      const refreshToken = this.generateRefreshToken();

      const sessionToken = sessionTokenRepository.create({
        session: savedSession,
        tokenHash: this.hashRefreshToken(refreshToken),
        status: UserSessionTokenStatusEnum.ACTIVE,
        expiresAt: savedSession.expiresAt,
        usedAt: null,
        replacedByTokenId: null,
      });

      await sessionTokenRepository.save(sessionToken);

      return {
        sessionId: savedSession.id,
        refreshToken,
        expiresAt: savedSession.expiresAt,
      };
    });
  }

  /**
   * Revokes one session belonging to the specified user.
   *
   * The session ID must belong to the user making the request.
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const sessionRepository = manager.getRepository(UserSessionEntity);
      const sessionTokenRepository = manager.getRepository(
        UserSessionTokenEntity,
      );

      // lock the active tokens first.
      const activeTokens = await sessionTokenRepository
        .createQueryBuilder('token')
        .where('token.session_id = :sessionId', { sessionId })
        .andWhere('token.status = :status', {
          status: UserSessionTokenStatusEnum.ACTIVE,
        })
        .andWhere('token.is_deleted = false')
        .setLock('pessimistic_write')
        .getMany();

      // checking user ownership prevents one user from revoking another
      // user's session by supplying its ID.
      const session = await sessionRepository.findOne({
        where: {
          id: sessionId,
          user: { id: userId },
          isDeleted: false,
        },
        lock: {
          mode: 'pessimistic_write',
        },
      });

      if (!session) {
        throw new HttpException({ message: 'Session not found' }, 404);
      }

      // return if alread logged out. repeatedd logout requests are harmless.
      if (session.revokedAt) {
        return;
      }

      const now = new Date();

      session.revokedAt = now;
      session.revokeReason = LOGOUT_REVOKE_REASON;

      await sessionRepository.save(session);

      // revoke all active refresh tokens belonging to this session.
      if (activeTokens.length > 0) {
        await sessionTokenRepository.update(
          {
            id: In(activeTokens.map((token) => token.id)),
            status: UserSessionTokenStatusEnum.ACTIVE,
            isDeleted: false,
          },
          {
            status: UserSessionTokenStatusEnum.REVOKED,
          },
        );
      }
    });
  }

  async isSessionActive(userId: string, sessionId: string): Promise<boolean> {
    const session = await this.sessionRepository.findOne({
      where: {
        id: sessionId,
        user: {
          id: userId,
        },
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
        isDeleted: false,
      },
      select: {
        id: true,
      },
    });

    return Boolean(session);
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const sessionRepository = manager.getRepository(UserSessionEntity);
      const sessionTokenRepository = manager.getRepository(
        UserSessionTokenEntity,
      );

      // lock all active refresh tokens belonging to the user's sessions.
      const activeTokens = await sessionTokenRepository
        .createQueryBuilder('token')
        .innerJoin('token.session', 'session')
        .where('session.user_id = :userId', { userId })
        .andWhere('session.is_deleted = false')
        .andWhere('token.status = :status', {
          status: UserSessionTokenStatusEnum.ACTIVE,
        })
        .andWhere('token.is_deleted = false')
        .orderBy('token.id', 'ASC')
        .setLock('pessimistic_write', undefined, ['token'])
        .getMany();

      // lock all sessions belonging to this user that haven't been revoked.
      const sessions = await sessionRepository
        .createQueryBuilder('session')
        .where('session.user_id = :userId', { userId })
        .andWhere('session.is_deleted = false')
        .andWhere('session.revoked_at IS NULL')
        .orderBy('session.id', 'ASC')
        .setLock('pessimistic_write')
        .getMany();

      const now = new Date();

      // revoke every unrevoked session.
      for (const session of sessions) {
        session.revokedAt = now;
        session.revokeReason = LOGOUT_ALL_REVOKE_REASON;
      }

      if (sessions.length > 0) {
        await sessionRepository.save(sessions);
      }

      // revoke all active refresh tokens.
      if (activeTokens.length > 0) {
        await sessionTokenRepository.update(
          {
            id: In(activeTokens.map((token) => token.id)),
            status: UserSessionTokenStatusEnum.ACTIVE,
            isDeleted: false,
          },
          {
            status: UserSessionTokenStatusEnum.REVOKED,
          },
        );
      }
    });
  }

  async rotateRefreshToken(
    presentedRefreshToken: string,
  ): Promise<IRotateRefreshTokenResult> {
    if (!presentedRefreshToken) {
      throw new HttpException({ message: 'Invalid refresh token' }, 401);
    }

    const tokenHash = this.hashRefreshToken(presentedRefreshToken);

    const transactionResult = await this.dataSource.transaction(
      async (manager) => {
        const sessionTokenRepository = manager.getRepository(
          UserSessionTokenEntity,
        );

        const sessionRepository = manager.getRepository(UserSessionEntity);

        const now = new Date();

        // lock the presented token row.
        // a concurrent request attempting to rotate the same token must wait.
        const existingToken = await sessionTokenRepository
          .createQueryBuilder('token')
          .innerJoinAndSelect('token.session', 'session')
          .where('token.tokenHash = :tokenHash', { tokenHash })
          .andWhere('token.isDeleted = :isDeleted', { isDeleted: false })
          .setLock('pessimistic_write', undefined, ['token'])
          .getOne();

        if (!existingToken) {
          throw new HttpException({ message: 'Invalid refresh token' }, 401);
        }

        // lock the associated session as well.
        const session = await sessionRepository.findOne({
          where: {
            id: existingToken.session.id,
            isDeleted: false,
          },
          lock: {
            mode: 'pessimistic_write',
          },
        });

        if (!session) {
          throw new HttpException({ message: 'Invalid refresh token' }, 401);
        }

        // a used token has already been rotated.
        // Its presentation again indicates possible token theft or replay.
        if (existingToken.status === UserSessionTokenStatusEnum.USED) {
          session.revokedAt = session.revokedAt ?? now;
          session.revokeReason = REFRESH_TOKEN_REUSE_REVOKE_REASON;

          await sessionRepository.save(session);

          // revoke every token belonging to this session,
          // including the current and previously used tokens.
          await sessionTokenRepository
            .createQueryBuilder()
            .update(UserSessionTokenEntity)
            .set({
              status: UserSessionTokenStatusEnum.REVOKED,
            })
            .where('"session_id" = :sessionId', {
              sessionId: session.id,
            })
            .andWhere('"is_deleted" = false')
            .execute();

          // return instead of throwing here. in-order to allows the transaction to commit the revocation.
          return {
            kind: 'reused' as const,
          };
        }

        // a token that is not ACTIVE cannot be rotated.
        if (existingToken.status !== UserSessionTokenStatusEnum.ACTIVE) {
          throw new HttpException({ message: 'Invalid refresh token' }, 401);
        }

        // check both token and session expiration.
        if (
          existingToken.expiresAt <= now ||
          session.expiresAt <= now ||
          session.revokedAt !== null
        ) {
          throw new HttpException(
            { message: 'Refresh token expired or revoked' },
            401,
          );
        }

        const newRefreshToken = this.generateRefreshToken();

        const replacementToken = sessionTokenRepository.create({
          session,
          tokenHash: this.hashRefreshToken(newRefreshToken),
          status: UserSessionTokenStatusEnum.ACTIVE,
          expiresAt: session.expiresAt,
          usedAt: null,
          replacedByTokenId: null,
        });

        const savedReplacementToken =
          await sessionTokenRepository.save(replacementToken);

        // mark the old token as USED and link it to its replacement.
        existingToken.status = UserSessionTokenStatusEnum.USED;
        existingToken.usedAt = now;
        existingToken.replacedByTokenId = savedReplacementToken.id;

        await sessionTokenRepository.save(existingToken);

        session.lastUsedAt = now;

        await sessionRepository.save(session);

        return {
          kind: 'rotated' as const,
          result: {
            sessionId: session.id,
            refreshToken: newRefreshToken,
            expiresAt: session.expiresAt,
          },
        };
      },
    );

    // the transaction has committed before throwing this 401.
    if (transactionResult.kind === 'reused') {
      throw new HttpException(
        { message: 'Refresh token reuse detected. Session revoked.' },
        401,
      );
    }

    return transactionResult.result;
  }

  private generateRefreshToken(): string {
    return randomBytes(64).toString('base64url');
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  /**
   * Calculates the refresh-token/session expiration date.
   *
   * Supported duration formats: s, m, h, d, w, y.
   * Examples: 900s, 15m, 12h, 30d.
   */
  private getRefreshTokenExpiry(now: Date): Date {
    const expiry = this.configService.get<string>('REFRESH_JWT_EXPIRY', '30d');

    const match = /^(\d+)\s*(s|m|h|d|w|y)$/i.exec(expiry.trim());

    if (!match) {
      throw new Error(`Invalid REFRESH_JWT_EXPIRY value: ${expiry}`);
    }

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();

    const milliseconds: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
      w: 7 * 24 * 60 * 60 * 1000,
      y: 365 * 24 * 60 * 60 * 1000,
    };

    return new Date(now.getTime() + amount * milliseconds[unit]);
  }
}
