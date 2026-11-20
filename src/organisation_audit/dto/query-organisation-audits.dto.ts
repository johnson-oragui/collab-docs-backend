import {
  IsOptional,
  IsEnum,
  IsUUID,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  OrganisationAuditEventEnum,
  type TOrganisationAuditEventEnum,
} from '@/commons/enums';

export class QueryOrganisationAuditsDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by specific audit event type' })
  @IsEnum(OrganisationAuditEventEnum)
  @IsOptional()
  @IsString()
  eventType?: TOrganisationAuditEventEnum;

  @ApiPropertyOptional({ example: '01a1ea22-ead2-75f5-9d4f-dad2b36da70d' })
  @IsOptional()
  @IsUUID('7', { message: 'Actor ID must be a valid UUID v7.' })
  actorId?: string;

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Start date must be a valid ISO 8601 date string.' },
  )
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.999Z' })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'End date must be a valid ISO 8601 date string.' },
  )
  endDate?: string;

  @ApiPropertyOptional({ example: '01a1ea22-ead2-75f5-9d4f-dad2b36da70d' })
  @IsOptional()
  @IsUUID('7', { message: 'organisation ID must be a valid UUID v7.' })
  organisationId?: string;
}
