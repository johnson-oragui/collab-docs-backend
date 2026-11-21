import { createGqlResponseLoader } from '@/commons/util/createGQLResponseLoader';
import { GQLUserModel } from '../graphql/user.model';

export const UserResponseDto = createGqlResponseLoader(
  GQLUserModel,
  undefined,
  {
    isArray: false,
  },
);
export type UserResponseType = InstanceType<typeof UserResponseDto>;
