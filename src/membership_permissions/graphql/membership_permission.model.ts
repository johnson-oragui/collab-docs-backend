import { GQLGroupedOrganisationPermissionsModel } from '@/permissions/graphql/permission.model';
import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('GQLOrganisationMembershipPermissionModel')
export class GQLOrganisationMembershipPermissionModel {
  @Field(() => ID)
  id!: string;

  @Field(() => GQLGroupedOrganisationPermissionsModel, { nullable: true })
  declare permissions: GQLGroupedOrganisationPermissionsModel | null;
}
