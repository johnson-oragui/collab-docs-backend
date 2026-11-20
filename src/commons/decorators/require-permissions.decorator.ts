import { TPermissionEnum } from '@/permissions/permission.registry';
import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSIONS_KEY = 'required_permissions';

export type TPermissionCheckMode = 'ALL' | 'ANY';

export interface IPermissionRequirement {
  permissions: TPermissionEnum[];
  mode: TPermissionCheckMode;
}

// allow passing in more than one permissions to be required for an action
export const RequirePermissions = (...permissions: TPermissionEnum[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, {
    permissions,
    mode: 'ALL',
  } satisfies IPermissionRequirement);

// require that user permission to have atleast one/all of the required
export const RequireAnyPermission = (...permissions: TPermissionEnum[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, {
    permissions,
    mode: 'ANY',
  } satisfies IPermissionRequirement);
