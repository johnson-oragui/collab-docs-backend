import {
  OrganisationMembershipStatusEnum,
  TOrganisationMembershipStatusEnum,
} from '@/database/database.enums';
import { GQLMembershipSuspensionHistories } from '@/org_membership_suspension_histories/graphql/model';
import { GQLOrganisationModel } from '@/organisations/grapgql/model';
import { GQLRoleModel } from '@/roles/grapgql/role.model';
import { GQLUserModel } from '@/user/graphql/user.model';
import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

@ObjectType('GQLOrganisationMembershipModel')
export class GQLOrganisationMembershipModel {
  @Field(() => ID)
  id!: string;

  @Field(() => OrganisationMembershipStatusEnum, { nullable: true })
  status?: TOrganisationMembershipStatusEnum | null;

  @Field(() => Date, { nullable: true })
  suspendedTill?: Date | null;

  @Field(() => Date, { nullable: true })
  createdAt?: Date | null;

  @Field(() => GQLUserModel, { nullable: true })
  user?: GQLUserModel | null;

  @Field(() => GQLOrganisationModel, { nullable: true })
  organisation?: GQLOrganisationModel | null;

  @Field(() => [GQLMembershipSuspensionHistories], { nullable: true })
  suspensionHistories?: GQLMembershipSuspensionHistories[] | null;

  @Field(() => GQLRoleModel, { nullable: true })
  role?: GQLRoleModel | null;
}

registerEnumType(OrganisationMembershipStatusEnum, {
  name: 'OrganisationMembershipStatusEnum',
  description: 'Status of an organisation membership.',
});
