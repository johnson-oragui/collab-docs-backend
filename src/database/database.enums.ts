export const RoleScopeEnum = Object.freeze({
  APPLICATION: 'APPLICATION',
  ORGANISATION: 'ORGANISATION',
} as const);
export type TRoleScopeEnum = (typeof RoleScopeEnum)[keyof typeof RoleScopeEnum];

export const RoleEnum = Object.freeze({
  APP_SUPER_ADMIN: 'APP_SUPER_ADMIN',
  ORG_ADMIN: 'ORG_ADMIN',
  ORG_MEMBER: 'ORG_MEMBER',
} as const);

export type TRoleEnum = (typeof RoleEnum)[keyof typeof RoleEnum];

export const OrganisationMembershipStatusEnum = Object.freeze({
  ACTIVE: 'ACTIVE',
  PENDING: 'PENDING',
} as const);

export type TOrganisationMembershipStatusEnum =
  (typeof OrganisationMembershipStatusEnum)[keyof typeof OrganisationMembershipStatusEnum];
export const InvitationStatusEnum = Object.freeze({
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
} as const);
export type TInvitationStatusEnum =
  (typeof InvitationStatusEnum)[keyof typeof InvitationStatusEnum];

export const OrganisationApiKeyStatusEnum = Object.freeze({
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  DEACTIVATED: 'DEACTIVATED',
} as const);

export type TOrganisationApiKeyStatusEnum =
  (typeof OrganisationApiKeyStatusEnum)[keyof typeof OrganisationApiKeyStatusEnum];
