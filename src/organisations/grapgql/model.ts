import {
  OrganisationStatusEnum,
  TOrganisationStatusEnum,
} from '@/database/database.enums';
import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

@ObjectType('GQLOrganisationModel')
export class GQLOrganisationModel {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  name?: string | null;

  @Field(() => OrganisationStatusEnum, { nullable: true })
  status?: TOrganisationStatusEnum | null;

  @Field(() => String, { nullable: true })
  slug?: string | null;

  @Field(() => String, { nullable: true })
  email?: string | null;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => Date, { nullable: true })
  createdAt?: Date | null;
}

registerEnumType(OrganisationStatusEnum, {
  name: 'OrganisationStatusEnum',
  description: 'Status of an organisation membership.',
});
