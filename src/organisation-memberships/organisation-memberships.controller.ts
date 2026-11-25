import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { OrganisationMembershipService } from './organisation-memberships.service';
import { CustomJwtAuthGuard } from '@/commons/guards/jwt.auth.guard';
import { PermissionGuard } from '@/commons/guards/permission.guard';
import { RequirePermissions } from '@/commons/decorators/require-permissions.decorator';
import { PermissionEnum } from '@/permissions/permission.registry';
import { type Request as ExRequest } from 'express';
import {
  SuspendOrganisationMemberDto,
  UnsuspendOrganisationMemberDto,
} from './dto/member-suspension.dto';
import { ApiResponseDto } from '@/commons/dtos/api-response.dto';
import { OrganisationMembershipStatusEnum } from '@/database/database.enums';
import { uuidv7 } from 'uuidv7';

@ApiTags('Oraginisation -> Membership')
@Controller('api/v1/organisation-memberships')
export class OrganisationMembershipController {
  constructor(
    private readonly organisationMembershipService: OrganisationMembershipService,
  ) {}

  @Patch(':membershipId/remove')
  @HttpCode(201)
  @ApiCreatedResponse({
    description:
      'Removes organisation membership. Only accessible for the right permissions',
    summary:
      'Removes organisation membership. Only accessible for the right permissions',
    type: ApiResponseDto<{ status: string; suspendedTill: Date }>,
    example: {
      data: {
        membershipId: uuidv7(),
      },
      message: 'Organisation member removed successfully',
      success: true,
    },
  })
  @RequirePermissions(PermissionEnum.ORGANISATION_MEMBERSHIP.DELETE)
  @UseGuards(CustomJwtAuthGuard, PermissionGuard)
  async removeMember(
    @Req() request: ExRequest,
    @Body() dto: UnsuspendOrganisationMemberDto,
    @Param('membershipId', new ParseUUIDPipe({ version: '7', optional: false }))
    membershipId: string,
  ) {
    return await this.organisationMembershipService.removeMembership(
      membershipId,
      dto,
      request,
    );
  }

  @Patch(':membershipId/suspend')
  @HttpCode(201)
  @ApiCreatedResponse({
    description:
      'Suspends organisation membership. Only accessible for the right permissions',
    summary:
      'Suspends organisation membership. Only accessible for the right permissions',
    type: ApiResponseDto<{ status: string; suspendedTill: Date }>,
    example: {
      data: {
        status: OrganisationMembershipStatusEnum.SUSPENDED,
        suspendedTill: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      message: 'Organisation member suspended successfully',
      success: true,
    },
  })
  @RequirePermissions(PermissionEnum.ORGANISATION_MEMBERSHIP.UPDATE)
  @UseGuards(CustomJwtAuthGuard, PermissionGuard)
  async suspendMember(
    @Req() request: ExRequest,
    @Body() dto: SuspendOrganisationMemberDto,
    @Param('membershipId', new ParseUUIDPipe({ version: '7', optional: false }))
    membershipId: string,
  ) {
    return await this.organisationMembershipService.suspendMember(
      membershipId,
      dto,
      request,
    );
  }

  @Patch(':membershipId/unsuspend')
  @HttpCode(201)
  @ApiCreatedResponse({
    description:
      'UnSuspends organisation membership. Only accessible for the right permissions',
    summary:
      'UnSuspends organisation membership. Only accessible for the right permissions',
    type: ApiResponseDto<{ status: string }>,
    example: {
      data: {
        status: OrganisationMembershipStatusEnum.ACTIVE,
      },
      message: 'Organisation member unsuspended successfully',
      success: true,
    },
  })
  @RequirePermissions(PermissionEnum.ORGANISATION_MEMBERSHIP.UPDATE)
  @UseGuards(CustomJwtAuthGuard, PermissionGuard)
  async unsuspendMembership(
    @Req() request: ExRequest,
    @Body() dto: UnsuspendOrganisationMemberDto,
    @Param('membershipId', new ParseUUIDPipe({ version: '7', optional: false }))
    membershipId: string,
  ) {
    return await this.organisationMembershipService.unsuspendMember(
      membershipId,
      dto,
      request,
    );
  }
}
