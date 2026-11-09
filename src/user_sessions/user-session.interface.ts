export interface ICreateUserSessionInput {
  userId: string;
  organisationId: string;
  deviceName?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
}
export interface ICreateUserSessionResult {
  sessionId: string;
  refreshToken: string;
  expiresAt: Date;
}
export interface IRotateRefreshTokenResult {
  sessionId: string;
  refreshToken: string;
  expiresAt: Date;
}