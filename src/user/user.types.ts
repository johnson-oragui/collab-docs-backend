import {
  TOrganisationMembershipStatusEnum,
  TRoleEnum,
} from '@/database/database.enums';

export type CurrentUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  profile?: {
    id: string;
    avatarUrl?: string | null;
    bio?: string | null;
  } | null;
  organisationMemberships?:
    | {
        id: string;
        role?: { name?: TRoleEnum | null; id: string } | null;
        status?: TOrganisationMembershipStatusEnum | null;
      }[]
    | null;
};
