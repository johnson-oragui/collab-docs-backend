import { RedisClientType } from 'redis';
import { buildPermissionCacheKey } from './buildPermissionCacheKey';

export const invalidateMemberPermissionCache = async (
  redisClient: RedisClientType,
  organisationId: string,
  membershipId: string,
  userId: string,
): Promise<void> => {
  if (!redisClient) return;

  const keys = [
    buildPermissionCacheKey(organisationId, membershipId),
    buildPermissionCacheKey(organisationId, userId),
  ];

  try {
    const resultCount = await redisClient.del(keys);
    // console.log('resultCount:+++++++++++++++++++++++++++++++++', resultCount);
  } catch (err) {
    // TODO: Do not fail a committed role reassignment if Redis is temporarily unavailable;
    // log it so it can be monitored or retried.
    console.warn(
      `Failed to invalidate Redis permission cache for membership ${membershipId}: ${(err as Error).message}`,
    );
  }
};
