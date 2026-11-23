import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { MembershipPermissionsService } from './membership_permissions.service';
import { CustomJwtAuthGuard } from '@/commons/guards/jwt.auth.guard';
import { PermissionGuard } from '@/commons/guards/permission.guard';
import { RequireAnyPermission } from '@/commons/decorators/require-permissions.decorator';
import { PermissionEnum } from '@/permissions/permission.registry';
import { UpdateMembershipPermissionsDto } from './dto/update-membership-permissions.dto';
import { type Request as ExRequest } from 'express';
import { uuidv7 } from 'uuidv7';

@ApiTags('Organisation -> Membership -> Permissions')
@Controller('api/v1/organisation-memberships')
export class MembershipPermissionsController {
  constructor(
    private readonly membershipPermissionsService: MembershipPermissionsService,
  ) {}

  @Get(':membershipId')
  @ApiOkResponse({
    example: {
      message: 'Permissions retrieved successfully',
      success: true,
      data: {
        document: {
          create: true,
          read: true,
          update: true,
          delete: true,
        },
        documentComment: {
          create: true,
          read: true,
          update: true,
          delete: true,
        },
        documentInvitation: {
          create: true,
          read: true,
          update: true,
          delete: true,
        },
      },
    },
  })
  @UseGuards(CustomJwtAuthGuard, PermissionGuard)
  @RequireAnyPermission(PermissionEnum.ORGANISATION_MEMBERSHIP_PERMISSION.READ)
  @HttpCode(200)
  async getMembershipPermissions(
    @Req() req: ExRequest,
    @Param('membershipId', new ParseUUIDPipe({ version: '7' }))
    membershipId: string,
  ) {
    return await this.membershipPermissionsService.getMembershipPermissions(
      req,
      membershipId,
    );
  }

  @Post(':membershipId/permissions')
  @HttpCode(201)
  @ApiCreatedResponse({
    summary: 'Adds permission for an organistion member',
    description: 'Adds permission for an organistion member',
    example: {
      message: 'Membership permissions added successfully',
      success: true,
      data: {
        membershipId: uuidv7(),
        permissions: { document: { create: true, delete: false } },
      },
    },
  })
  @UseGuards(CustomJwtAuthGuard, PermissionGuard)
  @RequireAnyPermission(
    PermissionEnum.ORGANISATION_MEMBERSHIP_PERMISSION.CREATE,
  )
  async addMemberPermission(
    @Body() dto: UpdateMembershipPermissionsDto,
    @Req() req: ExRequest,
    @Param('membershipId', new ParseUUIDPipe({ version: '7' }))
    membershipId: string,
  ) {
    return await this.membershipPermissionsService.addPermissions(
      membershipId,
      dto,
      req,
    );
  }

  @Patch(':membershipId/permissions')
  @HttpCode(201)
  @ApiCreatedResponse({
    summary: 'Removes permission for an organistion member',
    description: 'Removes permission for an organistion member',
    example: {
      message: 'Membership permissions added successfully',
      success: true,
      data: {
        membershipId: uuidv7(),
        permissions: { document: { create: true, delete: false } },
      },
    },
  })
  @UseGuards(CustomJwtAuthGuard, PermissionGuard)
  @RequireAnyPermission(
    PermissionEnum.ORGANISATION_MEMBERSHIP_PERMISSION.DELETE,
  )
  async removeMemberPermission(
    @Body() dto: UpdateMembershipPermissionsDto,
    @Req() req: ExRequest,
    @Param('membershipId', new ParseUUIDPipe({ version: '7' }))
    membershipId: string,
  ) {
    return await this.membershipPermissionsService.removePermissions(
      membershipId,
      dto,
      req,
    );
  }
}
