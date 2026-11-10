import * as crypto from 'crypto';

export function generateRandomDigits(limit: number): string {
  if (limit <= 0) {
    throw new Error('Limit must be a positive integer greater than 0.');
  }

  let result = '';
  for (let i = 0; i < limit; i++) {
    // Generates a random integer from 0 to 9 inclusive
    const digit = crypto.randomInt(0, 10);
    result += digit.toString();
  }

  return result;
}
