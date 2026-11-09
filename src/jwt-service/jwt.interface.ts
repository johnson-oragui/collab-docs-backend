import { TRoleEnum } from '@/database/database.enums';
import { JwtPayload } from 'jsonwebtoken';

export interface IJWTSignPayloadRequest {
  id: string;
  organisationId: string;
  organisationRole: TRoleEnum;
  // might add platform admin role too.
  sid: string;
  jti: string;
}

export type TDecodedUser = JwtPayload & IJWTSignPayloadRequest;
