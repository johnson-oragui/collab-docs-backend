import { Field, ObjectType } from '@nestjs/graphql';
import { Type } from '@nestjs/common';
import { GQLPaginationMetaModel } from '../dtos/pagination-meta.dto';

export interface GqlResponseOptions<IsArray extends boolean = false> {
  isArray?: IsArray;
  nullableData?: boolean;
}

export function createGqlResponseLoader<
  T,
  M extends GQLPaginationMetaModel = GQLPaginationMetaModel,
  IsArray extends boolean = false,
>(
  TItemClass: Type<T>,
  MItemClass: Type<M> = GQLPaginationMetaModel as unknown as Type<M>,
  options?: GqlResponseOptions<IsArray>,
) {
  const isArray = Boolean(options?.isArray);
  const nullableData = options?.nullableData ?? false;

  @ObjectType(`Gql${TItemClass.name}${isArray ? 'List' : ''}Response`, {
    isAbstract: true,
  })
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

    @Field(() => (isArray ? [TItemClass] : TItemClass), {
      nullable: nullableData,
      description: 'Payload data',
    })
    data!: IsArray extends true ? T[] : T;

    @Field(() => MItemClass, {
      nullable: true,
      description: 'Payload pagination meta',
    })
    meta?: M;
  }

  return GqlResponseClass;
}
