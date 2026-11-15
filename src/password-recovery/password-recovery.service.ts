import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { createHash, randomBytes } from 'node:crypto';
import type { Response as ExResponse } from 'express';

import { UserEntity } from '@/user/user.entity';
import { PasswordService } from '@/password/password.service';
import { UserSessionService } from '@/user_sessions/user-session.service';

import { PASSWORD_RECOVERY } from './password-recovery.constants';
import { PasswordResetTokenEntity } from './password-recovery.entity';
import { PasswordRecoveryRateLimitService } from './password-recovery-rate-limit.service';
import { ApiResponseDto } from '@/commons/dtos/api-response.dto';
import { ForgotPasswordResponseDto } from './dto/forgot-password.dto';
import { handleServiceMethodError } from '@/commons/util/errorHandler';
import { PASSWORD_RESET_REVOKE_REASON } from '@/user_sessions/user-sessrion.constants';
import { ConfigService } from '@nestjs/config';
import { EmailOutboxService } from '@/email-outbox/email-outbox.service';
import { EmailTemplateService } from '@/email/email-template.service';
import { EmailEventTypeEnum } from '@/database/database.enums';

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
    private readonly configService: ConfigService,
    private readonly emailOutboxService: EmailOutboxService,
    private readonly emailTemplateService: EmailTemplateService,
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

      const existingUser = await this.userRepository.findOne({
        where: {
          email: normalizedEmail,
          isActive: true,
          isDeleted: false,
        },
      });

      if (!existingUser) {
        return new ForgotPasswordResponseDto({});
      }

      const rawToken = this.getPasswordToken();
      const tokenHash = this.hashToken(rawToken);

      const now = new Date();

      const expiresAt = new Date(
        now.getTime() + PASSWORD_RECOVERY.TOKEN_EXPIRY_MINUTES * 60 * 1000,
      );

      const resetUrl = new URL(
        '/reset-password',
        this.configService.getOrThrow<string>('APP_BASE_URL'),
      );

      resetUrl.searchParams.set('token', rawToken);

      await this.dataSource.transaction(async (manager) => {
        const tokenRepository = manager.getRepository(PasswordResetTokenEntity);

        const userRepository = manager.getRepository(UserEntity);

        // Lock the account so concurrent reset requests cannot
        // invalidate each other's tokens unpredictably.
        const user = await userRepository.findOne({
          where: {
            email: normalizedEmail,
            isActive: true,
            isDeleted: false,
          },
          lock: { mode: 'pessimistic_write' },
        });

        if (!user) {
          return;
        }

        // Revoke previously issued, unused reset tokens.
        await tokenRepository
          .createQueryBuilder()
          .update(PasswordResetTokenEntity)
          .set({ revokedAt: now })
          .where('user_id = :userId', { userId: user.id })
          .andWhere('used_at IS NULL')
          .andWhere('revoked_at IS NULL')
          .andWhere('purpose = :purpose', {
            purpose: EmailEventTypeEnum.PASSWORD_RESET,
          })
          .execute();

        // Store only the SHA-256 hash of the raw token.
        const resetToken = tokenRepository.create({
          user: { id: user.id } as UserEntity,
          tokenHash,
          expiresAt,
          usedAt: null,
          revokedAt: null,
          requestedFromIp: ipAddress,
          purpose: EmailEventTypeEnum.PASSWORD_RESET,
        });

        await tokenRepository.save(resetToken);

        // Create the email payload using the existing template.
        const emailPayload = this.emailTemplateService.createPasswordResetEmail(
          {
            recipientEmail: user.email,
            recipientName: user.firstName ?? undefined,
            actionUrl: resetUrl.toString(),
            expiresIn: `${PASSWORD_RECOVERY.TOKEN_EXPIRY_MINUTES} minutes`,
          },
        );

        // Encrypt and persist the email in this same transaction.
        await this.emailOutboxService.create(
          manager,
          EmailEventTypeEnum.PASSWORD_RESET,
          emailPayload,
        );
      });

      // The dispatcher will pick up the PENDING outbox record
      // and enqueue it for BullMQ processing.
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
        where: { tokenHash, purpose: EmailEventTypeEnum.PASSWORD_RESET },
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
        existingToken.expiresAt <= now ||
        existingToken.purpose !== EmailEventTypeEnum.PASSWORD_RESET
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
          where: {
            id: existingToken.id,
            purpose: EmailEventTypeEnum.PASSWORD_RESET,
          },
          lock: { mode: 'pessimistic_write' },
        });

        const transactionTime = new Date();

        if (
          !resetToken ||
          resetToken.usedAt ||
          resetToken.revokedAt ||
          resetToken.expiresAt <= transactionTime ||
          resetToken.purpose !== EmailEventTypeEnum.PASSWORD_RESET
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
          .andWhere('purpose = :purpose', {
            purpose: EmailEventTypeEnum.PASSWORD_RESET,
          })
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
