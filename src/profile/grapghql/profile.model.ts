import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('GQLProfileModel')
export class GQLProfileModel {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  bio?: string | null;

  @Field(() => String, { nullable: true })
  avatarUrl?: string | null;
}
