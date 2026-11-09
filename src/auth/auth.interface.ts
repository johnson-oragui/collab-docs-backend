import {
  AuthenticatedLoginDataDto,
  OrganisationSelectionDataDto,
} from './dto/login.dto';

export interface ILoginMetadata {
  userAgent?: string | null;
  ipAddress?: string | null;
}

export type TLoginResponseData =
  OrganisationSelectionDataDto | AuthenticatedLoginDataDto;
