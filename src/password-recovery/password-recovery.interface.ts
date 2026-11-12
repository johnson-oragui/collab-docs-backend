export interface IPasswordRecoveryRateLimitResult {
  allowed: boolean;
  ipRequestCount: number;
  accountRequestCount: number;
  retryAfterSeconds: number;
}

export interface IPasswordRecoveryRequestResult {
  accepted: boolean;
  retryAfterSeconds?: number;
}
