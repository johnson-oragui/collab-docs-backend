import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { UserEntity } from '@/user/user.entity';
import { PasswordResetTokenEntity } from '@/password-recovery/password-recovery.entity';
import { EmailEventTypeEnum } from '@/database/database.enums';
import { EmailOutboxService } from '@/email-outbox/email-outbox.service';
import { EmailTemplateService } from '@/email/email-template.service';
import { handleServiceMethodError } from '@/commons/util/errorHandler';
import { VerifyEmailResponseDto } from './dto/verify-email.dto';

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(PasswordResetTokenEntity)
    private readonly tokenRepository: Repository<PasswordResetTokenEntity>,

    private readonly configService: ConfigService,
    private readonly emailOutboxService: EmailOutboxService,
    private readonly emailTemplateService: EmailTemplateService,
  ) {}

  /**
   * Creates a verification token and encrypted email outbox record.
   *
   * Must be called with the registration transaction's EntityManager
   * so that user registration, token creation, and email outbox
   * creation either all succeed or all roll back.
   */
  async createVerificationRequest(
    manager: EntityManager,
    user: UserEntity,
  ): Promise<void> {
    const now = new Date();

    const expiryHours = this.configService.getOrThrow<number>(
      'EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS',
    );

    const rawToken = this.getToken();
    const tokenHash = this.hashToken(rawToken);

    const expiresAt = new Date(now.getTime() + expiryHours * 60 * 60 * 1000);

    const tokenRepository = manager.getRepository(PasswordResetTokenEntity);

    // Revoke previous unused verification tokens for this user.
    await tokenRepository
      .createQueryBuilder()
      .update(PasswordResetTokenEntity)
      .set({ revokedAt: now })
      .where('user_id = :userId', { userId: user.id })
      .andWhere('purpose = :purpose', {
        purpose: EmailEventTypeEnum.EMAIL_VERIFICATION,
      })
      .andWhere('used_at IS NULL')
      .andWhere('revoked_at IS NULL')
      .execute();

    // Persist only the token hash.
    const verificationToken = tokenRepository.create({
      user: { id: user.id } as UserEntity,
      tokenHash,
      purpose: EmailEventTypeEnum.EMAIL_VERIFICATION,
      expiresAt,
      usedAt: null,
      revokedAt: null,
      requestedFromIp: null,
    });

    await tokenRepository.save(verificationToken);

    const verificationUrl = new URL(
      '/verify-email?auth=register',
      this.configService.getOrThrow<string>('APP_BASE_URL'),
    );

    verificationUrl.searchParams.set('token', rawToken);

    const emailPayload = this.emailTemplateService.createEmailVerificationEmail(
      {
        recipientEmail: user.email,
        recipientName: user.firstName ?? undefined,
        actionUrl: verificationUrl.toString(),
        expiresIn: `${expiryHours} hours`,
      },
    );

    // The raw token exists only in the encrypted email payload.
    await this.emailOutboxService.create(
      manager,
      EmailEventTypeEnum.EMAIL_VERIFICATION,
      emailPayload,
    );
  }

  /**
   * Validates and consumes a single-use email verification token.
   */
  async verifyEmail(rawToken: string): Promise<VerifyEmailResponseDto> {
    try {
      if (!rawToken?.trim() || rawToken.length > 256) {
        throw new HttpException(
          { message: 'Invalid or expired verification token.' },
          HttpStatus.BAD_REQUEST,
        );
      }

      const tokenHash = this.hashToken(rawToken);

      // Preliminary lookup. The token and user are rechecked under
      // transaction locks before any account changes are made.
      const existingToken = await this.tokenRepository.findOne({
        where: {
          tokenHash,
          purpose: EmailEventTypeEnum.EMAIL_VERIFICATION,
        },
        relations: { user: true },
      });

      if (
        !existingToken ||
        existingToken.usedAt ||
        existingToken.revokedAt ||
        existingToken.expiresAt <= new Date()
      ) {
        throw new HttpException(
          { message: 'Invalid or expired verification token.' },
          HttpStatus.BAD_REQUEST,
        );
      }

      await this.dataSource.transaction(async (manager) => {
        const userRepository = manager.getRepository(UserEntity);
        const tokenRepository = manager.getRepository(PasswordResetTokenEntity);

        // Always lock the user before locking their tokens.
        const user = await userRepository.findOne({
          where: { id: existingToken.user.id },
          lock: { mode: 'pessimistic_write' },
        });

        if (!user || !user.isActive || user.isDeleted) {
          throw new HttpException(
            { message: 'Invalid or expired verification token.' },
            HttpStatus.BAD_REQUEST,
          );
        }

        // Recheck and lock the token to prevent concurrent consumption.
        const verificationToken = await tokenRepository.findOne({
          where: {
            id: existingToken.id,
            purpose: EmailEventTypeEnum.EMAIL_VERIFICATION,
          },
          lock: { mode: 'pessimistic_write' },
        });

        const transactionTime = new Date();

        if (
          !verificationToken ||
          verificationToken.usedAt ||
          verificationToken.revokedAt ||
          verificationToken.expiresAt <= transactionTime
        ) {
          throw new HttpException(
            { message: 'Invalid or expired verification token.' },
            HttpStatus.BAD_REQUEST,
          );
        }

        // Mark the account as verified.
        if (!user.emailVerifiedAt) {
          user.emailVerifiedAt = transactionTime;
          await userRepository.save(user);
        }

        // Consume this token.
        verificationToken.usedAt = transactionTime;
        await tokenRepository.save(verificationToken);

        // Revoke all other outstanding verification tokens.
        await tokenRepository
          .createQueryBuilder()
          .update(PasswordResetTokenEntity)
          .set({ revokedAt: transactionTime })
          .where('user_id = :userId', { userId: user.id })
          .andWhere('id != :tokenId', {
            tokenId: verificationToken.id,
          })
          .andWhere('purpose = :purpose', {
            purpose: EmailEventTypeEnum.EMAIL_VERIFICATION,
          })
          .andWhere('used_at IS NULL')
          .andWhere('revoked_at IS NULL')
          .execute();
      });

      return new VerifyEmailResponseDto({});
    } catch (error) {
      return handleServiceMethodError(error, 'Could not verify email address');
    }
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private getToken(): string {
    return randomBytes(32).toString('base64url');
  }
}
