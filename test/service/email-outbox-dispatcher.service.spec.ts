import { EmailOutboxStatusEnum } from '@/database/database.enums';
import { EmailOutboxDispatcherService } from '@/email/email-outbox-dispatcher.service';
import { EmailOutboxEntity } from '@/email-outbox/email.entity';
import { EmailService } from '@/email/email.service';
import { Repository, SelectQueryBuilder } from 'typeorm';

describe('TEST EmailOutboxDispatcherService', () => {
  let service: EmailOutboxDispatcherService;

  let emailService: jest.Mocked<Pick<EmailService, 'enqueueOutboxEmail'>>;

  let repository: jest.Mocked<
    Pick<Repository<EmailOutboxEntity>, 'createQueryBuilder'>
  >;

  let selectQueryBuilder: Record<string, jest.Mock>;
  let updateQueryBuilder: Record<string, jest.Mock>;

  const records = [
    { id: 'outbox-1' },
    { id: 'outbox-2' },
  ] as EmailOutboxEntity[];

  beforeEach(() => {
    selectQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(records),
    };

    updateQueryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    repository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(selectQueryBuilder)
        .mockReturnValue(updateQueryBuilder),
    };

    emailService = {
      enqueueOutboxEmail: jest.fn().mockResolvedValue(undefined),
    };

    service = new EmailOutboxDispatcherService(
      repository as unknown as Repository<EmailOutboxEntity>,
      emailService as unknown as EmailService,
    );
  });

  it('should enqueue pending and queued outbox records', async () => {
    await service.dispatchPendingEmails();

    expect(emailService.enqueueOutboxEmail).toHaveBeenCalledTimes(2);

    expect(emailService.enqueueOutboxEmail).toHaveBeenNthCalledWith(
      1,
      'outbox-1',
    );

    expect(emailService.enqueueOutboxEmail).toHaveBeenNthCalledWith(
      2,
      'outbox-2',
    );
  });

  it('should query only pending and queued records', async () => {
    await service.dispatchPendingEmails();

    expect(selectQueryBuilder.where).toHaveBeenCalledWith(
      'outbox.status IN (:...statuses)',
      {
        statuses: [EmailOutboxStatusEnum.PENDING, EmailOutboxStatusEnum.QUEUED],
      },
    );
  });

  it('should mark successfully dispatched records as queued', async () => {
    await service.dispatchPendingEmails();

    expect(updateQueryBuilder.set).toHaveBeenCalledWith({
      status: EmailOutboxStatusEnum.QUEUED,
    });

    expect(updateQueryBuilder.execute).toHaveBeenCalledTimes(2);
  });

  it('should continue dispatching when an individual enqueue fails', async () => {
    emailService.enqueueOutboxEmail
      .mockRejectedValueOnce(new Error('Redis unavailable'))
      .mockResolvedValueOnce(undefined);

    await service.dispatchPendingEmails();

    expect(emailService.enqueueOutboxEmail).toHaveBeenCalledTimes(2);

    // Only the successfully enqueued record should be updated.
    expect(updateQueryBuilder.execute).toHaveBeenCalledTimes(1);
  });

  it('should not process anything when there are no eligible records', async () => {
    selectQueryBuilder.getMany.mockResolvedValueOnce([]);

    await service.dispatchPendingEmails();

    expect(emailService.enqueueOutboxEmail).not.toHaveBeenCalled();
    expect(updateQueryBuilder.execute).not.toHaveBeenCalled();
  });

  it('should not overwrite a record that is no longer pending or queued', async () => {
    await service.dispatchPendingEmails();

    expect(updateQueryBuilder.andWhere).toHaveBeenCalledWith(
      'status IN (:...statuses)',
      {
        statuses: [EmailOutboxStatusEnum.PENDING, EmailOutboxStatusEnum.QUEUED],
      },
    );
  });
});
