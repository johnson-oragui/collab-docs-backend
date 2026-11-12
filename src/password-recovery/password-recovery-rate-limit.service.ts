import { createHash } from 'node:crypto';
import { Injectable, HttpException } from '@nestjs/common';

import { RedisService } from '@/redis/redis.service';

import { PASSWORD_RECOVERY } from './password-recovery.constants';
import { IPasswordRecoveryRateLimitResult } from './password-recovery.interface';

@Injectable()
export class PasswordRecoveryRateLimitService {
  constructor(private readonly redisService: RedisService) {}

  private hashIdentifier(identifier: string): string {
    return createHash('sha256')
      .update(identifier.trim().toLowerCase())
      .digest('hex');
  }

  private getKeys(email: string, ipAddress: string) {
    const ipHash = this.hashIdentifier(ipAddress);
    const emailHash = this.hashIdentifier(email);

    const prefix = PASSWORD_RECOVERY.KEY_PREFIX;

    return {
      ip: `${prefix}:ip:${ipHash}:requests`,
      ipAccount: `${prefix}:ip-account:${ipHash}:${emailHash}:requests`,
    };
  }

  async consumeRequest(
    email: string,
    ipAddress: string,
  ): Promise<IPasswordRecoveryRateLimitResult> {
    if (!ipAddress?.trim()) {
      throw new HttpException(
        { message: 'Unable to process password recovery at this time.' },
        503,
      );
    }

    const client = this.redisService.getClient();
    const keys = this.getKeys(email, ipAddress);

    const script = `
      local ipKey = KEYS[1]
      local ipAccountKey = KEYS[2]

      local ipMaxRequests = tonumber(ARGV[1])
      local ipWindowSeconds = tonumber(ARGV[2])

      local accountMaxRequests = tonumber(ARGV[3])
      local accountWindowSeconds = tonumber(ARGV[4])

      local ipCount = redis.call('INCR', ipKey)

      if ipCount == 1 then
        redis.call('EXPIRE', ipKey, ipWindowSeconds)
      end

      local accountCount = redis.call('INCR', ipAccountKey)

      if accountCount == 1 then
        redis.call('EXPIRE', ipAccountKey, accountWindowSeconds)
      end

      local allowed = 1
      local retryAfterSeconds = 0

      if ipCount > ipMaxRequests then
        allowed = 0

        local ttl = redis.call('TTL', ipKey)

        if ttl > retryAfterSeconds then
          retryAfterSeconds = ttl
        end
      end

      if accountCount > accountMaxRequests then
        allowed = 0

        local ttl = redis.call('TTL', ipAccountKey)

        if ttl > retryAfterSeconds then
          retryAfterSeconds = ttl
        end
      end

      return {
        allowed,
        ipCount,
        accountCount,
        retryAfterSeconds
        
      }
    `;

    const result = (await client.eval(script, {
      keys: [keys.ip, keys.ipAccount],
      arguments: [
        String(PASSWORD_RECOVERY.IP_RATE_LIMIT.MAX_REQUESTS),
        String(PASSWORD_RECOVERY.IP_RATE_LIMIT.WINDOW_SECONDS),
        String(PASSWORD_RECOVERY.IP_ACCOUNT_RATE_LIMIT.MAX_REQUESTS),
        String(PASSWORD_RECOVERY.IP_ACCOUNT_RATE_LIMIT.WINDOW_SECONDS),
      ],
    })) as number[];

    return {
      allowed: Number(result[0]) === 1,
      ipRequestCount: Number(result[1]),
      accountRequestCount: Number(result[2]),
      retryAfterSeconds: Number(result[3]),
    };
  }
}
