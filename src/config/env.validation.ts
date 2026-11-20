import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsPositive,
  IsString,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  declare NODE_ENV: Environment;

  @IsPositive()
  declare PORT: number;

  @IsString()
  declare DB_HOST: string;

  @IsString()
  declare DB_PORT: string;

  @IsString()
  declare DB_USER: string;

  @IsString()
  declare DB_PASSWORD: string;

  @IsString()
  declare DB_NAME: string;

  @IsString()
  declare JWT_SECRET: string;

  @IsString()
  declare JWT_ISSUER: string;

  @IsString()
  declare JWT_AUDIENCE: string;

  @IsString()
  declare JWT_EXPIRY: string;

  @IsString()
  declare REFRESH_JWT_EXPIRY: string;

  @IsString()
  declare AUTH_COOKIE_NAME: string;

  @IsString()
  declare AUTH_REFRESH_COOKIE_NAME: string;

  @IsOptional()
  @IsString()
  declare CORS_ORIGIN?: string;

  @IsString()
  declare REDIS_URL: string;

  @IsString()
  declare GMAIL_USER: string;
  @IsString()
  declare GMAIL_APP_PASSWORD: string;
  @IsString()
  declare EMAIL_FROM: string;

  @IsString()
  declare APP_BASE_URL: string;
  @IsString()
  declare EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS: string;
  @IsString()
  declare PASSWORD_RESET_TOKEN_EXPIRY_MINUTES: string;

  @IsString()
  declare EMAIL_ENCRYPTION_KEY: string;

  @IsString()
  declare ACCOUNT_VERIFICATION_TOKEN_EXPIRY_DAYS: string;
}

export function validateEnvConfig(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
