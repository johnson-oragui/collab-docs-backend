import { UserSchema } from '../../user/schema/user.schema';

export interface AuthenticatedRequest {
  user?: UserSchema;
}
