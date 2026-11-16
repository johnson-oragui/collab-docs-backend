import { Field, ObjectType } from '@nestjs/graphql';
import { Type } from '@nestjs/common';

export function createGqlResponseLoader<T>(TItemClass: Type<T>) {
  @ObjectType(`Gql${TItemClass.name}Response`, { isAbstract: true })
  abstract class GqlResponseClass {
    @Field(() => Boolean, {
      defaultValue: true,
      description: 'Indicates success status',
    })
    success!: boolean;

    @Field(() => String, {
      defaultValue: 'Request completed successfully.',
      description: 'Response message',
    })
    message!: string;

    @Field(() => TItemClass, { description: 'Payload data' })
    data!: T;
  }

  return GqlResponseClass;
}
