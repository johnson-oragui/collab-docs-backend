import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { OwnershipTransferService } from './ownership-transfer.service';
import { uuidv7 } from 'uuidv7';
import { type Request as ExRequest } from 'express';
import { TransferOwnershipDto } from './dto/ownership-transfer.dto';
import { CustomJwtAuthGuard } from '@/commons/guards/jwt.auth.guard';
import { PermissionGuard } from '@/commons/guards/permission.guard';
import { RequireAnyPermission } from '@/commons/decorators/require-permissions.decorator';
import { PermissionEnum } from '@/permissions/permission.registry';

@ApiTags('Organisation -> Ownership -> Transfers')
@ApiBearerAuth('bearer')
@ApiCookieAuth(process.env.AUTH_COOKIE_NAME)
@Controller('api/v1/organisation-ownership')
export class OwnershipTransferController {
  constructor(
    private readonly ownershipTransferService: OwnershipTransferService,
  ) {}

  @Post('transfer')
  // deliberately using read permission here, to ensure admin access only
  // the check for owner is right inside service logic
  @RequireAnyPermission(PermissionEnum.ORGANISATION_OWNERSHIP_TRANSFER.READ)
  @UseGuards(CustomJwtAuthGuard, PermissionGuard)
  @HttpCode(201)
  @ApiOperation({
    summary: 'Transfer organisation ownership to an active member',
  })
  @ApiCreatedResponse({
    description: 'Organisation ownership transferred successfully',
    example: {
      message: 'Organisation ownership transferred successfully',
      success: true,
      data: {
        organisationId: uuidv7(),
        creator: {
          id: uuidv7(),
          firstName: 'Johnson1',
          lastName: 'Johnson1',
        },
        previousOwner: {
          id: uuidv7(),
          firstName: 'Johnson2',
          lastName: 'Johnson2',
        },
        newOwner: {
          id: uuidv7(),
          firstName: 'Johnson3',
          lastName: 'Johnson3',
        },
        previousOwnerRole: 'ORG_MEMBER',
        newOwnerRole: 'ORG_ADMIN',
        historyId: uuidv7(),
      },
    },
  })
  async transferOwnership(
    @Req() request: ExRequest,
    @Body() dto: TransferOwnershipDto,
  ) {
    return await this.ownershipTransferService.transferOwnership(request, dto);
  }

  @Get()
  @RequireAnyPermission(PermissionEnum.ORGANISATION_OWNERSHIP_TRANSFER.READ)
  @UseGuards(CustomJwtAuthGuard, PermissionGuard)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Retrieves organisation ownership.',
  })
  @ApiOkResponse({
    description: 'Organisation ownership retrieved successfully',
    example: {
      message: 'Organisation ownership retrieved successfully',
      success: true,
      data: {
        organisationId: uuidv7(),
        creator: {
          id: uuidv7(),
          firstName: 'Johnson1',
          lastName: 'Johnson1',
        },
        owner: {
          id: uuidv7(),
          firstName: 'Johnson2',
          lastName: 'Johnson2',
        },
        organisationName: 'Johnson tech LTD',
        status: 'ACTIVE',
      },
    },
  })
  async getOwnership(@Req() request: ExRequest) {
    return await this.ownershipTransferService.getOwnership(request);
  }
}
