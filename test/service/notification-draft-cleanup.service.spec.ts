import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { NotificationStatusEnum } from '@/database/database.enums';
import { NotificationRecipientEntity } from '@/notification-recipients/notification-recipients.entity';
import { NotificationOutboxEntity } from '@/notification-outbox/notification-outbox.entity';
import { NotificationDraftCleanupService } from '@/notification/notification-draft-cleanup.service';
import { INotificationRedisLockClient } from '@/notification/notification.interface';
import { NotificationEntity } from '@/notification/notification.entity';
import { NOTIFICATION_REDIS_CLIENT } from '@/notification/notification.constants';

describe('NotificationDraftCleanupService (unittest)', () => {
  let service: NotificationDraftCleanupService;
  let redisMock: jest.Mocked<INotificationRedisLockClient>;

  let notificationRepoMock: {
    find: jest.Mock;
    findOne: jest.Mock;
    delete: jest.Mock;
  };
  let recipientRepoMock: {
    delete: jest.Mock;
  };
  let outboxRepoMock: {
    count: jest.Mock;
  };
  let dataSourceMock: {
    getRepository: jest.Mock;
    transaction: jest.Mock;
  };

  beforeEach(async () => {
    notificationRepoMock = {
      find: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
    };
    recipientRepoMock = {
      delete: jest.fn(),
    };
    outboxRepoMock = {
      count: jest.fn(),
    };

    const txEntityManager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === NotificationEntity) return notificationRepoMock;
        if (entity === NotificationRecipientEntity) return recipientRepoMock;
        if (entity === NotificationOutboxEntity) return outboxRepoMock;
        throw new Error('Unexpected entity in transaction');
      }),
    };

    dataSourceMock = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === NotificationEntity) return notificationRepoMock;
        if (entity === NotificationRecipientEntity) return recipientRepoMock;
        if (entity === NotificationOutboxEntity) return outboxRepoMock;
        throw new Error('Unexpected entity');
      }),
      transaction: jest.fn(
        async (cb: (em: typeof txEntityManager) => unknown) =>
          cb(txEntityManager),
      ),
    };

    redisMock = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
      eval: jest.fn().mockResolvedValue(1),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationDraftCleanupService,
        { provide: DataSource, useValue: dataSourceMock },
        { provide: NOTIFICATION_REDIS_CLIENT, useValue: redisMock },
      ],
    }).compile();

    service = moduleRef.get(NotificationDraftCleanupService);
  });

  it('skips cleanup when Redis lock is already held by another replica', async () => {
    redisMock.set.mockResolvedValueOnce(null);

    const result = await service.cleanupExpiredDrafts(
      new Date('2026-11-27T09:00:00.000Z'),
    );

    expect(result).toEqual({
      skippedDueToLock: true,
      scannedCount: 0,
      deletedCount: 0,
      skippedIntegrityCount: 0,
    });
    expect(notificationRepoMock.find).not.toHaveBeenCalled();
    expect(redisMock.eval).not.toHaveBeenCalled();
  });

  it('deletes expired drafts without outbox rows and releases Redis lock in finally', async () => {
    const now = new Date('2026-11-27T09:00:00.000Z');
    const expiredDraft = {
      id: 'draft-1',
      organisationId: 'org-1',
      status: NotificationStatusEnum.DRAFT,
      publishedAt: null,
      draftExpiresAt: new Date('2026-11-27T08:00:00.000Z'),
    };

    notificationRepoMock.find.mockResolvedValueOnce([expiredDraft]);
    notificationRepoMock.findOne.mockResolvedValueOnce({ ...expiredDraft });
    outboxRepoMock.count.mockResolvedValueOnce(0);
    recipientRepoMock.delete.mockResolvedValueOnce({ affected: 1 });
    notificationRepoMock.delete.mockResolvedValueOnce({ affected: 1 });

    const result = await service.cleanupExpiredDrafts(now);

    expect(result).toEqual({
      skippedDueToLock: false,
      scannedCount: 1,
      deletedCount: 1,
      skippedIntegrityCount: 0,
    });
    expect(recipientRepoMock.delete).toHaveBeenCalledWith({
      notificationId: 'draft-1',
    });
    expect(notificationRepoMock.delete).toHaveBeenCalledWith({ id: 'draft-1' });
    expect(redisMock.eval).toHaveBeenCalledTimes(1);
  });

  it('skips deletion and increments skippedIntegrityCount when expired draft has outbox records', async () => {
    const now = new Date('2026-11-27T09:00:00.000Z');
    const draftWithOutbox = {
      id: 'draft-anom-1',
      organisationId: 'org-1',
      status: NotificationStatusEnum.DRAFT,
      publishedAt: null,
      draftExpiresAt: new Date('2026-11-27T08:30:00.000Z'),
    };

    notificationRepoMock.find.mockResolvedValueOnce([draftWithOutbox]);
    notificationRepoMock.findOne.mockResolvedValueOnce({ ...draftWithOutbox });
    outboxRepoMock.count.mockResolvedValueOnce(2);

    const result = await service.cleanupExpiredDrafts(now);

    expect(result).toEqual({
      skippedDueToLock: false,
      scannedCount: 1,
      deletedCount: 0,
      skippedIntegrityCount: 1,
    });
    expect(notificationRepoMock.delete).not.toHaveBeenCalled();
    expect(recipientRepoMock.delete).not.toHaveBeenCalled();
    expect(redisMock.eval).toHaveBeenCalledTimes(1);
  });

  it('still releases the Redis lock when a sweep throws an unexpected error', async () => {
    notificationRepoMock.find.mockRejectedValueOnce(new Error('DB timeout'));

    await expect(
      service.cleanupExpiredDrafts(new Date('2026-11-27T09:00:00.000Z')),
    ).rejects.toThrow('DB timeout');

    expect(redisMock.eval).toHaveBeenCalledTimes(1);
  });
});
