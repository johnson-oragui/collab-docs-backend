import { ActionEnum, TActionEnum } from '@/commons/enums';
import {
  OrganisationMembershipStatusEnum,
  TOrganisationMembershipStatusEnum,
} from '@/database/database.enums';
import { GQLUserModel } from '@/user/graphql/user.model';
import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

@ObjectType('GQLMembershipSuspensionHistories')
export class GQLMembershipSuspensionHistories {
  @Field(() => ID)
  id!: string;

  @Field(() => OrganisationMembershipStatusEnum, { nullable: true })
  status?: TOrganisationMembershipStatusEnum | null;

  @Field(() => Date, { nullable: true })
  suspendedTill?: Date | null;

  @Field(() => Date, { nullable: true })
  createdAt?: Date | null;

  @Field(() => Date, { nullable: true })
  suspendedAt?: Date | null;

  @Field(() => String, { nullable: true })
  reason?: string | null;

  @Field(() => ActionEnum, { nullable: true })
  action?: TActionEnum | null;

  @Field(() => GQLUserModel, { nullable: true })
  actor?: GQLUserModel | null;
}

registerEnumType(ActionEnum, {
  name: 'SuspensionHistoryActionEnum',
  description: 'Action taken on a membership suspension history record.',
});

registerEnumType(OrganisationMembershipStatusEnum, {
  name: 'OrganisationMembershipStatusEnum',
  description: 'Status of an organisation membership.',
});
