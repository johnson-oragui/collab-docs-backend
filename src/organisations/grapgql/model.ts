import {
  OrganisationStatusEnum,
  TOrganisationStatusEnum,
} from '@/database/database.enums';
import { Field, ID, ObjectType } from '@nestjs/graphql';

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
