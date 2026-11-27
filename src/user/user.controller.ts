import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { type Request as ExRequest } from 'express';

import { CustomJwtAuthGuard } from '@/commons/guards/jwt.auth.guard';
import { UserService } from './user.service';
import { CurrentUser } from './user.types';
import { ApiResponseDto } from '@/commons/dtos/api-response.dto';

@ApiTags('USERS')
@ApiBearerAuth('bearer')
@ApiCookieAuth(process.env.AUTH_COOKIE_NAME)
@Controller('api/v1/users')
@UseGuards(CustomJwtAuthGuard)
export default class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOkResponse({
    example: {
      data: {
        id: '01a1db4a-86aa-7146-83cd-61d41959c8f7',
        email: 'johnson@email.com',
        firstName: 'Johnson',
        lastName: 'Dennis',
        profile: {
          id: '01a1db4a-86aa-7146-83cd-6596a8e49fc2',
          bio: null,
          avatarUrl: null,
        },
        organisationMemberships: [
          {
            id: '01a1db4a-86ba-7380-89b6-9223e9536d0b',
            status: 'ACTIVE',
            role: {
              id: '01a1c067-bda4-7271-a966-b6b63c0f6495',
              name: 'ORG_ADMIN',
            },
          },
        ],
      },
      message: 'User data retrieved successfully.',
      success: true,
    },
  })
  async getCurrentUser(
    @Req() req: ExRequest,
  ): Promise<ApiResponseDto<CurrentUser>> {
    return await this.userService.getCurrentUser(req);
  }
}
