export interface ILoginLockoutStatus {
  isLocked: boolean;
  remainingSeconds: number;
}

export interface ILoginFailureResult {
  failedAttempts: number;
  lockoutTriggered: boolean;
  lockoutLevel: number;
  lockoutDurationSeconds: number;
}
