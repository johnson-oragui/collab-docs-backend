import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';

import type { Request as ExRequest, Response as ExResponse } from 'express';

import { PasswordRecoveryService } from './password-recovery.service';
import {
  ForgotPasswordDto,
  ForgotPasswordResponseDto,
} from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ApiResponseDto } from '@/commons/dtos/api-response.dto';

@ApiTags('AUTHENTICATION -> PASSWORD RECOVERY')
@Controller('api/v1/auth/password')
export class PasswordRecoveryController {
  constructor(
    private readonly passwordRecoveryService: PasswordRecoveryService,
  ) {}

  @Post('forgot')
  @ApiOkResponse({
    type: ForgotPasswordResponseDto,
    example: ForgotPasswordResponseDto,
    description: 'Initiates the Password recovery process.',
  })
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() request: ExRequest,
    @Res({ passthrough: true }) response: ExResponse,
  ) {
    return await this.passwordRecoveryService.requestPasswordReset(
      dto.email,
      request.ip ?? '',
      response,
    );
  }

  @Post('reset')
  @ApiOkResponse({
    type: ApiResponseDto<{ status: string }>,
    example: {
      data: {
        status: 'successful',
      },
      success: true,
      message:
        'Your password has been reset successfully. Please sign in again.',
    },
    description: 'Initiates the Password recovery process.',
  })
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return await this.passwordRecoveryService.resetPassword(
      dto.token,
      dto.newPassword,
    );
  }
}
