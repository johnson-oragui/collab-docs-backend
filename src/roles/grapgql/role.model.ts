import { type TRoleEnum } from '@/database/database.enums';
import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('GQLRoleModel')
export class GQLRoleModel {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  name?: TRoleEnum | null;
}
