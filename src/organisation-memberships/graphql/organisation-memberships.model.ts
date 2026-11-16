import { TOrganisationMembershipStatusEnum } from '@/database/database.enums';
import { GQLRoleModel } from '@/roles/grapgql/role.model';
import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('GQLOrganisationMembershipModel')
export class GQLOrganisationMembershipModel {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  status?: TOrganisationMembershipStatusEnum | null;

  @Field(() => GQLRoleModel, { nullable: true })
  role?: GQLRoleModel | null;
}
