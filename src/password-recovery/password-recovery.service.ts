import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { createHash, randomBytes } from 'node:crypto';
import type { Response as ExResponse } from 'express';

import { UserEntity } from '@/user/user.entity';
import { PasswordService } from '@/password/password.service';
import { UserSessionService } from '@/user_sessions/user-session.service';

import {
  PASSWORD_RECOVERY,
  PASSWORD_RESET_REVOKE_REASON,
} from './password-recovery.constants';
import { PasswordResetTokenEntity } from './password-recovery.entity';
import { PasswordRecoveryRateLimitService } from './password-recovery-rate-limit.service';
import { ApiResponseDto } from '@/commons/dtos/api-response.dto';
import { ForgotPasswordResponseDto } from './dto/forgot-password.dto';
import { handleServiceMethodError } from '@/commons/util/errorHandler';

@Injectable()
export class PasswordRecoveryService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,

    @InjectRepository(PasswordResetTokenEntity)
    private readonly passwordResetTokenRepository: Repository<PasswordResetTokenEntity>,

    private readonly passwordService: PasswordService,
    private readonly userSessionService: UserSessionService,
    private readonly passwordRecoveryRateLimitService: PasswordRecoveryRateLimitService,
  ) {}

  async requestPasswordReset(
    email: string,
    ipAddress: string,
    response: ExResponse,
  ): Promise<ForgotPasswordResponseDto> {
    try {
      const normalizedEmail = email.trim().toLowerCase();

      const rateLimit =
        await this.passwordRecoveryRateLimitService.consumeRequest(
          normalizedEmail,
          ipAddress,
        );

      if (!rateLimit.allowed) {
        response.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));

        throw new HttpException(
          {
            message:
              'Too many password reset requests. Please try again later.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const user = await this.userRepository.findOne({
        where: {
          email: normalizedEmail,
          isActive: true,
          isDeleted: false,
        },
      });

      if (!user) {
        return new ForgotPasswordResponseDto({});
      }

      const rawToken = this.getPasswordToken();
      // Logging the raw token here for testing. remove when email sending is implemented
      console.log('++++++++++rawToken: ', rawToken);

      const tokenHash = this.hashToken(rawToken);

      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + PASSWORD_RECOVERY.TOKEN_EXPIRY_MINUTES * 60 * 1000,
      );

      await this.dataSource.transaction(async (manager) => {
        const tokenRepository = manager.getRepository(PasswordResetTokenEntity);
        const userRepository = manager.getRepository(UserEntity);

        const user = await userRepository.findOne({
          where: {
            email: normalizedEmail,
            isActive: true,
            isDeleted: false,
          },
          lock: { mode: 'pessimistic_write' },
        });

        if (!user) {
          return new ForgotPasswordResponseDto({});
        }

        // A new request invalidates previously issued, unused tokens.
        await tokenRepository
          .createQueryBuilder()
          .update(PasswordResetTokenEntity)
          .set({ revokedAt: now })
          .where('user_id = :userId', { userId: user.id })
          .andWhere('used_at IS NULL')
          .andWhere('revoked_at IS NULL')
          .execute();

        const resetToken = tokenRepository.create({
          user: { id: user.id } as UserEntity,
          tokenHash,
          expiresAt,
          usedAt: null,
          revokedAt: null,
          requestedFromIp: ipAddress,
        });

        await tokenRepository.save(resetToken);
      });

      /*
       * TODO: (email):
       * Send the password-reset link using the future email service.
       *
       * The raw token is available here only for constructing the link.
       * Never persist it, return it from this method, or log it.
       *
       * await this.emailService.sendPasswordResetEmail({
       *   recipient: normalizedEmail,
       *   resetToken: rawToken,
       * });
       */
      return new ForgotPasswordResponseDto({});
    } catch (error) {
      return handleServiceMethodError(
        error,
        'Could not initiate password recovery',
      );
    }
  }

  async resetPassword(
    rawToken: string,
    newPassword: string,
  ): Promise<ApiResponseDto<{ status: string }>> {
    try {
      const tokenHash = this.hashToken(rawToken);

      // Preliminary lookup avoids performing an expensive password hash
      // for obviously invalid tokens. The token is rechecked under lock.
      const existingToken = await this.passwordResetTokenRepository.findOne({
        where: { tokenHash },
        relations: { user: true },
      });

      if (!existingToken) {
        throw new HttpException(
          { message: 'Invalid or expired reset token.' },
          400,
        );
      }

      const now = new Date();

      if (
        existingToken.usedAt ||
        existingToken.revokedAt ||
        existingToken.expiresAt <= now
      ) {
        throw new HttpException(
          { message: 'Invalid or expired reset token.' },
          400,
        );
      }

      if (existingToken.user.password) {
        const passwordsIdentical = await this.passwordService.verify(
          existingToken.user.password,
          newPassword,
        );
        if (passwordsIdentical) {
          throw new HttpException(
            { message: 'Old password cannot be reused!' },
            409,
          );
        }
      }

      const passwordHash = await this.passwordService.hash(newPassword);

      await this.dataSource.transaction(async (manager) => {
        const tokenRepository = manager.getRepository(PasswordResetTokenEntity);

        const userRepository = manager.getRepository(UserEntity);

        // Lock the account before changing its password.
        const user = await userRepository.findOne({
          where: { id: existingToken.user.id },
          lock: { mode: 'pessimistic_write' },
        });

        if (!user || !user.isActive || user.isDeleted) {
          throw new HttpException(
            { message: 'Invalid or expired reset token.' },
            400,
          );
        }

        // Lock and revalidate the token to prevent concurrent reuse.
        const resetToken = await tokenRepository.findOne({
          where: { id: existingToken.id },
          lock: { mode: 'pessimistic_write' },
        });

        const transactionTime = new Date();

        if (
          !resetToken ||
          resetToken.usedAt ||
          resetToken.revokedAt ||
          resetToken.expiresAt <= transactionTime
        ) {
          throw new HttpException(
            { message: 'Invalid or expired reset token.' },
            400,
          );
        }

        user.password = passwordHash;
        await userRepository.save(user);

        // Consume this token.
        resetToken.usedAt = transactionTime;
        await tokenRepository.save(resetToken);

        // Revoke all other outstanding reset tokens for this account.
        await tokenRepository
          .createQueryBuilder()
          .update(PasswordResetTokenEntity)
          .set({ revokedAt: transactionTime })
          .where('user_id = :userId', { userId: user.id })
          .andWhere('id != :tokenId', { tokenId: resetToken.id })
          .andWhere('used_at IS NULL')
          .andWhere('revoked_at IS NULL')
          .execute();

        // Revoke sessions and refresh tokens in this same transaction.
        await this.userSessionService.revokeAllSessionsWithManager(
          manager,
          user.id,
          PASSWORD_RESET_REVOKE_REASON,
        );
      });

      return new ApiResponseDto<{
        status: string;
      }>({ data: { status: 'successful' } });
    } catch (error) {
      return handleServiceMethodError(error, 'Could not reset password');
    }
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
  private getPasswordToken() {
    return randomBytes(PASSWORD_RECOVERY.TOKEN_BYTES).toString('base64url');
  }
}
