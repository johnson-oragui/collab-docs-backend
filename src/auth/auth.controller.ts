import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  type Response as ExResponse,
  type Request as ExRequest,
} from 'express';

import { AuthService } from './auth.service';
import {
  AuthenticatedLoginDataDto,
  LoginDto,
  LoginOrganisationDto,
  LoginResponseDto,
  OrganisationSelectionDataDto,
} from './dto/login.dto';
import { ApiResponseDto } from '@/commons/dtos/api-response.dto';
import {
  RefreshResponseDto,
  RefreshTokenDataDto,
} from './dto/refresh-response.dto';
import {
  CreateUserRequestDto,
  RegisterResponseDataDto,
} from './dto/register.dto';

@ApiTags('Authentication')
@Controller('api/v1/auth')
@ApiExtraModels(
  ApiResponseDto,
  LoginResponseDto,
  LoginOrganisationDto,
  OrganisationSelectionDataDto,
  AuthenticatedLoginDataDto,
  RefreshResponseDto,
  RefreshTokenDataDto,
  RegisterResponseDataDto,
)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authenticate a user',
    description:
      'Authenticates a user and either selects their only eligible organisation or requests an organisation selection.',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description: 'Authentication response.',
    content: {
      'application/json': {
        examples: {
          organisationSelection: {
            summary: 'User must select an organisation',
            value: {
              success: true,
              message: 'Please select an organisation to continue.',
              data: {
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
              },
            },
          },
          loginSuccessful: {
            summary: 'Login successful',
            value: {
              success: true,
              message: 'Login successful.',
              data: {
                requiresOrganisationSelection: false,
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
                organisationName: 'Acme Technologies',
                organisationRole: 'ORG_ADMIN',
              },
            },
          },
        },
      },
    },
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: ExRequest,
    @Res({ passthrough: true }) response: ExResponse,
  ): Promise<LoginResponseDto> {
    return await this.authService.login(
      dto,
      {
        userAgent: req.headers['user-agent'] ?? null,
        ipAddress: req.ip ?? null,
      },
      response,
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh authentication tokens',
    description:
      'Rotates the refresh token and issues a new access token for the original session and organisation.',
  })
  @ApiHeader({ name: 'X-REFRESH-TOKEN' })
  @ApiOkResponse({
    description: 'Tokens refreshed successfully.',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            data: {
              $ref: getSchemaPath(RefreshTokenDataDto),
            },
          },
        },
      ],
    },
    content: {
      'application/json': {
        example: {
          success: true,
          message: 'Token refreshed successfully.',
          data: {
            accessToken: 'new-access-token',
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
        },
      },
    },
  })
  async refresh(
    @Req() request: ExRequest,
    @Res({ passthrough: true }) response: ExResponse,
  ) {
    return this.authService.refresh(
      request.get('X-REFRESH-TOKEN') ?? '',
      response,
    );
  }

  @Post('register')
  @ApiOperation({
    summary: 'Register a user and create an organisation',
    description:
      'Creates a user account, an organisation owned by that user, and an active organisation administrator membership. Registration does not authenticate the user.',
  })
  @ApiBody({ type: CreateUserRequestDto })
  @ApiCreatedResponse({
    description: 'User and organisation registered successfully.',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            data: {
              $ref: getSchemaPath(RegisterResponseDataDto),
            },
          },
        },
      ],
    },
  })
  async register(
    @Body() dto: CreateUserRequestDto,
  ): Promise<ApiResponseDto<RegisterResponseDataDto>> {
    return this.authService.register(dto);
  }
}
