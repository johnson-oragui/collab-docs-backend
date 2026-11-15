import { EmailEventTypeEnum } from '@/database/database.enums';
import { EmailEncryptionService } from '@/email/email-encryption.service';
import { EmailOutboxService } from '@/email-outbox/email-outbox.service';
import { EmailOutboxEntity } from '@/email-outbox/email.entity';
import { IEmailPayload } from '@/email/email.interface';
import { EntityManager, Repository } from 'typeorm';

describe('Test EmailOutboxService', () => {
  let service: EmailOutboxService;

  let encryptionService: jest.Mocked<Pick<EmailEncryptionService, 'encrypt'>>;

  let repository: jest.Mocked<
    Pick<Repository<EmailOutboxEntity>, 'create' | 'save'>
  >;

  let manager: jest.Mocked<Pick<EntityManager, 'getRepository'>>;

  const payload: IEmailPayload = {
    to: 'johnson@example.com',
    subject: 'Reset your password',
    html: '<p>Reset your password.</p>',
    text: 'Reset your password.',
  };

  const encryptedPayload = {
    encryptedPayload: 'encrypted-content',
    encryptionIv: '0123456789abcdef01234567',
    encryptionAuthTag: '0123456789abcdef0123456789abcdef',
  };

  const outboxRecord = {
    id: 'outbox-id',
    eventType: EmailEventTypeEnum.PASSWORD_RESET,
    ...encryptedPayload,
  } as EmailOutboxEntity;

  beforeEach(() => {
    encryptionService = {
      encrypt: jest.fn().mockReturnValue(encryptedPayload),
    };

    repository = {
      create: jest.fn().mockReturnValue(outboxRecord),
      save: jest.fn().mockResolvedValue(outboxRecord),
    };

    manager = {
      getRepository: jest.fn().mockReturnValue(repository),
    };

    service = new EmailOutboxService(
      encryptionService as unknown as EmailEncryptionService,
    );
  });

  describe('create', () => {
    it('should encrypt the payload and persist an outbox record', async () => {
      const result = await service.create(
        manager as unknown as EntityManager,
        EmailEventTypeEnum.PASSWORD_RESET,
        payload,
      );

      expect(encryptionService.encrypt).toHaveBeenCalledWith(payload);

      expect(manager.getRepository).toHaveBeenCalledWith(EmailOutboxEntity);

      expect(repository.create).toHaveBeenCalledWith({
        eventType: EmailEventTypeEnum.PASSWORD_RESET,
        ...encryptedPayload,
      });

      expect(repository.save).toHaveBeenCalledWith(outboxRecord);

      expect(result).toBe(outboxRecord);
    });

    it('should support email verification events', async () => {
      await service.create(
        manager as unknown as EntityManager,
        EmailEventTypeEnum.EMAIL_VERIFICATION,
        payload,
      );

      expect(repository.create).toHaveBeenCalledWith({
        eventType: EmailEventTypeEnum.EMAIL_VERIFICATION,
        ...encryptedPayload,
      });
    });

    it('should not persist an outbox record if encryption fails', async () => {
      encryptionService.encrypt.mockImplementation(() => {
        throw new Error('Encryption failed');
      });

      await expect(
        service.create(
          manager as unknown as EntityManager,
          EmailEventTypeEnum.PASSWORD_RESET,
          payload,
        ),
      ).rejects.toThrow('Encryption failed');

      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should propagate database persistence errors', async () => {
      repository.save.mockRejectedValue(new Error('Database unavailable'));

      await expect(
        service.create(
          manager as unknown as EntityManager,
          EmailEventTypeEnum.PASSWORD_RESET,
          payload,
        ),
      ).rejects.toThrow('Database unavailable');
    });
  });
});
