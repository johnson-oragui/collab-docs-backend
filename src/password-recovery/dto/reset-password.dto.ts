import { ApiProperty } from '@nestjs/swagger';
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
  @ApiProperty({ example: 'weedwwq.dwqqw.qwdqwd', required: true })
  declare token: string;

  @IsStrongPassword()
  @MinLength(8)
  @MaxLength(40)
  @ApiProperty({ example: 'strong Password', required: true })
  declare newPassword: string;
}
