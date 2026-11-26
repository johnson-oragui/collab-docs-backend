import { UseGuards } from '@nestjs/common';
import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { type Request as ExRequest } from 'express';
import { GQLMembershipNotificationModel } from './organisation-notification.model';
import { OrganisationNotificationService } from '../organisation-notification.service';
import {
  GetNotificationsQueryInputDto,
  MembershipNotificationsResponseDto,
} from './dto/get-notifications-input.dto';
import { PermissionEnum } from '@/permissions/permission.registry';
import { RequirePermissions } from '@/commons/decorators/require-permissions.decorator';
import { CustomJwtAuthGuard } from '@/commons/guards/jwt.auth.guard';
import { PermissionGuard } from '@/commons/guards/permission.guard';

@Resolver(() => GQLMembershipNotificationModel)
export class OrganisationNotificationsResolver {
  constructor(
    private readonly notificationsService: OrganisationNotificationService,
  ) {}

  @Query(() => MembershipNotificationsResponseDto, {
    name: 'getMembershipNotifications',
    description:
      'Retrieves published notifications and membership read state for a specific membership.',
  })
  @RequirePermissions(PermissionEnum.NOTIFICATION.READ)
  @UseGuards(CustomJwtAuthGuard, PermissionGuard)
  async getMembershipNotifications(
    @Context('req') req: ExRequest,
    @Args('filter', {
      type: () => GetNotificationsQueryInputDto,
      nullable: true,
    })
    filter: GetNotificationsQueryInputDto,
  ): Promise<MembershipNotificationsResponseDto> {
    return await this.notificationsService.getMembershipNotifications(
      req,
      filter,
    );
  }
}
