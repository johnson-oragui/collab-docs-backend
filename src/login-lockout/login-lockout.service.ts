import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';

import { RedisService } from '@/redis/redis.service';
import { LOGIN_LOCKOUT } from './login-lockout.constants';
import {
  ILoginFailureResult,
  ILoginLockoutStatus,
} from './login-lockout.interface';

@Injectable()
export class LoginLockoutService {
  constructor(private readonly redisService: RedisService) {}

  private getIdentifierHash(email: string): string {
    return createHash('sha256')
      .update(email.trim().toLowerCase())
      .digest('hex');
  }

  private getKeys(email: string, ipAddress: string) {
    const emailHash = this.getIdentifierHash(email);
    const ipHash = this.getIdentifierHash(ipAddress);

    const prefix = `${LOGIN_LOCKOUT.KEY_PREFIX}:ip-account`;
    const identifier = `${ipHash}:${emailHash}`;

    return {
      failures: `${prefix}:failures:${identifier}`,
      lockout: `${prefix}:lockout:${identifier}`,
      level: `${prefix}:lockout-level:${identifier}`,
    };
  }

  async getLockoutStatus(
    email: string,
    ipAddress: string,
  ): Promise<ILoginLockoutStatus> {
    const { lockout } = this.getKeys(email, ipAddress);
    const client = this.redisService.getClient();

    const remainingMilliseconds = await client.pTTL(lockout);

    return {
      isLocked: remainingMilliseconds > 0,
      remainingSeconds:
        remainingMilliseconds > 0 ? Math.ceil(remainingMilliseconds / 1000) : 0,
    };
  }

  async recordFailedAttempt(
    email: string,
    ipAddress: string,
  ): Promise<ILoginFailureResult> {
    const keys = this.getKeys(email, ipAddress);
    const client = this.redisService.getClient();

    const script = `
      local failuresKey = KEYS[1]
      local lockoutKey = KEYS[2]
      local levelKey = KEYS[3]

      local maxAttempts = tonumber(ARGV[1])
      local failureWindow = tonumber(ARGV[2])
      local levelTtl = tonumber(ARGV[3])
      local durationsCount = tonumber(ARGV[4])

      local currentLockoutTtl = redis.call('PTTL', lockoutKey)

      if currentLockoutTtl > 0 then
        return {0, 1, 0, math.ceil(currentLockoutTtl / 1000)}
      end

      local failedAttempts = redis.call('INCR', failuresKey)

      if failedAttempts == 1 then
        redis.call('EXPIRE', failuresKey, failureWindow)
      end

      if failedAttempts < maxAttempts then
        return {failedAttempts, 0, 0, 0}
      end

      local previousLevel = tonumber(redis.call('GET', levelKey) or '0')
      local nextLevel = math.min(previousLevel + 1, durationsCount)

      local lockoutDuration = tonumber(ARGV[4 + nextLevel])

      redis.call('SET', levelKey, nextLevel, 'EX', levelTtl)
      redis.call('SET', lockoutKey, '1', 'EX', lockoutDuration)
      redis.call('DEL', failuresKey)

      return {0, 1, nextLevel, lockoutDuration}
    `;

    const durations = LOGIN_LOCKOUT.LOCKOUT_DURATIONS_MINUTES.map(
      (minutes) => minutes * 60,
    );

    const result = (await client.eval(script, {
      keys: [keys.failures, keys.lockout, keys.level],
      arguments: [
        String(LOGIN_LOCKOUT.MAX_FAILED_ATTEMPTS),
        String(LOGIN_LOCKOUT.FAILURE_WINDOW_SECONDS),
        String(LOGIN_LOCKOUT.LOCKOUT_LEVEL_TTL_SECONDS),
        String(durations.length),
        ...durations.map(String),
      ],
    })) as number[];

    return {
      failedAttempts: Number(result[0]),
      lockoutTriggered: Number(result[1]) === 1,
      lockoutLevel: Number(result[2]),
      lockoutDurationSeconds: Number(result[3]),
    };
  }

  async resetLockout(email: string, ipAddress: string): Promise<void> {
    const keys = this.getKeys(email, ipAddress);
    const client = this.redisService.getClient();

    await client.del([keys.failures, keys.lockout, keys.level]);
  }
}
