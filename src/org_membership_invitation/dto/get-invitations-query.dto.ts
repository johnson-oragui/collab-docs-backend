import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  InvitationStatusEnum,
  RoleEnum,
  type TInvitationStatusEnum,
  type TRoleEnum,
} from '@/database/database.enums';
import { uuidv7 } from 'uuidv7';

export class GetOrganisationInvitationsQueryDto {
  @ApiPropertyOptional({
    example: 1,
    default: 1,
    minimum: 1,
    description: 'Page number (1-indexed).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    example: 10,
    default: 10,
    minimum: 1,
    maximum: 100,
    description: 'Number of records per page.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @ApiPropertyOptional({
    enum: InvitationStatusEnum,
    description: 'Filter by invitation status.',
    example: InvitationStatusEnum.PENDING,
  })
  @IsOptional()
  @IsEnum(InvitationStatusEnum)
  status?: TInvitationStatusEnum;

  @ApiPropertyOptional({
    example: true,
    description:
      'Filter by expiration state relative to current time (true = expired, false = not expired).',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  expired?: boolean;

  @ApiPropertyOptional({
    example: '2026-11-01T00:00:00.000Z',
    description: 'Inclusive lower bound ISO date string for expiresAt.',
  })
  @IsOptional()
  @IsDateString()
  expiredFrom?: string;

  @ApiPropertyOptional({
    example: '2026-11-30T23:59:59.999Z',
    description: 'Inclusive upper bound ISO date string for expiresAt.',
  })
  @IsOptional()
  @IsDateString()
  expiredTo?: string;

  @ApiPropertyOptional({
    enum: RoleEnum,
    description: 'Filter by assigned role name.',
    example: RoleEnum.ORG_MEMBER,
  })
  @IsOptional()
  @IsEnum(RoleEnum)
  role?: TRoleEnum;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Filter by a specific invitation ID (UUIDv7).',
    example: uuidv7(),
  })
  @IsOptional()
  @IsUUID()
  invitationId?: string;

  @ApiPropertyOptional({
    description: 'Filter by a specific user email.',
    example: 'johnson@email.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;
}
