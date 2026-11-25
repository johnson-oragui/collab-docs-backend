export const buildPermissionCacheKey = (
  organisationId: string,
  membershipId: string,
): string => {
  return `org:${organisationId}:membership:${membershipId}:permissions`;
};
