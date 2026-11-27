export const EMAIL_QUEUE = 'email';

export const EMAIL_JOB = {
  SEND: 'collabdocs:send-email',
  JOB_ID_PREFIX: 'collabdocs-email-outbox-',
  MAX_ATTEMPTS: 5,
  BATCH_SIZE: 50,
  STALE_AFTER_MINUTES: 10,
} as const;

export const RELEASE_LOCK_LUA = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;
export const EMAIL_REDIS_CLIENT = 'EMAIL_REDIS_CLIENT';
