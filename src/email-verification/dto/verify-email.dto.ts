import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    description: 'Single-use email verification token',
    example: 'a-secure-verification-token',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  declare token: string;
}

export class VerifyEmailResponseDto {
  constructor(partial: Partial<VerifyEmailResponseDto>) {
    Object.assign(this, partial);
  }

  @ApiProperty({
    example: 'Account verification successful',
  })
  message: string = 'Account verification successful';

  @ApiProperty({
    example: 'Account verification successful',
  })
  success: boolean = true;

  @ApiProperty({
    example: 'Account verification successful',
  })
  data: Record<string, string> = { status: 'successful' };
}
