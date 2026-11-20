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
