import { generateRandomIPv4 } from '@/commons/util/generateRandomIPv4';

export const runGraphql = async (
  http: any,
  query: string,
  variables?: Record<string, unknown>,
  accessToken?: string,
) => {
  const req = http
    .post('/api/graphql')
    .set('X-Forwarded-For', generateRandomIPv4());
  if (accessToken) {
    req.set('Authorization', `Bearer ${accessToken}`);
  }
  return req.send({ query, variables });
};
