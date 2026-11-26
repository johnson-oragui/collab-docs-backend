import { Field, ID, ObjectType } from '@nestjs/graphql';
import {
  NotificationTypeEnum,
  type TNotificationTypeEnum,
} from '@/database/database.enums';

@ObjectType('GQLMembershipNotification', {
  description:
    'Published notification paired with membership-specific read state.',
})
export class GQLMembershipNotificationModel {
  @Field(() => ID)
  declare id: string;

  @Field(() => ID, { nullable: true })
  declare recipientId: string | null;

  @Field(() => ID, { nullable: true })
  declare membershipId: string | null;

  @Field(() => String, { nullable: true })
  declare title: string | null;

  @Field(() => String, { nullable: true })
  declare message: string | null;

  @Field(() => NotificationTypeEnum, { nullable: true })
  declare type: TNotificationTypeEnum | null;

  @Field(() => Date, { nullable: true })
  declare publishedAt: Date | null;

  @Field(() => Date, { nullable: true })
  declare readAt: Date | null;

  @Field(() => Boolean, { nullable: true })
  declare isRead: boolean | null;
}
