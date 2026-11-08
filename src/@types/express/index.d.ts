import { TAuthType } from '@/commons/guards/apiKey.guards';
import { OrganisationEntity } from '@/organisations/organisations.entity';
import { UserEntity } from '@/user/user.entity';


declare global {
  namespace Express {
    interface Request {
      user?: UserEntity | null;
      organisation?: OrganisationEntity | null;
      authType?: TAuthType | null;
    }
  }
}

export {};
