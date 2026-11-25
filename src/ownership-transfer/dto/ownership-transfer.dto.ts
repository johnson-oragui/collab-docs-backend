import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class TransferOwnershipDto {
  @ApiProperty({
    description: 'Target user ID who will become the new organisation owner',
    example: '01950f4b-8c12-7a4e-9d21-3f5b8a1c6e20',
  })
  @IsUUID()
  declare newOwnerId: string;

  @ApiPropertyOptional({
    description: 'Optional reason for transferring organisation ownership',
    example: 'Transitioning leadership to new operations lead',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  declare reason?: string;
}
