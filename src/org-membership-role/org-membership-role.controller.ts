import { RequirePermissions } from '@/commons/decorators/require-permissions.decorator';
import { CustomJwtAuthGuard } from '@/commons/guards/jwt.auth.guard';
import { PermissionGuard } from '@/commons/guards/permission.guard';
import { PermissionEnum } from '@/permissions/permission.registry';
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
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OrganisationMembershipRoleService } from './org-membership-role.service';
import { type Request as ExRequest } from 'express';
import { ReassignOrganisationMemberShipRoleDto } from './dto/reassign.role.dto';
import { uuidv7 } from 'uuidv7';

@ApiTags('Organisation -> Membership -> Roles')
@ApiBearerAuth('bearer')
@ApiCookieAuth(process.env.AUTH_COOKIE_NAME)
@Controller('api/v1/organisation-memberships')
export class OrganisationMembershipRoleController {
  constructor(
    private readonly organisationMembershipRoleService: OrganisationMembershipRoleService,
  ) {}

  @Patch(':membershipId/reassign')
  @HttpCode(201)
  @ApiCreatedResponse({
    summary: 'Reassigns role to a member',
    description: 'Reassigns role to a member',
    example: {
      data: {
        membershipId: uuidv7(),
        permissions: { document: { create: true, permissionMode: 'DEFAULT' } },
      },
      message: 'Role reassigned successfully',
      success: true,
    },
  })
  @UseGuards(CustomJwtAuthGuard, PermissionGuard)
  @RequirePermissions(PermissionEnum.ORGANISATION_MEMBERSHIP_ROLE.UPDATE)
  async reassignRole(
    @Req() request: ExRequest,
    @Param('membershipId', new ParseUUIDPipe({ version: '7' }))
    membershipId: string,
    @Body() dto: ReassignOrganisationMemberShipRoleDto,
  ) {
    return await this.organisationMembershipRoleService.reassignRole(
      request,
      membershipId,
      dto,
    );
  }
}
