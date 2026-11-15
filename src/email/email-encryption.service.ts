import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { IEmailPayload, IEncryptedEmailPayload } from './email.interface';

@Injectable()
export class EmailEncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 12;
  private readonly authTagLength = 16;
  private readonly encryptionKey: Buffer;

  constructor(private readonly configService: ConfigService) {
    const encodedKey = this.configService.getOrThrow<string>(
      'EMAIL_ENCRYPTION_KEY',
    );

    const key = Buffer.from(encodedKey, 'base64');

    if (key.length !== 32) {
      throw new Error(
        'EMAIL_ENCRYPTION_KEY must be a valid base64-encoded 32-byte key',
      );
    }

    this.encryptionKey = key;
  }

  encrypt(payload: IEmailPayload): IEncryptedEmailPayload {
    try {
      const iv = randomBytes(this.ivLength);

      const cipher = createCipheriv(this.algorithm, this.encryptionKey, iv, {
        authTagLength: this.authTagLength,
      });

      const plaintext = JSON.stringify(payload);

      const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
      ]);

      const authTag = cipher.getAuthTag();

      return {
        encryptedPayload: encrypted.toString('base64'),
        encryptionIv: iv.toString('hex'),
        encryptionAuthTag: authTag.toString('hex'),
      };
    } catch {
      throw new InternalServerErrorException('Unable to encrypt email payload');
    }
  }

  decrypt(encrypted: IEncryptedEmailPayload): IEmailPayload {
    try {
      const iv = Buffer.from(encrypted.encryptionIv, 'hex');
      const authTag = Buffer.from(encrypted.encryptionAuthTag, 'hex');
      const ciphertext = Buffer.from(encrypted.encryptedPayload, 'base64');

      if (
        iv.length !== this.ivLength ||
        authTag.length !== this.authTagLength
      ) {
        throw new Error('Invalid encrypted payload metadata');
      }

      const decipher = createDecipheriv(
        this.algorithm,
        this.encryptionKey,
        iv,
        { authTagLength: this.authTagLength },
      );

      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      return JSON.parse(decrypted.toString('utf8')) as IEmailPayload;
    } catch {
      throw new InternalServerErrorException('Unable to decrypt email payload');
    }
  }
}
