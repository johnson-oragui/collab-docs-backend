declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'staging' | 'test';
    PORT: number;

    DB_HOST: string;
    DB_PORT: string;
    DB_USER: string;
    DB_PASSWORD: string;
    DB_NAME: string;

    JWT_SECRET: string;
    JWT_ISSUER: string;
    JWT_AUDIENCE: string;
    JWT_EXPIRY: string;
    REFRESH_JWT_EXPIRY: string;

    AUTH_COOKIE_NAME: string;
    AUTH_REFRESH_COOKIE_NAME: string;

    CORS_ORIGIN: string;
  }
}
