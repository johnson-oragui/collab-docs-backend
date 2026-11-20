import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { OrganisationmembershipinvitationService } from './org_membership_invitation.service';
import { InviteOrganisationMemberDto } from './dto/invitation.dto';
import { type Request as ExRequest } from 'express';
import { CustomJwtAuthGuard } from '@/commons/guards/jwt.auth.guard';
import { RequireAnyPermission } from '@/commons/decorators/require-permissions.decorator';
import { PermissionEnum } from '@/permissions/permission.registry';
import { PermissionGuard } from '@/commons/guards/permission.guard';
import { uuidv7 } from 'uuidv7';
import { GetOrganisationInvitationsQueryDto } from './dto/get-invitations-query.dto';

@ApiTags('Organisation -> Invitations')
@Controller('api/v1/organisation-invitations')
export class OrganisationInvitationController {
  constructor(
    private readonly organisationmembershipinvitationService: OrganisationmembershipinvitationService,
  ) {}

  @Get()
  @UseGuards(CustomJwtAuthGuard, PermissionGuard)
  @RequireAnyPermission(PermissionEnum.ORGANISATION_INVITATION.READ)
  @ApiOkResponse({
    description: 'Reads member invitations an Organisation',
    example: {
      success: true,
      message: 'Invitations retrieved successfully',
      meta: {
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
        hasNextPage: true,
        hasPreviousPage: false,
      },
      data: [
        {
          id: '01a1f9ed-8468-7712-934a-de86f5c00c45',
          createdAt: '2026-11-20T17:07:35.121Z',
          updatedAt: '2026-11-20T17:07:35.121Z',
          email: 'page-3-9d2c02a9@example.com',
          firstName: 'Filter',
          lastName: 'Test',
          expiresAt: '2026-11-30T17:07:35.143Z',
          revokedAt: null,
          resentAt: null,
          status: 'PENDING',
          permissionMode: 'DEFAULT',
          role: { name: 'ORG_MEMBER' },
          invitedBy: {
            id: '01a1f9ed-7e1b-72fe-b8d4-e36097ad31d1',
            email: 'johnson@example.com',
            firstName: 'Johnson',
            lastName: 'Dennis',
          },
          revokedBy: {
            id: '01a1f9ed-7e1b-72fe-b8d4-e36097ad31d1',
            email: 'johnson@example.com',
            firstName: 'Johnson',
            lastName: 'Dennis',
          },
        },
      ],
    },
  })
  @HttpCode(200)
  async getMemberInvitations(
    @Req() request: ExRequest,
    @Query() query: GetOrganisationInvitationsQueryDto,
  ) {
    return await this.organisationmembershipinvitationService.getInvitations(
      query,
      request,
    );
  }

  @Get('accept/:token')
  @ApiOkResponse({
    description: 'Accepts member invitations from an Organisation',
    example: {
      data: { id: uuidv7(), status: 'ACCEPTED' },
      message: 'Invitations accepted successfully',
      success: true,
    },
  })
  @HttpCode(200)
  async acceptInvitations(
    @Req() request: ExRequest,
    @Param('token') token: string,
  ) {
    return await this.organisationmembershipinvitationService.acceptInvitation(
      request,
      token,
    );
  }

  @Post()
  @UseGuards(CustomJwtAuthGuard, PermissionGuard)
  @RequireAnyPermission(PermissionEnum.ORGANISATION_INVITATION.CREATE)
  @ApiCreatedResponse({
    description: 'Invites a new member to an Organisation',
    example: {
      data: { status: 'PENDING', id: uuidv7() },
      message: 'Invitation Sent',
      success: true,
    },
  })
  @HttpCode(201)
  async inviteMember(
    @Req() request: ExRequest,
    @Body() dto: InviteOrganisationMemberDto,
  ) {
    return await this.organisationmembershipinvitationService.inviteMember(
      dto,
      request,
    );
  }

  @Post(':invitationId/revoke')
  @UseGuards(CustomJwtAuthGuard, PermissionGuard)
  @RequireAnyPermission(PermissionEnum.ORGANISATION_INVITATION.UPDATE)
  @ApiCreatedResponse({
    description: 'Revokes an existing member Invitation',
    example: {
      data: { id: uuidv7(), status: 'REVOKED' },
      message: 'Invitation revoked',
      success: true,
    },
  })
  @HttpCode(201)
  async revokeInvitation(
    @Req() request: ExRequest,
    @Param('invitationId', new ParseUUIDPipe({ version: '7', optional: false }))
    invitationId: string,
  ) {
    return await this.organisationmembershipinvitationService.revokeInvitation(
      invitationId,
      request,
    );
  }

  @Post(':invitationId/resend')
  @UseGuards(CustomJwtAuthGuard, PermissionGuard)
  @RequireAnyPermission(PermissionEnum.ORGANISATION_INVITATION.UPDATE)
  @ApiCreatedResponse({
    description: 'Resend an Invitation only if the invitation is still pending',
    example: {
      data: { id: uuidv7(), status: 'PENDING' },
      message: 'Invitation resent',
      success: true,
    },
  })
  @HttpCode(201)
  async resendInvitation(
    @Req() request: ExRequest,
    @Param('invitationId', new ParseUUIDPipe({ version: '7', optional: false }))
    invitationId: string,
  ) {
    return await this.organisationmembershipinvitationService.resendInvitation(
      invitationId,
      request,
    );
  }
}
