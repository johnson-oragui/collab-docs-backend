export const PASSWORD_RECOVERY = {
  TOKEN_BYTES: 32,
  TOKEN_EXPIRY_MINUTES: 15,
  KEY_PREFIX: 'collabdocs:auth:password-recovery',

  IP_RATE_LIMIT: {
    MAX_REQUESTS: 5,
    WINDOW_SECONDS: 60 * 60,
  },

  IP_ACCOUNT_RATE_LIMIT: {
    MAX_REQUESTS: 3,
    WINDOW_SECONDS: 60 * 60,
  },
} as const;
