import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  NotificationTypeEnum,
  type TNotificationTypeEnum,
} from '@/database/database.enums';
import { GQLMembershipNotificationModel } from '../organisation-notification.model';
import { createGqlResponseLoader } from '@/commons/util/createGQLResponseLoader';

@InputType({
  description:
    'Filters and pagination options for querying organisation membership notifications.',
})
export class GetNotificationsQueryInputDto {
  @Field(() => ID, {
    nullable: true,
    description:
      'Target membership ID (UUID). Defaults to actor membership in active organisation.',
  })
  @IsOptional()
  @IsUUID()
  membershipId?: string;

  @Field(() => Int, {
    nullable: true,
    defaultValue: 1,
    description: 'Page number (1-indexed).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @Field(() => Int, {
    nullable: true,
    defaultValue: 20,
    description: 'Number of records per page (max 100).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @Field(() => Boolean, {
    nullable: true,
    defaultValue: undefined,
    description:
      'When true, return only unread notifications (readAt is null).',
  })
  @IsOptional()
  @IsBoolean()
  unreadOnly?: boolean;

  @Field(() => NotificationTypeEnum, {
    nullable: true,
    description: 'Optional filter by notification type.',
  })
  @IsOptional()
  @IsEnum(NotificationTypeEnum)
  type?: TNotificationTypeEnum;
}

@ObjectType('GQLMembershipNotificationsPaginatedResponse')
export class MembershipNotificationsResponseDto extends createGqlResponseLoader(
  GQLMembershipNotificationModel,
  undefined,
  { isArray: true, nullableData: false },
) {}

export type MembershipNotificationsResponseDtoType = InstanceType<
  typeof MembershipNotificationsResponseDto
>;
