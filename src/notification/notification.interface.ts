import { TNotificationOutboxEventTypeEnum } from '@/database/database.enums';

export interface INotificationRedisLockClient {
  set(
    key: string,
    value: string,
    expiryMode: 'PX',
    timeMs: number,
    setMode: 'NX',
  ): Promise<string | null>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<number>;
  eval?(script: string, numKeys: number, ...args: string[]): Promise<unknown>;
}

export interface ICleanupExpiredDraftsResult {
  skippedDueToLock?: boolean;
  scannedCount: number;
  deletedCount: number;
  skippedIntegrityCount: number;
}
export interface INotificationDeliveryPayload {
  outboxId: string;
  notificationId: string;
  organisationId?: string;
  recipientMembershipId: string;
  eventType: TNotificationOutboxEventTypeEnum;
  attempt: number;
}
export interface IDispatchNotificationOutboxResult {
  skippedDueToLock?: boolean;
  scannedCount: number;
  dispatchedCount: number;
  failedCount: number;
}
