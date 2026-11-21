export const PermissionAssignmentModeEnum = Object.freeze({
  DEFAULT: 'DEFAULT',
  CUSTOM: 'CUSTOM',
  NONE: 'NONE',
} as const);

export type TPermissionAssignmentModeEnum =
  (typeof PermissionAssignmentModeEnum)[keyof typeof PermissionAssignmentModeEnum];

export const OrganisationRoleEnum = Object.freeze({
  ORG_ADMIN: 'ORG_ADMIN',
  ORG_SUB_ADMIN: 'ORG_SUB_ADMIN',
  ORG_MEMBER: 'ORG_MEMBER',
} as const);

export type TOrganisationRoleEnum =
  (typeof OrganisationRoleEnum)[keyof typeof OrganisationRoleEnum];

export const OrganisationAuditEventEnum = Object.freeze({
  INVITATION_CREATED: 'INVITATION_CREATED',
  INVITATION_ACCEPTED: 'INVITATION_ACCEPTED',
  INVITATION_REVOKED: 'INVITATION_REVOKED',
  INVITATION_EXPIRED: 'INVITATION_EXPIRED',
  INVITATION_RESENT: 'INVITATION_RESENT',
  MEMBER_SUSPENDED: 'MEMBER_SUSPENDED',
  MEMBER_UNSUSPENDED: 'MEMBER_UNSUSPENDED',
  MEMBERSHIP_PERMISSIONS_UPDATED: 'MEMBERSHIP_PERMISSIONS_UPDATED',
} as const);

export type TOrganisationAuditEventEnum =
  (typeof OrganisationAuditEventEnum)[keyof typeof OrganisationAuditEventEnum][keyof (typeof OrganisationAuditEventEnum)[keyof typeof OrganisationAuditEventEnum]];
export const ActionEnum = Object.freeze({
  SUSPENDED: 'SUSPENDED',
  UNSUSPENDED: 'UNSUSPENDED',
} as const);

export type TActionEnum = (typeof ActionEnum)[keyof typeof ActionEnum];
