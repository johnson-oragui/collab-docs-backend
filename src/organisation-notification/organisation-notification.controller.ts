import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { OrganisationNotificationService } from './organisation-notification.service';
import { CreateNotificationDto } from './dto/create.dto';
import { type Request as ExRequest } from 'express';
import { RequireAnyPermission } from '@/commons/decorators/require-permissions.decorator';
import { PermissionEnum } from '@/permissions/permission.registry';
import { CustomJwtAuthGuard } from '@/commons/guards/jwt.auth.guard';
import { PermissionGuard } from '@/commons/guards/permission.guard';
import { uuidv7 } from 'uuidv7';
import { NotificationStatusEnum } from '@/database/database.enums';
import { UpdateNotificationDto } from './dto/update.dto';
import { MarkNotificationDto } from './dto/mark-dto';

@ApiTags('Organisation -> Notifications')
@ApiBearerAuth('bearer')
@ApiCookieAuth(process.env.AUTH_COOKIE_NAME)
@Controller('api/v1/organisation-notifications')
export class OrganisationNotificationController {
  constructor(
    private readonly organisationNotificationService: OrganisationNotificationService,
  ) {}

  @Post()
  @RequireAnyPermission(PermissionEnum.NOTIFICATION.CREATE)
  @HttpCode(201)
  @UseGuards(CustomJwtAuthGuard, PermissionGuard)
  @ApiOperation({
    summary:
      'Creates a notification scoped to current user Organisation. Drafted Notifications expires and removed after two(2) days of remaining as Draft',
  })
  @ApiCreatedResponse({
    description: 'Notification created successfully',
    example: {
      message: 'Notification created successfully.',
      success: true,
      data: {
        id: uuidv7(),
        createdAt: new Date(),
        draftExpiresAt: new Date(),
        publishedAt: new Date(),
        status: NotificationStatusEnum.PUBLISHED,
        organisationId: uuidv7(),
        createdByMembershipId: uuidv7(),
      },
    },
  })
  async createNotification(
    @Req() request: ExRequest,
    @Body() dto: CreateNotificationDto,
  ) {
    return await this.organisationNotificationService.createNotification(
      dto,
      request,
    );
  }

  @Patch(':notificationId')
  @RequireAnyPermission(PermissionEnum.NOTIFICATION.UPDATE)
  @HttpCode(201)
  @UseGuards(CustomJwtAuthGuard, PermissionGuard)
  @ApiOperation({
    summary: 'Updates a notification scoped to current user Organisation',
  })
  @ApiCreatedResponse({
    description: 'Notification updated successfully',
    example: {
      message: 'Notification updated successfully.',
      success: true,
      data: {
        id: '01a217e4-f055-7484-a8e3-03a23b2c31b6',
        createdAt: '2026-11-26T12:46:49.409Z',
        draftExpiresAt: '2026-11-28T12:46:49.429Z',
        status: 'DRAFT',
        publishedAt: null,
        organisationId: '01a217e4-ea3e-71f5-9175-35c1003adac6',
        title: 'Updated draft title',
        message: 'Updated draft body',
        createdByMembershipId: '01a217e4-ea4c-715a-ab44-1133deffbf64',
      },
    },
  })
  async updateNotification(
    @Req() request: ExRequest,
    @Body() dto: UpdateNotificationDto,
    @Param(
      'notificationId',
      new ParseUUIDPipe({ version: '7', optional: false }),
    )
    notificationId: string,
  ) {
    return await this.organisationNotificationService.updateNotification(
      request,
      dto,
      notificationId,
    );
  }

  @Post(':notificationId/publish')
  @RequireAnyPermission(PermissionEnum.NOTIFICATION.UPDATE)
  @HttpCode(201)
  @UseGuards(CustomJwtAuthGuard, PermissionGuard)
  @ApiOperation({
    summary: 'Publishes a notification scoped to current user Organisation',
  })
  @ApiCreatedResponse({
    description: 'Notification published successfully',
    example: {
      message: 'Notification published successfully.',
      success: true,
      data: {
        id: '01a217e4-f055-7484-a8e3-03a23b2c31b6',
        createdAt: '2026-11-26T12:46:49.409Z',
        draftExpiresAt: '2026-11-28T12:46:49.429Z',
        status: 'DRAFT',
        publishedAt: null,
        organisationId: '01a217e4-ea3e-71f5-9175-35c1003adac6',
        title: 'Updated draft title',
        message: 'Updated draft body',
        createdByMembershipId: '01a217e4-ea4c-715a-ab44-1133deffbf64',
      },
    },
  })
  async publishNotification(
    @Req() request: ExRequest,
    @Param(
      'notificationId',
      new ParseUUIDPipe({ version: '7', optional: false }),
    )
    notificationId: string,
  ) {
    return await this.organisationNotificationService.publishNotification(
      request,
      notificationId,
    );
  }

  @Delete(':notificationId')
  @RequireAnyPermission(PermissionEnum.NOTIFICATION.DELETE)
  @HttpCode(200)
  @UseGuards(CustomJwtAuthGuard, PermissionGuard)
  @ApiOperation({
    summary: 'Deletes a notification scoped to current user Organisation',
  })
  @ApiOkResponse({
    description: 'Notification removed successfully',
    example: {
      message: 'Notification removed successfully.',
      success: true,
      data: {
        id: '01a217e4-f055-7484-a8e3-03a23b2c31b6',
        createdAt: '2026-11-26T12:46:49.409Z',
        draftExpiresAt: '2026-11-28T12:46:49.429Z',
        status: 'DRAFT',
        publishedAt: null,
        organisationId: '01a217e4-ea3e-71f5-9175-35c1003adac6',
        title: 'Updated draft title',
        message: 'Updated draft body',
        createdByMembershipId: '01a217e4-ea4c-715a-ab44-1133deffbf64',
      },
    },
  })
  async deleteNotification(
    @Req() request: ExRequest,
    @Param(
      'notificationId',
      new ParseUUIDPipe({ version: '7', optional: false }),
    )
    notificationId: string,
  ) {
    return await this.organisationNotificationService.deleteNotification(
      request,
      notificationId,
    );
  }

  @Patch(':notificationId/members')
  @RequireAnyPermission(PermissionEnum.NOTIFICATION.READ)
  @HttpCode(201)
  @UseGuards(CustomJwtAuthGuard, PermissionGuard)
  @ApiOperation({
    summary:
      'Mark notification(s) scoped to current user Organisationas read/unread',
  })
  @ApiCreatedResponse({
    description: 'Notification updated successfully',
    example: {
      message: 'Notification updated successfully.',
      success: true,
      data: {
        primary: {
          notificationId: uuidv7(),
          recipientId: uuidv7(),
          membershipId: uuidv7(),
          readAt: new Date(),
          isRead: true,
          alreadyInRequestedState: true,
        },
        items: [
          {
            notificationId: uuidv7(),
            recipientId: uuidv7(),
            membershipId: uuidv7(),
            readAt: new Date(),
            isRead: true,
            alreadyInRequestedState: true,
          },
        ],
      },
    },
  })
  async markNotificationAsRead(
    @Req() request: ExRequest,
    @Param(
      'notificationId',
      new ParseUUIDPipe({ version: '7', optional: false }),
    )
    notificationId: string,
    @Body() dto: MarkNotificationDto,
  ) {
    return await this.organisationNotificationService.markNotificationAsRead(
      request,
      notificationId,
      dto,
    );
  }

  @Patch('memberships/:membershipId/read-all')
  @HttpCode(201)
  @UseGuards(CustomJwtAuthGuard, PermissionGuard)
  @RequireAnyPermission(PermissionEnum.NOTIFICATION.READ)
  @ApiOperation({
    summary: 'Mark all unread published notifications as read for a membership',
  })
  @ApiOkResponse({
    description: 'Unread notifications marked as read',
    example: {
      message: `Marked 32 notification(s) as read`,
      success: true,
      data: {
        membershipId: uuidv7(),
        updatedCount: 32,
        readAt: new Date(),
      },
    },
  })
  async markAllNotificationsAsRead(
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Req() request: ExRequest,
  ) {
    return await this.organisationNotificationService.markAllNotificationsAsRead(
      request,
      membershipId,
    );
  }
}
