import { GQLOrganisationMembershipModel } from '@/organisation-memberships/graphql/organisation-memberships.model';
import { GQLProfileModel } from '@/profile/grapghql/profile.model';
import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class GQLUserModel {
  @Field(() => ID, { description: 'The UserId. UUID format' })
  id!: string;

  @Field({ description: 'Registered User email' })
  email!: string;

  @Field(() => String, { nullable: true, description: 'User firstname' })
  firstName?: string | null;

  @Field(() => String, { nullable: true, description: 'user lastname' })
  lastName?: string | null;

  @Field(() => GQLProfileModel, {
    nullable: true,
    description: 'User profile details',
  })
  profile?: GQLProfileModel | null;

  @Field(() => [GQLOrganisationMembershipModel], {
    nullable: true,
    description: 'Organisation memberships associated with the user',
    defaultValue: [],
  })
  organisationMemberships?: GQLOrganisationMembershipModel[] | null;
}
