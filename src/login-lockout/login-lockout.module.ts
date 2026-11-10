import { Module } from '@nestjs/common';

import { RedisModule } from '@/redis/redis.module';
import { LoginLockoutService } from './login-lockout.service';
import { LoginRateLimitService } from './login-rate-limit.service';

@Module({
  imports: [RedisModule],
  providers: [LoginLockoutService, LoginRateLimitService],
  exports: [LoginLockoutService, LoginRateLimitService],
})
export class LoginLockoutModule {}
