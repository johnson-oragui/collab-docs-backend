import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinDate,
} from 'class-validator';

export class SuspendOrganisationMemberDto {
  @ApiProperty({
    example: '2026-12-01T00:00:00.000Z',
    description: 'UTC ISO timestamp indicating when the suspension expires.',
  })
  @Type(() => Date)
  @IsDate({ message: 'suspendedTill must be a valid ISO date string' })
  @MinDate(() => new Date(), {
    message: 'suspendedTill must be in the future',
  })
  @IsNotEmpty()
  declare suspendedTill: Date;

  @ApiPropertyOptional({
    example: 'Repeated violation of workspace acceptable use policy.',
    description: 'Reason for suspending the organisation member.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class UnsuspendOrganisationMemberDto {
  @ApiPropertyOptional({
    example: 'Compliance review completed and access cleared.',
    description: 'Optional note or reason for lifting the suspension early.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
