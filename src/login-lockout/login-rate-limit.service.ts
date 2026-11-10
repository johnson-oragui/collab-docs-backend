import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';

import { RedisService } from '@/redis/redis.service';
import { LOGIN_RATE_LIMIT } from './login-lockout.constants';
import { ILoginRateLimitResult } from './login-lockout.interface';

/**
 * This service counts every login request from an IP,
 * irrespective of the email address or whether the credentials are correct.
 */
@Injectable()
export class LoginRateLimitService {
  constructor(private readonly redisService: RedisService) {}

  private getIpHash(ipAddress: string): string {
    return createHash('sha256')
      .update(ipAddress.trim().toLowerCase())
      .digest('hex');
  }

  private getRateLimitKey(ipAddress: string): string {
    const ipHash = this.getIpHash(ipAddress);

    return `${LOGIN_RATE_LIMIT.KEY_PREFIX}:${ipHash}:requests`;
  }

  async consumeLoginRequest(ipAddress: string): Promise<ILoginRateLimitResult> {
    const client = this.redisService.getClient();
    const key = this.getRateLimitKey(ipAddress);

    const script = `
      local requestsKey = KEYS[1]

      local maxRequests = tonumber(ARGV[1])
      local windowSeconds = tonumber(ARGV[2])

      local requestCount = redis.call('INCR', requestsKey)

      if requestCount == 1 then
        redis.call('EXPIRE', requestsKey, windowSeconds)
      end

      local remainingMilliseconds = redis.call('PTTL', requestsKey)

      local remainingSeconds = 0

      if remainingMilliseconds > 0 then
        remainingSeconds = math.ceil(remainingMilliseconds / 1000)
      end

      local allowed = 0

      if requestCount <= maxRequests then
        allowed = 1
      end

      return {
        allowed,
        requestCount,
        math.max(0, maxRequests - requestCount),
        remainingSeconds
      }
    `;

    const result = (await client.eval(script, {
      keys: [key],
      arguments: [
        String(LOGIN_RATE_LIMIT.MAX_REQUESTS),
        String(LOGIN_RATE_LIMIT.WINDOW_SECONDS),
      ],
    })) as number[];

    return {
      allowed: Number(result[0]) === 1,
      requestCount: Number(result[1]),
      remainingRequests: Number(result[2]),
      retryAfterSeconds: Number(result[3]),
    };
  }
}
