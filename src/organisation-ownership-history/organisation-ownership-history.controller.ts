import {
  Controller,
  Get,
  HttpCode,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { type Request as ExRequest } from 'express';

import { OwnershipHistoryService } from './organisation-ownership-history.service';
import { CustomJwtAuthGuard } from '@/commons/guards/jwt.auth.guard';
import { PermissionGuard } from '@/commons/guards/permission.guard';
import { RequireAnyPermission } from '@/commons/decorators/require-permissions.decorator';
import { PermissionEnum } from '@/permissions/permission.registry';
import { GetOwnershipHistoryQueryDto } from './dto/get-ownership-history.dto';
import { uuidv7 } from 'uuidv7';

@ApiTags('Organisation -> Ownership -> Transfers')
@ApiBearerAuth('bearer')
@ApiCookieAuth(process.env.AUTH_COOKIE_NAME)
@Controller('api/v1/organisation-ownership-history')
export class OwnershipHistoryController {
  constructor(
    private readonly ownershipHistoryService: OwnershipHistoryService,
  ) {}

  @Get('')
  @HttpCode(200)
  @RequireAnyPermission(PermissionEnum.ORGANISATION_OWNERSHIP_HISTORY.READ)
  @UseGuards(CustomJwtAuthGuard, PermissionGuard)
  @ApiOperation({
    summary: 'Get paginated ownership transfer history for the organisation',
  })
  @ApiOkResponse({
    description: 'Ownership history retrieved successfully',
    example: {
      message: 'Ownership history retrieved successfully',
      success: true,
      data: [
        {
          id: uuidv7(),
          transferredAt: new Date(),
          reason: 'Some reason',
          createdAt: new Date(),
          previousOwner: {
            email: 'johnson@email.com',
            firstName: 'johnson',
            lastName: 'johnson',
          },
          newOwner: {
            id: uuidv7(),
            email: 'johnson@email.com',
            firstName: 'johnson',
            lastName: 'johnson',
          },
        },
      ],
      meta: {
        total: 10,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    },
  })
  async getOwnershipHistory(
    @Req() request: ExRequest,
    @Query() query: GetOwnershipHistoryQueryDto,
  ) {
    return await this.ownershipHistoryService.getOwnershipHistory(
      request,
      query,
    );
  }
}
