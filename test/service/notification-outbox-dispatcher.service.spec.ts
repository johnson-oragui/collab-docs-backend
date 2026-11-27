import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import {
  NotificationOutboxEventTypeEnum,
  NotificationOutboxStatusEnum,
} from '@/database/database.enums';
import { NotificationOutboxEntity } from '@/notification-outbox/notification-outbox.entity';
import { NotificationEntity } from '@/notification/notification.entity';
import {
  NOTIFICATION_DELIVERY_EVENT,
  NOTIFICATION_OUTBOX_REDIS_CLIENT,
  NotificationOutboxDispatcherService,
} from '@/notification/notification-outbox-dispatcher.service';
import { INotificationRedisLockClient } from '@/notification/notification.interface';

describe('NotificationOutboxDispatcherService (unittest)', () => {
  let service: NotificationOutboxDispatcherService;
  let eventEmitterMock: { emitAsync: jest.Mock };
  let redisMock: jest.Mocked<INotificationRedisLockClient>;

  let selectQbMock: {
    select: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    addOrderBy: jest.Mock;
    take: jest.Mock;
    getMany: jest.Mock;
  };
  let updateQbMock: {
    update: jest.Mock;
    set: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    execute: jest.Mock;
  };
  let outboxRepoMock: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
  };
  let notificationRepoMock: {
    findOne: jest.Mock;
  };
  let dataSourceMock: {
    getRepository: jest.Mock;
    transaction: jest.Mock;
  };

  beforeEach(async () => {
    selectQbMock = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    updateQbMock = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    outboxRepoMock = {
      createQueryBuilder: jest.fn((alias?: string) =>
        alias === 'outbox' ? selectQbMock : updateQbMock,
      ),
      findOne: jest.fn(),
    };

    notificationRepoMock = {
      findOne: jest.fn(),
    };

    const txEntityManager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === NotificationOutboxEntity) return outboxRepoMock;
        if (entity === NotificationEntity) return notificationRepoMock;
        throw new Error('Unexpected entity in transaction');
      }),
    };

    dataSourceMock = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === NotificationOutboxEntity) return outboxRepoMock;
        if (entity === NotificationEntity) return notificationRepoMock;
        throw new Error('Unexpected entity');
      }),
      transaction: jest.fn(
        async (cb: (em: typeof txEntityManager) => unknown) =>
          cb(txEntityManager),
      ),
    };

    eventEmitterMock = {
      emitAsync: jest.fn().mockResolvedValue([]),
    };

    redisMock = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
      eval: jest.fn().mockResolvedValue(1),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationOutboxDispatcherService,
        { provide: DataSource, useValue: dataSourceMock },
        { provide: EventEmitter2, useValue: eventEmitterMock },
        { provide: NOTIFICATION_OUTBOX_REDIS_CLIENT, useValue: redisMock },
      ],
    }).compile();

    service = moduleRef.get(NotificationOutboxDispatcherService);
  });

  it('skips batch dispatch when Redis lock is already held', async () => {
    redisMock.set.mockResolvedValueOnce(null);

    const result = await service.dispatchPendingOutbox(
      new Date('2026-11-27T09:30:00.000Z'),
    );

    expect(result).toEqual({
      skippedDueToLock: true,
      scannedCount: 0,
      dispatchedCount: 0,
      failedCount: 0,
    });
    expect(selectQbMock.getMany).not.toHaveBeenCalled();
    expect(eventEmitterMock.emitAsync).not.toHaveBeenCalled();
    expect(redisMock.eval).not.toHaveBeenCalled();
  });

  it('emits delivery event with recipientMembershipId and eventType, then sets dispatchedAt and clears lastError', async () => {
    const now = new Date('2026-11-27T09:30:00.000Z');
    const outboxRecord: Partial<NotificationOutboxEntity> = {
      id: 'outbox-1',
      notificationId: 'notif-1',
      recipientMembershipId: 'membership-42',
      eventType:
        NotificationOutboxEventTypeEnum.NOTIFICATION_PUBLISHED ??
        ('NOTIFICATION_PUBLISHED' as never),
      status: NotificationOutboxStatusEnum.PENDING,
      attempts: 0,
      nextAttemptAt: new Date('2026-11-27T09:29:50.000Z'),
      dispatchedAt: null,
      lastError: 'previous transient error',
    };

    selectQbMock.getMany.mockResolvedValueOnce([{ id: 'outbox-1' }]);
    outboxRepoMock.findOne.mockResolvedValueOnce(outboxRecord);
    notificationRepoMock.findOne.mockResolvedValueOnce({
      id: 'notif-1',
      organisationId: 'org-99',
    });

    const result = await service.dispatchPendingOutbox(now);

    expect(result).toEqual({
      skippedDueToLock: false,
      scannedCount: 1,
      dispatchedCount: 1,
      failedCount: 0,
    });
    expect(selectQbMock.andWhere).toHaveBeenCalledWith(
      'outbox.nextAttemptAt <= :now',
      { now },
    );
    expect(eventEmitterMock.emitAsync).toHaveBeenCalledWith(
      NOTIFICATION_DELIVERY_EVENT,
      expect.objectContaining({
        outboxId: 'outbox-1',
        notificationId: 'notif-1',
        organisationId: 'org-99',
        recipientMembershipId: 'membership-42',
        eventType: outboxRecord.eventType,
        attempt: 1,
      }),
    );
    expect(updateQbMock.set).toHaveBeenLastCalledWith(
      expect.objectContaining({
        attempts: 1,
        dispatchedAt: now,
        lastError: null,
      }),
    );
    expect(redisMock.eval).toHaveBeenCalledTimes(1);
  });

  it('increments attempts, schedules nextAttemptAt with backoff, and records lastError on delivery failure', async () => {
    const now = new Date('2026-11-27T09:30:00.000Z');
    const outboxRecord: Partial<NotificationOutboxEntity> = {
      id: 'outbox-2',
      notificationId: 'notif-2',
      recipientMembershipId: 'membership-77',
      eventType:
        NotificationOutboxEventTypeEnum.NOTIFICATION_PUBLISHED ??
        ('NOTIFICATION_PUBLISHED' as never),
      status: NotificationOutboxStatusEnum.FAILED,
      attempts: 1,
      nextAttemptAt: now,
      dispatchedAt: null,
      lastError: null,
    };

    selectQbMock.getMany.mockResolvedValueOnce([{ id: 'outbox-2' }]);
    outboxRepoMock.findOne.mockResolvedValueOnce(outboxRecord);
    notificationRepoMock.findOne.mockResolvedValueOnce({
      id: 'notif-2',
      organisationId: 'org-99',
    });
    eventEmitterMock.emitAsync.mockRejectedValueOnce(
      new Error('Socket gateway unreachable'),
    );

    const result = await service.dispatchPendingOutbox(now);

    expect(result).toEqual({
      skippedDueToLock: false,
      scannedCount: 1,
      dispatchedCount: 0,
      failedCount: 1,
    });
    expect(updateQbMock.set).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: NotificationOutboxStatusEnum.FAILED,
        attempts: 2,
        nextAttemptAt: new Date(now.getTime() + 4_000),
        lastError: 'Socket gateway unreachable',
      }),
    );
    expect(redisMock.eval).toHaveBeenCalledTimes(1);
  });
});
