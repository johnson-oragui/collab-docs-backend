import { INestApplication } from '@nestjs/common';

import { createE2eApp } from '@/test/fixtures/create-e2e-app';

import { generateRandomIPv4 } from '@/commons/util/generateRandomIPv4';
import { LoginRateLimitService } from '@/login-lockout/login-rate-limit.service';

describe('TEST LoginRateLimitService', () => {
  let app: INestApplication;

  let loginRateLimitService: LoginRateLimitService;

  beforeAll(async () => {
    app = await createE2eApp();

    loginRateLimitService = app.get(LoginRateLimitService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should allow the first request and increment the request counter', async () => {
    const ipAddress = generateRandomIPv4();

    const result = await loginRateLimitService.consumeLoginRequest(ipAddress);

    expect(result).toEqual(
      expect.objectContaining({
        allowed: true,
        requestCount: 1,
        remainingRequests: 29,
      }),
    );

    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(900);
  });

  it('should allow 30 requests and reject the 31st request', async () => {
    const ipAddress = generateRandomIPv4();

    let result = await loginRateLimitService.consumeLoginRequest(ipAddress);

    expect(result.allowed).toBe(true);
    expect(result.requestCount).toBe(1);

    // Requests 2 through 30 should also be allowed.
    for (let requestNumber = 2; requestNumber <= 30; requestNumber++) {
      result = await loginRateLimitService.consumeLoginRequest(ipAddress);

      expect(result.allowed).toBe(true);
      expect(result.requestCount).toBe(requestNumber);
      expect(result.remainingRequests).toBe(30 - requestNumber);
    }

    // Request 31 should be rejected.
    result = await loginRateLimitService.consumeLoginRequest(ipAddress);

    expect(result.allowed).toBe(false);
    expect(result.requestCount).toBe(31);
    expect(result.remainingRequests).toBe(0);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(900);
  });

  it('should maintain independent request counters for different IP addresses', async () => {
    const firstIpAddress = generateRandomIPv4();
    const secondIpAddress = generateRandomIPv4();

    // Consume 10 requests from the first IP.
    for (let requestNumber = 0; requestNumber < 10; requestNumber++) {
      await loginRateLimitService.consumeLoginRequest(firstIpAddress);
    }

    // The second IP should still start with a fresh counter.
    const result =
      await loginRateLimitService.consumeLoginRequest(secondIpAddress);

    expect(result.allowed).toBe(true);
    expect(result.requestCount).toBe(1);
    expect(result.remainingRequests).toBe(29);
  });
});
