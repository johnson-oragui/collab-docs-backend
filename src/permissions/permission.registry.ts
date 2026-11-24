export const PermissionEnum = {
  DOCUMENT: {
    CREATE: 'document:create',
    DELETE: 'document:delete',
    UPDATE: 'document:update',
    READ: 'document:read',
  },
  DOCUMENT_COMMENT: {
    CREATE: 'document_comment:create',
    DELETE: 'document_comment:delete',
    UPDATE: 'document_comment:update',
    READ: 'document_comment:read',
  },
  DOCUMENT_INVITATION: {
    CREATE: 'document_invitation:create',
    DELETE: 'document_invitation:delete',
    UPDATE: 'document_invitation:update',
    READ: 'document_invitation:read',
  },
  EXTERNAL_DOCUMENT_INVITATION: {
    CREATE: 'external_document_invitation:create',
    DELETE: 'external_document_invitation:delete',
    UPDATE: 'external_document_invitation:update',
    READ: 'external_document_invitation:read',
  },
  ORGANISATION: {
    CREATE: 'organisation:create',
    DELETE: 'organisation:delete',
    UPDATE: 'organisation:update',
    READ: 'organisation:read',
  },
  ORGANISATION_INVITATION: {
    CREATE: 'organisation_invitation:create',
    DELETE: 'organisation_invitation:delete',
    UPDATE: 'organisation_invitation:update',
    READ: 'organisation_invitation:read',
  },
  ORGANISATION_MEMBERSHIP: {
    CREATE: 'organisation_membership:create',
    DELETE: 'organisation_membership:delete',
    UPDATE: 'organisation_membership:update',
    READ: 'organisation_membership:read',
  },
  ORGANISATION_MEMBERSHIP_PERMISSION: {
    CREATE: 'organisation_membership_permission:create',
    DELETE: 'organisation_membership_permission:delete',
    UPDATE: 'organisation_membership_permission:update',
    READ: 'organisation_membership_permission:read',
  },
  ORGANISATION_MEMBERSHIP_ROLE: {
    CREATE: 'organisation_membership_role:create',
    DELETE: 'organisation_membership_role:delete',
    UPDATE: 'organisation_membership_role:update',
    READ: 'organisation_membership_role:read',
  },
  ORGANISATION_CHAT: {
    CREATE: 'organisation_chat:create',
    DELETE: 'organisation_chat:delete',
    UPDATE: 'organisation_chat:update',
    READ: 'organisation_chat:read',
  },
  PLATFORM_MEMBER: {
    DELETE: 'platform_member:delete',
    CREATE: 'platform_member:create',
    UPDATE: 'platform_member:update',
    READ: 'platform_member:read',
  },
  MEMBER_ORGANISATION: {
    CREATE: 'member_organisation:create',
    DELETE: 'member_organisation:delete',
    UPDATE: 'member_organisation:update',
    READ: 'member_organisation:read',
  },
  ADMIN: {
    CREATE: 'admin:create',
    DELETE: 'admin:delete',
    UPDATE: 'admin:update',
    READ: 'admin:read',
  },
  MEMBER: {
    CREATE: 'member:create',
    DELETE: 'member:delete',
    UPDATE: 'member:update',
    READ: 'member:read',
  },
  ROLE: {
    CREATE: 'role:create',
    DELETE: 'role:delete',
    UPDATE: 'role:update',
    READ: 'role:read',
  },
  AUDIT: {
    READ: 'audit:read',
  },
} as const;

export type TPermissionEnum = {
  [
    K in keyof typeof PermissionEnum
  ]: (typeof PermissionEnum)[K][keyof (typeof PermissionEnum)[K]];
}[keyof typeof PermissionEnum];

export const DEFAULT_ORG_ADMIN_PERMISSION_ENUM = {
  DOCUMENT: {
    CREATE: 'document:create',
    DELETE: 'document:delete',
    UPDATE: 'document:update',
    READ: 'document:read',
  },
  DOCUMENT_COMMENT: {
    CREATE: 'document_comment:create',
    DELETE: 'document_comment:delete',
    UPDATE: 'document_comment:update',
    READ: 'document_comment:read',
  },
  DOCUMENT_INVITATION: {
    CREATE: 'document_invitation:create',
    DELETE: 'document_invitation:delete',
    UPDATE: 'document_invitation:update',
    READ: 'document_invitation:read',
  },
  EXTERNAL_DOCUMENT_INVITATION: {
    CREATE: 'external_document_invitation:create',
    DELETE: 'external_document_invitation:delete',
    UPDATE: 'external_document_invitation:update',
    READ: 'external_document_invitation:read',
  },
  ORGANISATION: {
    READ: 'organisation:read',
  },
  ORGANISATION_CHAT: {
    CREATE: 'organisation_chat:create',
    DELETE: 'organisation_chat:delete',
    UPDATE: 'organisation_chat:update',
    READ: 'organisation_chat:read',
  },
  ORGANISATION_INVITATION: {
    CREATE: 'organisation_invitation:create',
    DELETE: 'organisation_invitation:delete',
    UPDATE: 'organisation_invitation:update',
    READ: 'organisation_invitation:read',
  },
  ORGANISATION_MEMBERSHIP: {
    CREATE: 'organisation_membership:create',
    DELETE: 'organisation_membership:delete',
    UPDATE: 'organisation_membership:update',
    READ: 'organisation_membership:read',
  },
  ORGANISATION_MEMBERSHIP_PERMISSION: {
    CREATE: 'organisation_membership_permission:create',
    DELETE: 'organisation_membership_permission:delete',
    UPDATE: 'organisation_membership_permission:update',
    READ: 'organisation_membership_permission:read',
  },
  ORGANISATION_MEMBERSHIP_ROLE: {
    CREATE: 'organisation_membership_role:create',
    DELETE: 'organisation_membership_role:delete',
    UPDATE: 'organisation_membership_role:update',
    READ: 'organisation_membership_role:read',
  },
  ORGANISATION_ADMIN: {
    READ: 'organisation_admin:read',
    CREATE: 'organisation_admin:create',
    DELETE: 'organisation_admin:delete',
    UPDATE: 'organisation_admin:update',
  },
  ROLE: {
    READ: 'role:read',
  },
  AUDIT: {
    READ: 'audit:read',
  },
} as const;

export const DEFAULT_ORG_SUB_ADMIN_PERMISSION_ENUM = {
  DOCUMENT: {
    CREATE: 'document:create',
    DELETE: 'document:delete',
    UPDATE: 'document:update',
    READ: 'document:read',
  },
  DOCUMENT_COMMENT: {
    CREATE: 'document_comment:create',
    DELETE: 'document_comment:delete',
    UPDATE: 'document_comment:update',
    READ: 'document_comment:read',
  },
  DOCUMENT_INVITATION: {
    CREATE: 'document_invitation:create',
    UPDATE: 'document_invitation:update',
    READ: 'document_invitation:read',
  },
  EXTERNAL_DOCUMENT_INVITATION: {
    CREATE: 'external_document_invitation:create',
    UPDATE: 'external_document_invitation:update',
    READ: 'external_document_invitation:read',
  },
  ORGANISATION: {
    READ: 'organisation:read',
  },
  ORGANISATION_CHAT: {
    CREATE: 'organisation_chat:create',
    DELETE: 'organisation_chat:delete',
    UPDATE: 'organisation_chat:update',
    READ: 'organisation_chat:read',
  },
  ORGANISATION_INVITATION: {
    CREATE: 'organisation_invitation:create',
    UPDATE: 'organisation_invitation:update',
    READ: 'organisation_invitation:read',
  },
  ORGANISATION_MEMBERSHIP_ROLE: {
    READ: 'organisation_membership_role:read',
  },
  ORGANISATION_MEMBERSHIP: {
    CREATE: 'organisation_membership:create',
    DELETE: 'organisation_membership:delete',
    UPDATE: 'organisation_membership:update',
    READ: 'organisation_membership:read',
  },
  ORGANISATION_ADMIN: {
    READ: 'organisation_admin:read',
  },
  ROLE: {
    READ: 'role:read',
  },
} as const;

export const DEFAULT_ORG_MEMBER_PERMISSION_ENUM = {
  DOCUMENT: {
    CREATE: 'document:create',
    DELETE: 'document:delete',
    UPDATE: 'document:update',
    READ: 'document:read',
  },
  DOCUMENT_COMMENT: {
    CREATE: 'document_comment:create',
    DELETE: 'document_comment:delete',
    UPDATE: 'document_comment:update',
    READ: 'document_comment:read',
  },
  DOCUMENT_INVITATION: {
    CREATE: 'document_invitation:create',
    UPDATE: 'document_invitation:update',
    READ: 'document_invitation:read',
  },
  EXTERNAL_DOCUMENT_INVITATION: {
    READ: 'external_document_invitation:read',
  },
  ORGANISATION: {
    READ: 'organisation:read',
  },
  ORGANISATION_CHAT: {
    CREATE: 'organisation_chat:create',
    UPDATE: 'organisation_chat:update',
    READ: 'organisation_chat:read',
  },
  ORGANISATION_INVITATION: {
    READ: 'organisation_invitation:read',
  },
  ORGANISATION_MEMBERSHIP: {
    READ: 'organisation_membership:read',
  },
  ORGANISATION_ADMIN: {
    READ: 'organisation_admin:read',
  },
  ROLE: {
    READ: 'role:read',
  },
} as const;

export type TDefaultPlatformAdminPermissions =
  (typeof PermissionEnum)[keyof typeof PermissionEnum];

export type TDefaultOrgAdminPermissions =
  (typeof DEFAULT_ORG_ADMIN_PERMISSION_ENUM)[keyof typeof DEFAULT_ORG_ADMIN_PERMISSION_ENUM];

export type TDefaultOrgSubAdminPermissions =
  (typeof DEFAULT_ORG_SUB_ADMIN_PERMISSION_ENUM)[keyof typeof DEFAULT_ORG_SUB_ADMIN_PERMISSION_ENUM];

export type TDefaultOrgmemberPermissions =
  (typeof DEFAULT_ORG_MEMBER_PERMISSION_ENUM)[keyof typeof DEFAULT_ORG_MEMBER_PERMISSION_ENUM];
