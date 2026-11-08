import { AsyncLocalStorage } from 'async_hooks';

export interface RequestStore {
  requestId: string;
  userId?: string;
}

export const asyncStore = new AsyncLocalStorage<RequestStore>();
