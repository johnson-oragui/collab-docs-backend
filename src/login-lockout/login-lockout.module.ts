import { Module } from '@nestjs/common';

import { RedisModule } from '@/redis/redis.module';
import { LoginLockoutService } from './login-lockout.service';

@Module({
  imports: [RedisModule],
  providers: [LoginLockoutService],
  exports: [LoginLockoutService],
})
export class LoginLockoutModule {}
