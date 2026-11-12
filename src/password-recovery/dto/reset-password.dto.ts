import {
  IsNotEmpty,
  IsString,
  IsStrongPassword,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  declare token: string;

  @IsStrongPassword()
  @MinLength(8)
  @MaxLength(40)
  declare newPassword: string;
}
