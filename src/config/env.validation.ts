import { plainToInstance } from 'class-transformer';
import { IsEnum, IsPositive, IsString, validateSync } from 'class-validator';

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
  declare TEST: string;

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
  declare TEST_DB_NAME: string;

  @IsString()
  declare JWT_SECRET: string;

  @IsString()
  declare JWT_ISSUER: string;

  @IsString()
  declare JWT_AUDIENCE: string;

  @IsString()
  declare JWT_EXPIRY: string;

  @IsString()
  declare AUTH_COOKIE_NAME: string;

  @IsString()
  declare AUTH_REFRESH_COOKIE_NAME: string;
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
