import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordResetTokenEntity } from './password-recovery.entity';
import { UserEntity } from '@/user/user.entity';
import { PasswordRecoveryService } from './password-recovery.service';
import { UserSessionModule } from '@/user_sessions/user-session.module';
import { UserSessionEntity } from '@/user_sessions/user-session.entity';
import { UserSessionTokenEntity } from '@/user-session-token/user-session-token.entity';
import { PasswordRecoveryRateLimitService } from './password-recovery-rate-limit.service';
import { PasswordModule } from '@/password/password.module';
import { RedisModule } from '@/redis/redis.module';
import { PasswordRecoveryController } from './password-recovery.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PasswordResetTokenEntity,
      UserEntity,
      UserSessionEntity,
      UserSessionTokenEntity,
    ]),
    UserSessionModule,
    PasswordModule,
    RedisModule,
  ],
  controllers: [PasswordRecoveryController],
  exports: [PasswordRecoveryService],
  providers: [PasswordRecoveryService, PasswordRecoveryRateLimitService],
})
export class PasswordResetModule {}
