declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'staging' | 'test';
    PORT: number;

    DB_HOST: string;
    DB_PORT: string;
    DB_USER: string;
    DB_PASSWORD: string;
    DB_NAME: string;

    REDIS_URL: string;

    JWT_SECRET: string;
    JWT_ISSUER: string;
    JWT_AUDIENCE: string;
    JWT_EXPIRY: string;
    REFRESH_JWT_EXPIRY: string;

    AUTH_COOKIE_NAME: string;
    AUTH_REFRESH_COOKIE_NAME: string;

    CORS_ORIGIN: string;

    GMAIL_USER: string;

    GMAIL_APP_PASSWORD: string;

    EMAIL_FROM: string;

    APP_BASE_URL: string;

    EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS: string;

    PASSWORD_RESET_TOKEN_EXPIRY_MINUTES: string;

    EMAIL_ENCRYPTION_KEY: string;
  }
}
