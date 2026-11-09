import { ApiResponseDto } from '@/commons/dtos/api-response.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'johnson@example.com',
    description: 'User email address.',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  declare email: string;

  @ApiProperty({
    example: 'StrongPassword123!',
    description: 'User password. Required for email/password authentication.',
    nullable: true,
  })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsNotEmpty()
  declare password: string | null;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description:
      'Organisation selected by the user when they belong to multiple eligible organisations.',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  organisationId?: string | null;
}

export class LoginOrganisationDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  declare organisationId: string;

  @ApiProperty({
    example: 'Acme Technologies',
  })
  declare organisationName: string;

  @ApiProperty({
    example: 'ORG_ADMIN',
    enum: ['ORG_ADMIN', 'ORG_MEMBER'],
  })
  declare role: string;
}

export class OrganisationSelectionDataDto {
  @ApiProperty({
    example: true,
  })
  declare requiresOrganisationSelection: true;

  @ApiProperty({
    type: [LoginOrganisationDto],
  })
  declare organisations: LoginOrganisationDto[];
}

export class AuthenticatedUserDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  declare id: string;

  @ApiProperty({
    example: 'johnson@example.com',
  })
  declare email: string;

  @ApiProperty({
    example: 'Johnson',
  })
  declare firstName: string;

  @ApiProperty({
    example: 'Doe',
  })
  declare lastName: string;
}

export class AuthenticatedLoginDataDto {
  @ApiProperty({
    example: false,
  })
  declare requiresOrganisationSelection: false;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  declare accessToken: string;

  // @ApiProperty({
  //   example: 'random-refresh-token-value',
  // })
  // declare refreshToken: string;

  @ApiProperty({
    example: 'Bearer',
  })
  declare tokenType: string;

  @ApiProperty({
    example: '2026-12-09T10:30:00.000Z',
    description: 'Refresh token/session expiration time.',
  })
  declare expiresAt: Date;

  @ApiProperty({
    type: AuthenticatedUserDto,
  })
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

export class LoginResponseDto extends ApiResponseDto<
  OrganisationSelectionDataDto | AuthenticatedLoginDataDto
> {
  @ApiProperty({
    // oneOf: [
    //   { $ref: '#/components/schemas/OrganisationSelectionDataDto' },
    //   { $ref: '#/components/schemas/AuthenticatedLoginDataDto' },
    // ],
    example: {
      requiresOrganisationSelection: true,
      organisations: [
        {
          organisationId: '550e8400-e29b-41d4-a716-446655440000',
          organisationName: 'Johnson Technologies',
          role: 'ORG_ADMIN',
        },
        {
          organisationId: '550e8400-e29b-41d4-a716-446655440001',
          organisationName: 'Beta Solutions',
          role: 'ORG_MEMBER',
        },
      ],
      accessToken: 'your-access-token',
      // refreshToken: 'your-refresh-token',
      tokenType: 'Bearer',
      expiresAt: '2026-12-09T10:30:00.000Z',
      user: {
        id: '550e8400-e29b-41d4-a716-446655440002',
        email: 'johnson@example.com',
        firstName: 'John',
        lastName: 'Doe',
      },
      organisationId: '550e8400-e29b-41d4-a716-446655440000',
      organisationName: 'Johnson Technologies',
      organisationRole: 'ORG_ADMIN',
    },
  })
  declare data: OrganisationSelectionDataDto | AuthenticatedLoginDataDto;
}
