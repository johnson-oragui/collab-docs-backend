import { InvitePermissionsDto } from '@/permissions/dto/invitation-permissions.dto';
import { PermissionEnum } from '@/permissions/permission.registry';
import { PermissionEntity } from '@/permissions/permissions.entity';
import { snakeCaseToCamelcase } from './snakeCaseToCamelcase';

/**
 * Transforms an array of PermissionEntity objects into a nested
 * permission structure suitable for frontend forms or DTO responses.
 */
export function groupPermissionsToNested(
  permissionEntities: PermissionEntity[],
) {
  // Create a fast lookup Set of active permission strings
  const activePermissions = new Set(permissionEntities.map((p) => p.name));
  const result: Record<string, Record<string, boolean>> = {};

  for (const categoryKey of Object.keys(PermissionEnum)) {
    const categoryActions =
      PermissionEnum[categoryKey as keyof typeof PermissionEnum];

    // Convert category key to camelCase (e.g., DOCUMENT_COMMENT -> documentComment)
    const formattedCategoryKey = categoryKey
      .toLowerCase()
      .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

    result[formattedCategoryKey] = {};

    for (const actionKey of Object.keys(categoryActions)) {
      const permissionString =
        categoryActions[actionKey as keyof typeof categoryActions];
      const formattedActionKey = actionKey.toLowerCase();

      // Check if the entity array contains this specific permission string
      result[formattedCategoryKey][formattedActionKey] =
        activePermissions.has(permissionString);
    }
  }

  return result;
}

type NestedPermissions = Record<string, Record<string, boolean>>;

/**
 * Transforms a nested permission object (from frontend forms or DTOs)
 * back into a flat array of active permission string identifiers.
 */
export function nestedPermissionsToPermissionNames(
  permissions: NestedPermissions | InvitePermissionsDto,
): string[] {
  const activePermissionNames = new Set<string>();

  if (!permissions) {
    return [];
  }

  for (const categoryKey of Object.keys(
    PermissionEnum,
  ) as (keyof typeof PermissionEnum)[]) {
    const categoryActions = PermissionEnum[categoryKey];

    // Replicate the exact camelCase formatting used in groupPermissionsToNested
    // const formattedCategoryKey = categoryKey
    //   .toLowerCase()
    //   .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

    const userCategoryState = permissions[snakeCaseToCamelcase(categoryKey)];
    if (!userCategoryState) continue;

    for (const actionKey of Object.keys(
      categoryActions,
    ) as (keyof typeof categoryActions)[]) {
      const permissionString = categoryActions[actionKey];
      const formattedActionKey = actionKey.toLowerCase();

      // If set to true in the nested structure, add the raw permission string
      if (userCategoryState[formattedActionKey] === true) {
        activePermissionNames.add(permissionString);
      }
    }
  }

  return Array.from(activePermissionNames);
}

export const extractExplicitFalsePermissionNames = (
  permissions: InvitePermissionsDto | Record<string, Record<string, boolean>>,
): string[] => {
  if (!permissions) return [];

  const falseNames: string[] = [];
  for (const [categoryKey, actions] of Object.entries(permissions)) {
    if (!actions || typeof actions !== 'object') continue;
    // Convert camelCase category (e.g. documentComment -> document_comment)
    const snakeCategory = categoryKey.replace(/([A-Z])/g, '_$1').toLowerCase();

    for (const [actionKey, flag] of Object.entries(actions)) {
      if (flag === false) {
        falseNames.push(`${snakeCategory}:${actionKey.toLowerCase()}`);
      }
    }
  }
  return falseNames;
};
