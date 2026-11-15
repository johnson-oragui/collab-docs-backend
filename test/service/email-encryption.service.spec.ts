import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { EmailEncryptionService } from '@/email/email-encryption.service';
import { IEmailPayload } from '@/email/email.interface';
import { generateBase64Key } from '@/commons/util/generateBase64Key';

describe('Test EmailEncryptionService', () => {
  let service: EmailEncryptionService;

  const encryptionKey = generateBase64Key();

  const payload: IEmailPayload = {
    to: 'johnson@example.com',
    subject: 'Verify your email',
    html: '<p>Click the verification link.</p>',
    text: 'Click the verification link.',
  };

  beforeEach(() => {
    const configService = {
      getOrThrow: jest.fn().mockReturnValue(encryptionKey),
    } as unknown as ConfigService;

    service = new EmailEncryptionService(configService);
  });

  describe('encrypt', () => {
    it('should encrypt an email payload', () => {
      const result = service.encrypt(payload);

      expect(result.encryptedPayload).toBeDefined();
      expect(result.encryptionIv).toHaveLength(24);
      expect(result.encryptionAuthTag).toHaveLength(32);

      expect(result.encryptedPayload).not.toContain(payload.to);
      expect(result.encryptedPayload).not.toContain(payload.subject);
    });

    it('should generate a different IV for each encryption', () => {
      const first = service.encrypt(payload);
      const second = service.encrypt(payload);

      expect(first.encryptionIv).not.toEqual(second.encryptionIv);
      expect(first.encryptedPayload).not.toEqual(second.encryptedPayload);
    });
  });

  describe('decrypt', () => {
    it('should decrypt an encrypted email payload', () => {
      const encrypted = service.encrypt(payload);

      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toEqual(payload);
    });

    it('should reject a tampered ciphertext', () => {
      const encrypted = service.encrypt(payload);

      const tampered = {
        ...encrypted,
        encryptedPayload: Buffer.from('tampered').toString('base64'),
      };

      expect(() => service.decrypt(tampered)).toThrow(
        InternalServerErrorException,
      );
    });

    it('should reject a tampered authentication tag', () => {
      const encrypted = service.encrypt(payload);

      const tampered = {
        ...encrypted,
        encryptionAuthTag: Buffer.alloc(16, 2).toString('hex'),
      };

      expect(() => service.decrypt(tampered)).toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('constructor', () => {
    it('should reject an invalid encryption key length', () => {
      const configService = {
        getOrThrow: jest
          .fn()
          .mockReturnValue(generateBase64Key(16)),
      } as unknown as ConfigService;

      expect(() => new EmailEncryptionService(configService)).toThrow(
        'EMAIL_ENCRYPTION_KEY must be a valid base64-encoded 32-byte key',
      );
    });
  });
});
