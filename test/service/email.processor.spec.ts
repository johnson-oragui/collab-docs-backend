import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { EmailProcessor } from '@/email/email.processor';
import { EmailOutboxEntity } from '@/email-outbox/email.entity';
import { EmailEncryptionService } from '@/email/email-encryption.service';
import { GmailSmtpService } from '@/gmail-smtp/gmail-smtp.service';
import { EmailOutboxStatusEnum } from '@/database/database.enums';
import { IEmailJobData } from '@/email/email.interface';
import { EMAIL_JOB } from '@/email/email.constants';

describe('Test EmailProcessor', () => {
  let processor: EmailProcessor;

  let repository: jest.Mocked<
    Pick<
      Repository<EmailOutboxEntity>,
      'findOne' | 'update' | 'createQueryBuilder'
    >
  >;

  let encryptionService: jest.Mocked<Pick<EmailEncryptionService, 'decrypt'>>;

  let smtpService: jest.Mocked<Pick<GmailSmtpService, 'send'>>;

  let failureQueryBuilder: Record<string, jest.Mock>;

  const record = {
    id: 'outbox-1',
    status: EmailOutboxStatusEnum.QUEUED,
    encryptedPayload: 'encrypted',
    encryptionIv: '0123456789abcdef01234567',
    encryptionAuthTag: '0123456789abcdef0123456789abcdef',
  } as EmailOutboxEntity;

  const payload = {
    to: 'johnson@example.com',
    subject: 'Test email',
    html: '<p>Hello</p>',
    text: 'Hello',
  };

  const createJob = (
    overrides: Partial<Job<IEmailJobData>> = {},
  ): Job<IEmailJobData> =>
    ({
      id: 'email-outbox-outbox-1',
      name: EMAIL_JOB.SEND,
      data: { outboxId: 'outbox-1' },
      attemptsMade: 0,
      opts: { attempts: 5 },
      ...overrides,
    }) as Job<IEmailJobData>;

  beforeEach(() => {
    jest.clearAllMocks();

    failureQueryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    repository = {
      findOne: jest.fn().mockResolvedValue(record),
      createQueryBuilder: jest.fn().mockReturnValue(failureQueryBuilder),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    encryptionService = {
      decrypt: jest.fn().mockReturnValue(payload),
    };

    smtpService = {
      send: jest.fn().mockResolvedValue(undefined),
    };

    processor = new EmailProcessor(
      repository as unknown as Repository<EmailOutboxEntity>,
      encryptionService as unknown as EmailEncryptionService,
      smtpService as unknown as GmailSmtpService,
    );
  });

  it('should decrypt and send an email successfully', async () => {
    const job = createJob();

    await processor.process(job);

    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: 'outbox-1' },
    });

    expect(encryptionService.decrypt).toHaveBeenCalledWith({
      encryptedPayload: record.encryptedPayload,
      encryptionIv: record.encryptionIv,
      encryptionAuthTag: record.encryptionAuthTag,
    });

    expect(smtpService.send).toHaveBeenCalledWith(payload);

    expect(repository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('should not send an email that has already been sent', async () => {
    repository.findOne.mockResolvedValueOnce({
      ...record,
      status: EmailOutboxStatusEnum.SENT,
    } as EmailOutboxEntity);

    await processor.process(createJob());

    expect(encryptionService.decrypt).not.toHaveBeenCalled();
    expect(smtpService.send).not.toHaveBeenCalled();
  });

  it('should not send an email that has permanently failed', async () => {
    repository.findOne.mockResolvedValueOnce({
      ...record,
      status: EmailOutboxStatusEnum.FAILED,
    } as EmailOutboxEntity);

    await processor.process(createJob());

    expect(encryptionService.decrypt).not.toHaveBeenCalled();
    expect(smtpService.send).not.toHaveBeenCalled();
  });

  it('should reject unsupported job names', async () => {
    await expect(
      processor.process(
        createJob({ name: 'unsupported-job' } as Partial<Job<IEmailJobData>>),
      ),
    ).rejects.toThrow('Unsupported email job: unsupported-job');
  });

  it('should fail when the outbox record does not exist', async () => {
    repository.findOne.mockResolvedValueOnce(null);

    await expect(processor.process(createJob())).rejects.toThrow(
      'Email outbox record not found',
    );

    expect(smtpService.send).not.toHaveBeenCalled();
  });

  it('should retry delivery failures without marking the record FAILED prematurely', async () => {
    smtpService.send.mockRejectedValueOnce(new Error('SMTP connection failed'));

    await expect(processor.process(createJob())).rejects.toThrow(
      'SMTP connection failed',
    );

    expect(failureQueryBuilder.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: EmailOutboxStatusEnum.QUEUED,
        lastError: 'Error',
      }),
    );

    expect(failureQueryBuilder.execute).toHaveBeenCalledTimes(1);
  });

  it('should mark the record FAILED on the final attempt', async () => {
    smtpService.send.mockRejectedValueOnce(new Error('SMTP connection failed'));

    await expect(
      processor.process(
        createJob({
          attemptsMade: 4,
        } as Partial<Job<IEmailJobData>>),
      ),
    ).rejects.toThrow('SMTP connection failed');

    expect(failureQueryBuilder.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: EmailOutboxStatusEnum.FAILED,
        lastError: 'Error',
      }),
    );
  });

  it('should also handle decryption failures as retryable failures', async () => {
    encryptionService.decrypt.mockImplementationOnce(() => {
      throw new Error('Decryption failed');
    });

    await expect(processor.process(createJob())).rejects.toThrow(
      'Decryption failed',
    );

    expect(smtpService.send).not.toHaveBeenCalled();
    expect(failureQueryBuilder.execute).toHaveBeenCalledTimes(1);
  });
});
