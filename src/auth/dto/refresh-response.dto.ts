import { ApiProperty } from '@nestjs/swagger';
import { AuthenticatedUserDto } from './login.dto';
import { ApiResponseDto } from '@/commons/dtos/api-response.dto';

export class RefreshTokenDataDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  declare accessToken: string;

  @ApiProperty({
    example: 'Bearer',
  })
  declare tokenType: string;

  @ApiProperty({
    example: '2026-12-09T10:30:00.000Z',
    description: 'Session and refresh-token expiration time.',
  })
  declare expiresAt: Date;

  @ApiProperty({ type: AuthenticatedUserDto })
  declare user: AuthenticatedUserDto;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  declare organisationId: string;

  @ApiProperty({
    example: 'Johnson Technologies',
  })
  declare organisationName: string;

  @ApiProperty({
    example: 'ORG_ADMIN',
  })
  declare organisationRole: string;
}

export class RefreshResponseDto extends ApiResponseDto<RefreshTokenDataDto> {
  @ApiProperty({ type: RefreshTokenDataDto })
  declare data: RefreshTokenDataDto;
}
