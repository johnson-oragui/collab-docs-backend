import {
  groupPermissionsToNested,
  nestedPermissionsToPermissionNames,
} from '@/commons/util/groupPermissionsToNested';
import { PermissionEnum } from '@/permissions/permission.registry';

describe('PermissionsUtils', () => {
  describe('nestedPermissionsToPermissionNames', () => {
    it('should flatten selected permissions into permission identifiers', () => {
      const permissions = {
        document: {
          create: true,
          read: true,
          update: false,
          delete: false,
        },
        documentComment: {
          create: true,
          read: false,
          update: false,
          delete: false,
        },
        audit: {
          read: true,
        },
      };

      const result = nestedPermissionsToPermissionNames(permissions);

      expect(result).toEqual([
        PermissionEnum.DOCUMENT.CREATE,
        PermissionEnum.DOCUMENT.READ,
        PermissionEnum.DOCUMENT_COMMENT.CREATE,
        PermissionEnum.AUDIT.READ,
      ]);
    });

    it('should return an empty array when no permissions are selected', () => {
      const permissions = {
        document: {
          create: false,
          read: false,
          update: false,
          delete: false,
        },
      };

      expect(nestedPermissionsToPermissionNames(permissions)).toEqual([]);
    });

    it('should return an empty array when permissions object is empty', () => {
      expect(nestedPermissionsToPermissionNames({})).toEqual([]);
    });

    it('should ignore omitted permission categories', () => {
      const permissions = {
        document: {
          create: true,
        },
      };

      expect(nestedPermissionsToPermissionNames(permissions)).toEqual([
        PermissionEnum.DOCUMENT.CREATE,
      ]);
    });

    it('should ignore omitted permission actions', () => {
      const permissions = {
        document: {
          create: true,
        },
      };

      expect(nestedPermissionsToPermissionNames(permissions)).toEqual([
        PermissionEnum.DOCUMENT.CREATE,
      ]);
    });

    it('should ignore unknown permission categories', () => {
      const permissions = {
        document: {
          create: true,
        },
        unknownCategory: {
          create: true,
        },
      };

      expect(nestedPermissionsToPermissionNames(permissions)).toEqual([
        PermissionEnum.DOCUMENT.CREATE,
      ]);
    });

    it('should ignore unknown permission actions', () => {
      const permissions = {
        document: {
          create: true,
          unknown: true,
        },
      };

      expect(nestedPermissionsToPermissionNames(permissions)).toEqual([
        PermissionEnum.DOCUMENT.CREATE,
      ]);
    });

    it('should include every explicitly selected permission', () => {
      const permissions = {
        document: {
          create: true,
          read: true,
          update: true,
          delete: true,
        },
        documentComment: {
          create: true,
          read: true,
          update: true,
          delete: true,
        },
        documentInvitation: {
          create: true,
          read: true,
          update: true,
          delete: true,
        },
        externalDocumentInvitation: {
          create: true,
          read: true,
          update: true,
          delete: true,
        },
        organisation: {
          create: true,
          read: true,
          update: true,
          delete: true,
        },
        organisationInvitation: {
          create: true,
          read: true,
          update: true,
          delete: true,
        },
        organisationMembership: {
          create: true,
          read: true,
          update: true,
          delete: true,
        },
        organisationOwnershipTransfer: {
          create: true,
          read: true,
        },
        organisationMembershipPermission: {
          create: true,
          read: true,
          update: true,
          delete: true,
        },
        organisationMembershipRole: {
          create: true,
          read: true,
          update: true,
          delete: true,
        },
        organisationChat: {
          create: true,
          read: true,
          update: true,
          delete: true,
        },
        platformMember: {
          create: true,
          read: true,
          update: true,
          delete: true,
        },
        memberOrganisation: {
          create: true,
          read: true,
          update: true,
          delete: true,
        },
        admin: {
          create: true,
          read: true,
          update: true,
          delete: true,
        },
        member: {
          create: true,
          read: true,
          update: true,
          delete: true,
        },
        role: {
          create: true,
          read: true,
          update: true,
          delete: true,
        },
        audit: {
          read: true,
        },
      };

      const result = nestedPermissionsToPermissionNames(permissions);

      const expected = Object.values(PermissionEnum).flatMap((category) =>
        Object.values(category),
      );

      expect(result).toHaveLength(expected.length);
      expect(result).toEqual(expected);
    });
  });

  describe('groupPermissionsToNested', () => {
    it('should expand permission identifiers into structured permissions', () => {
      const permissions: { name: string }[] = [
        { name: 'document:create' },
        { name: 'document:read' },
        { name: 'document_comment:create' },
        { name: 'audit:read' },
      ];

      const result = groupPermissionsToNested(permissions as any);

      expect(result.document).toEqual({
        create: true,
        delete: false,
        update: false,
        read: true,
      });

      expect(result.documentComment).toEqual({
        create: true,
        delete: false,
        update: false,
        read: false,
      });

      expect(result.audit).toEqual({
        read: true,
      });
    });

    it('should initialise every permission to false when given an empty array', () => {
      const result = groupPermissionsToNested([]);

      for (const category of Object.values(result)) {
        for (const enabled of Object.values(category)) {
          expect(enabled).toBe(false);
        }
      }
    });

    it('should expand all supported permission categories', () => {
      const allPermissions = Object.values(PermissionEnum).flatMap((category) =>
        Object.values(category).flatMap((cat) => ({ name: cat })),
      );

      const result = groupPermissionsToNested(allPermissions as any);

      for (const category of Object.values(result)) {
        for (const enabled of Object.values(category)) {
          expect(enabled).toBe(true);
        }
      }
    });

    it('should deduplicate repeated permissions', () => {
      const permissions: { name: string }[] = [
        { name: 'document:create' },
        { name: 'document:create' },
        { name: 'document:read' },
      ];

      const result = groupPermissionsToNested(permissions as any);

      expect(result.document).toEqual({
        create: true,
        delete: false,
        update: false,
        read: true,
      });
    });
  });

  describe('permission conversion round-trip', () => {
    it('should preserve selected permissions after flattening and expanding', () => {
      const originalPermissions = {
        document: {
          create: true,
          read: true,
          update: false,
          delete: false,
        },
        documentComment: {
          create: false,
          read: true,
          update: false,
          delete: false,
        },
        audit: {
          read: true,
        },
      };

      const flattened = nestedPermissionsToPermissionNames(
        originalPermissions,
      ).map((p) => ({ name: p }));
      const expanded = groupPermissionsToNested(flattened as any);

      expect(expanded.document).toEqual({
        create: true,
        delete: false,
        update: false,
        read: true,
      });

      expect(expanded.documentComment).toEqual({
        create: false,
        delete: false,
        update: false,
        read: true,
      });

      expect(expanded.audit).toEqual({
        read: true,
      });
    });

    it('should preserve all permission values when all categories are supplied', () => {
      const originalPermissions = Object.fromEntries(
        Object.entries(PermissionEnum).map(([category, actions]) => [
          category
            .toLowerCase()
            .replace(/_([a-z])/g, (_, character: string) =>
              character.toUpperCase(),
            ),
          Object.fromEntries(
            Object.keys(actions).map((action) => [
              action.toLowerCase(),
              action === 'READ' || action === 'CREATE',
            ]),
          ),
        ]),
      );

      const flattened = nestedPermissionsToPermissionNames(
        originalPermissions,
      ).map((p) => ({ name: p }));
      const expanded = groupPermissionsToNested(flattened as any);

      expect(expanded).toEqual(originalPermissions);
    });
  });
});
