export interface IEmailJobData {
  outboxId: string; // ID of the email outbox record to be processed.
}

export interface IEmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface IEncryptedEmailPayload {
  encryptedPayload: string;
  encryptionIv: string;
  encryptionAuthTag: string;
}
export interface IEmailTemplateOptions {
  recipientEmail: string;
  recipientName?: string;
  organisationName?: string;
  actionUrl: string;
  expiresIn: string;
}

export interface IEmailInfoTemplateOptions {
  recipientEmail: string;
  recipientName?: string;
  organisationName: string;
  actionUrl?: string;
  expiresIn?: string;
  info: string;
}

export interface IEmailRedisLockClient {
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

export interface IDispatchEmailOutboxResult {
  skippedDueToLock?: boolean;
  scannedCount: number;
  queuedCount: number;
}
