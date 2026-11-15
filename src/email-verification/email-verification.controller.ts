import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { EmailVerificationService } from './email-verification.service';
import { VerifyEmailDto, VerifyEmailResponseDto } from './dto/verify-email.dto';

@ApiTags('AUTHETICATION -> Email Verification')
@Controller('api/v1/auth')
export class EmailVerificationController {
  constructor(
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  @Post('verify-email')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Verify a user email address',
    description:
      'Verifies a user email address using a valid, unexpired, single-use verification token.',
  })
  @ApiBadRequestResponse({
    description: 'The verification token is invalid or expired.',
  })
  @ApiCreatedResponse({
    example: VerifyEmailResponseDto,
    type: VerifyEmailResponseDto,
  })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return await this.emailVerificationService.verifyEmail(dto.token);
  }
}
