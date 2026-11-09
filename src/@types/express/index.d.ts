import { TAuthType } from '@/commons/guards/apiKey.guards';
import { TDecodedUser } from '@/jwt-service/jwt.interface';
import { OrganisationEntity } from '@/organisations/organisations.entity';
import { UserEntity } from '@/user/user.entity';

declare global {
  namespace Express {
    interface Request {
      user?: UserEntity | null;
      organisation?: OrganisationEntity | null;
      authType?: TAuthType | null;
      decodedUser: TDecodedUser | null;
    }
  }
}

export {};
