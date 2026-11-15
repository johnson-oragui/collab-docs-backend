export const EMAIL_QUEUE = 'email';

export const EMAIL_JOB = {
  SEND: 'collabdocs:send-email',
  JOB_ID_PREFIX: 'collabdocs-email-outbox-',
  MAX_ATTEMPTS: 5,
  BATCH_SIZE: 50,
  STALE_AFTER_MINUTES: 10,
} as const;
