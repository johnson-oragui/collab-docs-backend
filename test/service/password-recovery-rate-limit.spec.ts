import { INestApplication } from '@nestjs/common';

import { createE2eApp } from '@/test/fixtures/create-e2e-app';

import { generateRandomIPv4 } from '@/commons/util/generateRandomIPv4';
import { PasswordRecoveryRateLimitService } from '@/password-recovery/password-recovery-rate-limit.service';

describe('TEST PasswordRecoveryRateLimitService', () => {
  let app: INestApplication;

  let passwordRecoveryRateLimitService: PasswordRecoveryRateLimitService;

  beforeAll(async () => {
    app = await createE2eApp();

    passwordRecoveryRateLimitService = app.get(
      PasswordRecoveryRateLimitService,
    );
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should allow the first request and increment both request counters', async () => {
    const ipAddress = generateRandomIPv4();
    const email = `recovery-${crypto.randomUUID()}@example.com`;

    const result = await passwordRecoveryRateLimitService.consumeRequest(
      email,
      ipAddress,
    );
    // console.log(result);

    expect(result).toEqual(
      expect.objectContaining({
        allowed: true,
        ipRequestCount: 1,
        accountRequestCount: 1,
      }),
    );

    expect(result.retryAfterSeconds).not.toBeGreaterThan(0);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(3600);
  });

  it('should allow 5 requests from an IP and reject the 6th request', async () => {
    const ipAddress = generateRandomIPv4();

    let result = await passwordRecoveryRateLimitService.consumeRequest(
      `recovery-${crypto.randomUUID()}@example.com`,
      ipAddress,
    );

    expect(result.allowed).toBe(true);
    expect(result.ipRequestCount).toBe(1);

    // Requests 2 through 5 should also be allowed.
    for (let requestNumber = 2; requestNumber <= 5; requestNumber++) {
      result = await passwordRecoveryRateLimitService.consumeRequest(
        `recovery-${crypto.randomUUID()}@example.com`,
        ipAddress,
      );

      expect(result.allowed).toBe(true);
      expect(result.ipRequestCount).toBe(requestNumber);
    }

    // Request 6 should be rejected.
    result = await passwordRecoveryRateLimitService.consumeRequest(
      `recovery-${crypto.randomUUID()}@example.com`,
      ipAddress,
    );

    expect(result.allowed).toBe(false);
    expect(result.ipRequestCount).toBe(6);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(3600);
  });

  it('should allow 3 requests for the same IP and email combination and reject the 4th', async () => {
    const ipAddress = generateRandomIPv4();
    const email = `recovery-${crypto.randomUUID()}@example.com`;

    let result = await passwordRecoveryRateLimitService.consumeRequest(
      email,
      ipAddress,
    );

    expect(result.allowed).toBe(true);
    expect(result.accountRequestCount).toBe(1);

    // Requests 2 and 3 should also be allowed.
    for (let requestNumber = 2; requestNumber <= 3; requestNumber++) {
      result = await passwordRecoveryRateLimitService.consumeRequest(
        email,
        ipAddress,
      );

      expect(result.allowed).toBe(true);
      expect(result.accountRequestCount).toBe(requestNumber);
    }

    // Request 4 should be rejected.
    result = await passwordRecoveryRateLimitService.consumeRequest(
      email,
      ipAddress,
    );

    expect(result.allowed).toBe(false);
    expect(result.accountRequestCount).toBe(4);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(3600);
  });

  it('should maintain independent account counters for different IP addresses', async () => {
    const firstIpAddress = generateRandomIPv4();
    const secondIpAddress = generateRandomIPv4();
    const email = `recovery-${crypto.randomUUID()}@example.com`;

    // Consume 3 requests for the same email from the first IP.
    for (let requestNumber = 0; requestNumber < 3; requestNumber++) {
      await passwordRecoveryRateLimitService.consumeRequest(
        email,
        firstIpAddress,
      );
    }

    // The same email from a different IP should have a fresh account counter.
    const result = await passwordRecoveryRateLimitService.consumeRequest(
      email,
      secondIpAddress,
    );

    expect(result.allowed).toBe(true);
    expect(result.ipRequestCount).toBe(1);
    expect(result.accountRequestCount).toBe(1);
  });

  it('should share the IP counter across different email addresses', async () => {
    const ipAddress = generateRandomIPv4();

    // Consume 4 requests using different email addresses.
    for (let requestNumber = 0; requestNumber < 4; requestNumber++) {
      const result = await passwordRecoveryRateLimitService.consumeRequest(
        `recovery-${crypto.randomUUID()}@example.com`,
        ipAddress,
      );

      expect(result.allowed).toBe(true);
    }

    // A fifth request should still be allowed.
    const fifthResult = await passwordRecoveryRateLimitService.consumeRequest(
      `recovery-${crypto.randomUUID()}@example.com`,
      ipAddress,
    );

    expect(fifthResult.allowed).toBe(true);
    expect(fifthResult.ipRequestCount).toBe(5);

    // The sixth request should be rejected, regardless of its email.
    const sixthResult = await passwordRecoveryRateLimitService.consumeRequest(
      `recovery-${crypto.randomUUID()}@example.com`,
      ipAddress,
    );

    expect(sixthResult.allowed).toBe(false);
    expect(sixthResult.ipRequestCount).toBe(6);
  });

  it('should normalize email addresses before counting account requests', async () => {
    const ipAddress = generateRandomIPv4();
    const email = `Recovery-${crypto.randomUUID()}@Example.com`;

    await passwordRecoveryRateLimitService.consumeRequest(email, ipAddress);

    await passwordRecoveryRateLimitService.consumeRequest(
      email.toLowerCase(),
      ipAddress,
    );

    const result = await passwordRecoveryRateLimitService.consumeRequest(
      email.toUpperCase(),
      ipAddress,
    );

    expect(result.allowed).toBe(true);
    expect(result.accountRequestCount).toBe(3);
  });

  it('should reject requests without an IP address', async () => {
    await expect(
      passwordRecoveryRateLimitService.consumeRequest(
        `recovery-${crypto.randomUUID()}@example.com`,
        '',
      ),
    ).rejects.toThrow('Unable to process password recovery at this time.');
  });
});
