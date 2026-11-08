import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsStrongPassword,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  Validate,
} from 'class-validator';
import { IsPasswordMatch } from './user-custom-validator/isPasswordMatch.validator';
import { IsEMailUniqueConstraint } from './user-custom-validator/uniqueEmail.validator';
import { IsTrue } from './user-custom-validator/isTrue.validator';
import { Exclude, Expose } from 'class-transformer';

export class CreateUserRequestDto {
  @ApiProperty({
    description: 'User email',
    example: 'johnson@email.com',
    required: true,
  })
  @IsEmail(
    {
      allow_ip_domain: false,
      domain_specific_validation: true,
      host_blacklist: ['test.com'],
    },
    { message: 'email must be a valid email' },
  )
  @Validate(IsEMailUniqueConstraint) // for database email unique check
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
    description: 'User email',
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
    description: "User's firstname",
    example: 'Johnson',
    required: false,
  })
  @IsOptional()
  @IsString()
  firstname?: string;

  @ApiPropertyOptional({
    description: "User's lastname",
    example: 'Dennis',
    required: false,
  })
  @IsOptional()
  @IsString()
  lastname?: string;
}

export class UserResponseEntity {
  @Expose()
  declare id: string;

  @Expose()
  declare email: string;

  @Expose()
  name?: string | null;

  @Expose()
  declare acceptTerms: boolean;

  @Expose()
  declare createdAt: Date;

  @Exclude()
  password?: string;

  @Exclude()
  role?: string;

  @Exclude()
  declare updatedAt: Date;

  constructor(partial: Partial<UserResponseEntity>) {
    Object.assign(this, partial);
  }
}

export class CreateUserResponseDto {
  constructor(partial: Partial<CreateUserResponseDto>) {
    Object.assign(this, partial);
  }
  @ApiProperty({
    example: 'New Account added successfully',
    required: true,
  })
  message: string = 'New Account added successfully';

  @ApiProperty({
    example: true,
    required: true,
  })
  success: boolean = true;

  @ApiProperty({
    example: {
      id: "",
      email: 'email@email.com',
      firstName: 'Johnson',
      lastName: "Dennis",
      createdAt: new Date(),
    },
    required: true,
  })
  declare data: UserResponseEntity;
}
