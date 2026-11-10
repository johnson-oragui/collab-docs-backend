export const LOGIN_LOCKOUT = {
  KEY_PREFIX: 'collabdocs:auth:login',

  // Number of failed attempts allowed for one IP + email combination.
  MAX_FAILED_ATTEMPTS: 5,

  // Time window in which failed attempts are counted.
  FAILURE_WINDOW_SECONDS: 15 * 60,

  // Escalating lockout durations, in minutes.
  LOCKOUT_DURATIONS_MINUTES: [1, 5, 15, 30, 60],

  // How long the escalation level is retained.
  LOCKOUT_LEVEL_TTL_SECONDS: 90 * 24 * 60 * 60,
} as const;

export const LOGIN_RATE_LIMIT = {
  KEY_PREFIX: 'collabdocs:auth:login:ip',

  // Maximum login requests allowed from one IP in the window.
  MAX_REQUESTS: 30,

  // Fixed rate-limit window.
  WINDOW_SECONDS: 15 * 60,
} as const;
