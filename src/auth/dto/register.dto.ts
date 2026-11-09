import {
  OrganisationMembershipStatusEnum,
  RoleEnum,
} from '@/database/database.enums';
import { IsPasswordMatch } from '@/user/dto/user-custom-validator/isPasswordMatch.validator';
import { IsTrue } from '@/user/dto/user-custom-validator/isTrue.validator';
import {
  IsEMailUniqueConstraint,
  IsOrgEMailUniqueConstraint,
} from '@/user/dto/user-custom-validator/uniqueEmail.validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsStrongPassword,
  IsOptional,
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Validate,
} from 'class-validator';

export class CreateUserRequestDto {
  @ApiProperty({
    description: 'User email address',
    example: 'johnson@email.com',
    required: true,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail(
    {
      allow_ip_domain: false,
      domain_specific_validation: true,
      host_blacklist: ['test.com'],
    },
    { message: 'email must be a valid email' },
  )
  @Validate(IsEMailUniqueConstraint)
  declare email: string;

  @ApiProperty({
    description: 'User password',
    example: 'Johnson1234#',
    required: true,
  })
  @IsStrongPassword()
  @MinLength(8)
  @MaxLength(40)
  declare password: string;

  @ApiProperty({
    description: 'Password confirmation',
    example: 'Johnson1234#',
    required: true,
  })
  @IsString()
  @IsPasswordMatch('password')
  declare confirmPassword: string;

  @ApiProperty({
    description: 'Accept terms and conditions',
    example: true,
    required: true,
  })
  @IsBoolean()
  @IsTrue()
  declare acceptTerms: boolean;

  @ApiPropertyOptional({
    description: "User's first name",
    example: 'Johnson',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  declare firstname?: string;

  @ApiPropertyOptional({
    description: "User's last name",
    example: 'Dennis',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  declare lastname?: string;

  @ApiProperty({
    description: 'Name of the organisation being created during registration',
    example: 'Startinbox Technologies',
    required: true,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(150)
  declare organisationName: string;

  @ApiPropertyOptional({
    description: 'Description of the organisation',
    example: 'A collaborative document management platform.',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  declare organisationDescription?: string;

  @ApiProperty({
    description: 'Organisation email address',
    example: 'johnson@email.com',
    required: true,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail(
    {
      allow_ip_domain: false,
      domain_specific_validation: true,
      host_blacklist: ['test.com'],
    },
    { message: 'email must be a valid email' },
  )
  @Validate(IsOrgEMailUniqueConstraint)
  declare organisationEmail: string;
}

export class RegisterUserDataDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  declare id: string;

  @ApiProperty({ example: 'johnson@example.com' })
  declare email: string;

  @ApiProperty({ example: 'Johnson', nullable: true })
  declare firstName: string | null;

  @ApiProperty({ example: 'Dennis', nullable: true })
  declare lastName: string | null;
}

export class RegisterOrganisationDataDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  declare id: string;

  @ApiProperty({ example: 'Johnson Technologies' })
  declare name: string;

  @ApiProperty({ example: 'contact@johnson.com' })
  declare email: string;

  @ApiProperty({ example: 'johnson-technologies' })
  declare slug: string;
}

export class RegisterMembershipDataDto {
  @ApiProperty({ enum: RoleEnum, example: RoleEnum.ORG_ADMIN })
  declare role: string;

  @ApiProperty({
    enum: OrganisationMembershipStatusEnum,
    example: OrganisationMembershipStatusEnum.ACTIVE,
  })
  declare status: string;
}

export class RegisterResponseDataDto {
  @ApiProperty({ type: RegisterUserDataDto })
  declare user: RegisterUserDataDto;

  @ApiProperty({ type: RegisterOrganisationDataDto })
  declare organisation: RegisterOrganisationDataDto;

  @ApiProperty({ type: RegisterMembershipDataDto })
  declare membership: RegisterMembershipDataDto;
}
