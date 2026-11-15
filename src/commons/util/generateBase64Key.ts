import * as crypto from 'crypto';

/**
 * Generates a cryptographically secure 32-byte (256-bit) random key 
 * and returns it as a Base64-encoded string.
 */
export function generateBase64Key(byteLength: number = 32): string {
  return crypto.randomBytes(byteLength).toString('base64');
}
