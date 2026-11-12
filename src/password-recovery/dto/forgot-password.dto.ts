import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  declare email: string;
}

export class ForgotPasswordResponseDto {
  constructor(partial: Partial<ForgotPasswordResponseDto>) {
    Object.assign(this, partial);
  }
  @ApiProperty({
    example:
      'If an account with that email exists, the password reset request has been accepted.',
  })
  message: string =
    'If an account with that email exists, the password reset request has been accepted.';

  @ApiProperty({ example: true })
  success: boolean = true;

  @ApiProperty({ example: { status: 'successful' } })
  data: { status: string } = { status: 'successful' };
}
