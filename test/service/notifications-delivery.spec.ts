import { NotificationOutboxEventTypeEnum } from '@/database/database.enums';
import { NotificationDeliveryWorker } from '@/notification/notification-delivery-worker';
import { INotificationDeliveryPayload } from '@/notification/notification.interface';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { WebSocketNotificationsGateway } from '@/websocket-gateway/websocket-gateway';
import { getMembershipRoomName } from '@/websocket-gateway/websocket-gateway.helpers';
import { NOTIFICATION_SOCKET_EVENT } from '@/websocket-gateway/websocket-gateway.interface';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WsException } from '@nestjs/websockets';
import type { Server } from 'socket.io';

describe('NotificationsGateway and NotificationDeliveryWorker (unit test)', () => {
  let gateway: WebSocketNotificationsGateway;
  let worker: NotificationDeliveryWorker;
  let membershipRepoMock: {
    find: jest.Mock;
    findOne: jest.Mock;
  };
  let roomEmitMock: jest.Mock;
  let serverToMock: jest.Mock;

  const createMockSocket = (overrides?: {
    id?: string;
    userId?: string;
    handshakeUserId?: string;
    membershipIds?: string[];
  }) => ({
    id: overrides?.id ?? 'sock-1',
    data: {
      userId: overrides?.userId,
      membershipIds: overrides?.membershipIds,
    },
    handshake: {
      auth: overrides?.handshakeUserId
        ? { userId: overrides.handshakeUserId }
        : {},
      query: {},
    },
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
  });

  beforeEach(async () => {
    membershipRepoMock = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };

    roomEmitMock = jest.fn();
    serverToMock = jest.fn().mockReturnValue({ emit: roomEmitMock });

    const moduleRef = await Test.createTestingModule({
      providers: [
        WebSocketNotificationsGateway,
        NotificationDeliveryWorker,
        {
          provide: getRepositoryToken(OrganisationMembershipEntity),
          useValue: membershipRepoMock,
        },
      ],
    }).compile();

    gateway = moduleRef.get(WebSocketNotificationsGateway);
    worker = moduleRef.get(NotificationDeliveryWorker);

    gateway.server = {
      to: serverToMock,
    } as unknown as Server;
  });

  describe('NotificationsGateway', () => {
    it('disconnects unauthenticated sockets on connect', async () => {
      const client = createMockSocket();

      await gateway.handleConnection(client as never);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.join).not.toHaveBeenCalled();
    });

    it('joins allowed membership rooms when an authenticated user connects', async () => {
      membershipRepoMock.find.mockResolvedValueOnce([
        { id: 'mem-1' },
        { id: 'mem-2' },
      ]);

      const client = createMockSocket({ handshakeUserId: 'user-10' });

      await gateway.handleConnection(client as never);

      expect(client.data.userId).toBe('user-10');
      expect(client.data.membershipIds).toEqual(['mem-1', 'mem-2']);
      expect(client.join).toHaveBeenNthCalledWith(1, 'membership:mem-1');
      expect(client.join).toHaveBeenNthCalledWith(2, 'membership:mem-2');
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('allows subscribing to a membership room owned by the authenticated user', async () => {
      membershipRepoMock.findOne.mockResolvedValueOnce({
        id: 'mem-99',
        userId: 'user-10',
      });

      const client = createMockSocket({ userId: 'user-10', membershipIds: [] });

      const result = await gateway.handleSubscribeMembership(client as never, {
        membershipId: 'mem-99',
      });

      expect(result).toEqual({
        subscribed: true,
        room: 'membership:mem-99',
      });
      expect(client.join).toHaveBeenCalledWith('membership:mem-99');
    });

    it('rejects subscribing to a membership room not belonging to the user', async () => {
      membershipRepoMock.findOne.mockResolvedValueOnce(null);

      const client = createMockSocket({
        userId: 'user-10',
        membershipIds: ['mem-1'],
      });

      await expect(
        gateway.handleSubscribeMembership(client as never, {
          membershipId: 'mem-other',
        }),
      ).rejects.toThrow(WsException);

      expect(client.join).not.toHaveBeenCalled();
    });

    it('rejects subscription when membershipId is missing', async () => {
      const client = createMockSocket({ userId: 'user-10' });

      await expect(
        gateway.handleSubscribeMembership(client as never, {}),
      ).rejects.toThrow(WsException);
    });

    it('emits delivery payload to the membership room via emitToMembership', async () => {
      const event: INotificationDeliveryPayload = {
        outboxId: 'outbox-1',
        notificationId: 'notif-1',
        organisationId: 'org-1',
        recipientMembershipId: 'mem-42',
        eventType:
          NotificationOutboxEventTypeEnum.NOTIFICATION_PUBLISHED ??
          ('NOTIFICATION_PUBLISHED' as never),
        attempt: 1,
      };

      await gateway.emitToMembership('mem-42', event);

      expect(serverToMock).toHaveBeenCalledWith(
        getMembershipRoomName('mem-42'),
      );
      expect(roomEmitMock).toHaveBeenCalledWith(NOTIFICATION_SOCKET_EVENT, {
        outboxId: 'outbox-1',
        notificationId: 'notif-1',
        organisationId: 'org-1',
        recipientMembershipId: 'mem-42',
        eventType: event.eventType,
        attempt: 1,
      });
    });

    it('throws when emitting before the Socket.IO server is initialized', async () => {
      gateway.server = undefined;

      await expect(
        gateway.emitToMembership('mem-42', {
          outboxId: 'outbox-1',
          notificationId: 'notif-1',
          recipientMembershipId: 'mem-42',
          eventType:
            NotificationOutboxEventTypeEnum.NOTIFICATION_PUBLISHED ??
            ('NOTIFICATION_PUBLISHED' as never),
          attempt: 1,
        }),
      ).rejects.toThrow('Socket.IO server instance is not initialized');
    });
  });

  describe('NotificationDeliveryWorker', () => {
    it('forwards delivery events to gateway.emitToMembership using recipientMembershipId', async () => {
      const emitSpy = jest
        .spyOn(gateway, 'emitToMembership')
        .mockResolvedValueOnce(undefined);

      const payload: INotificationDeliveryPayload = {
        outboxId: 'outbox-9',
        notificationId: 'notif-9',
        organisationId: 'org-2',
        recipientMembershipId: 'mem-77',
        eventType:
          NotificationOutboxEventTypeEnum.NOTIFICATION_PUBLISHED ??
          ('NOTIFICATION_PUBLISHED' as never),
        attempt: 1,
      };

      await worker.handleNotificationDelivery(payload);

      expect(emitSpy).toHaveBeenCalledWith('mem-77', payload);
    });

    it('propagates errors from emitToMembership so the dispatcher can retry', async () => {
      jest
        .spyOn(gateway, 'emitToMembership')
        .mockRejectedValueOnce(new Error('Socket room emit failed'));

      const payload: INotificationDeliveryPayload = {
        outboxId: 'outbox-10',
        notificationId: 'notif-10',
        recipientMembershipId: 'mem-88',
        eventType:
          NotificationOutboxEventTypeEnum.NOTIFICATION_PUBLISHED ??
          ('NOTIFICATION_PUBLISHED' as never),
        attempt: 2,
      };

      await expect(worker.handleNotificationDelivery(payload)).rejects.toThrow(
        'Socket room emit failed',
      );
    });
  });
});
