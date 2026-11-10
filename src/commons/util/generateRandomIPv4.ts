import { randomInt } from 'node:crypto';

export function generateRandomIPv4(): string {
  return Array.from(
    { length: 4 },
    () => randomInt(0, 256),
  ).join('.');
}