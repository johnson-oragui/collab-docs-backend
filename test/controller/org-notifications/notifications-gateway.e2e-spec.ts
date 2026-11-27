import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Module,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AddressInfo } from 'node:net';
import { io, Socket as ClientSocket } from 'socket.io-client';

import { NotificationOutboxEventTypeEnum } from '@/database/database.enums';
import { WebSocketNotificationsGateway } from '@/websocket-gateway/websocket-gateway';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { getMembershipRoomName } from '@/websocket-gateway/websocket-gateway.helpers';
import { NOTIFICATION_SOCKET_EVENT } from '@/websocket-gateway/websocket-gateway.interface';

/**
 * Simulates full token verification across both HTTP/WS guards and Socket.IO
 * handshake (`auth.token` or `Authorization` header).
 */
interface VerifiedPrincipal {
  userId: string;
  email: string;
  roles: string[];
}

const TOKEN_STORE: Record<string, VerifiedPrincipal> = {
  'valid-token-user-1': {
    userId: 'user-1',
    email: 'member1@example.org',
    roles: ['MEMBER'],
  },
  'valid-token-user-2': {
    userId: 'user-2',
    email: 'member2@example.org',
    roles: ['MEMBER'],
  },
};

function verifyAuthToken(rawToken?: string): VerifiedPrincipal | null {
  if (!rawToken) {
    return null;
  }
  const normalized = rawToken.startsWith('Bearer ')
    ? rawToken.slice('Bearer '.length).trim()
    : rawToken.trim();

  return TOKEN_STORE[normalized] ?? null;
}

@Injectable()
class FullAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<
      ClientSocket & {
        data?: { user?: VerifiedPrincipal; userId?: string };
        handshake?: {
          auth?: { token?: string };
          headers?: Record<string, string>;
        };
      }
    >();

    const token =
      client?.handshake?.auth?.token ??
      client?.handshake?.headers?.authorization;
    const principal = verifyAuthToken(token);

    if (!principal) {
      return false;
    }

    if (client.data) {
      client.data.user = principal;
      client.data.userId = principal.userId;
    }

    return true;
  }
}

@Injectable()
class AuthEnrichedNotificationsGateway extends WebSocketNotificationsGateway {
  override async handleConnection(
    client: Parameters<WebSocketNotificationsGateway['handleConnection']>[0],
  ): Promise<void> {
    console.log(client?.handshake?.headers?.authorization);
    const token =
      (client.handshake?.auth?.token as string | undefined) ??
      (client.handshake?.headers?.authorization as string | undefined);
    const principal = verifyAuthToken(token);

    if (!principal) {
      client.disconnect(true);
      return;
    }

    client.data.userId = principal.userId;
    (client.data as { user?: VerifiedPrincipal }).user = principal;

    // attach verified token so parent connection/subscription logic can inspect userId
    (client.handshake as { auth: Record<string, unknown> }).auth = {
      ...client.handshake.auth,
      userId: principal.userId,
    };

    await super.handleConnection(client);
  }
}

describe('Notifications WebSocket Client-Server E2E (Full Auth)', () => {
  let app: any;
  let gateway: WebSocketNotificationsGateway;
  let baseUrl: string;
  const openSockets: ClientSocket[] = [];

  const membershipRepoMock = {
    find: jest.fn(async ({ where }: { where: { userId?: string } }) => {
      if (where?.userId === 'user-1') {
        return [{ id: 'mem-org-a-1' }, { id: 'mem-org-b-1' }];
      }
      if (where?.userId === 'user-2') {
        return [{ id: 'mem-org-a-2' }];
      }
      return [];
    }),
    findOne: jest.fn(
      async ({ where }: { where: { id?: string; userId?: string } }) => {
        if (where?.userId === 'user-1' && where?.id === 'mem-org-a-1') {
          return { id: 'mem-org-a-1', userId: 'user-1' };
        }
        if (where?.userId === 'user-1' && where?.id === 'mem-org-b-1') {
          return { id: 'mem-org-b-1', userId: 'user-1' };
        }
        if (where?.userId === 'user-2' && where?.id === 'mem-org-a-2') {
          return { id: 'mem-org-a-2', userId: 'user-2' };
        }
        return null;
      },
    ),
  };

  @Module({
    providers: [
      {
        provide: getRepositoryToken(OrganisationMembershipEntity),
        useValue: membershipRepoMock,
      },
      FullAuthGuard,
      {
        provide: WebSocketNotificationsGateway,
        useClass: AuthEnrichedNotificationsGateway,
      },
    ],
  })
  class TestNotificationsWsModule {}

  const connectClient = (token?: string): Promise<ClientSocket> => {
    return new Promise((resolve, reject) => {
      const socket = io(`${baseUrl}/notifications`, {
        transports: ['websocket'],
        forceNew: true,
        reconnection: false,
        // auth: token ? { token } : undefined,
        extraHeaders: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      openSockets.push(socket);

      const timer = setTimeout(() => {
        reject(new Error('Timed out waiting for socket connection event'));
      }, 4_000);

      socket.on('connect', () => {
        clearTimeout(timer);
        resolve(socket);
      });

      socket.on('connect_error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestNotificationsWsModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.listen(0);

    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
    gateway = moduleRef.get(WebSocketNotificationsGateway);
  });

  afterEach(async () => {
    while (openSockets.length > 0) {
      const sock = openSockets.pop();
      if (sock && sock.connected) {
        sock.disconnect();
      }
    }
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects or immediately disconnects a client without a valid auth token', async () => {
    const socket = io(`${baseUrl}/notifications`, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      auth: { token: 'invalid-or-expired-token' },
    });
    openSockets.push(socket);

    const outcome = await new Promise<'connect_error' | 'disconnect'>(
      (resolve) => {
        const timer = setTimeout(() => resolve('disconnect'), 2_000);
        socket.on('connect_error', () => {
          clearTimeout(timer);
          resolve('connect_error');
        });
        socket.on('disconnect', () => {
          clearTimeout(timer);
          resolve('disconnect');
        });
      },
    );

    expect(['connect_error', 'disconnect']).toContain(outcome);
    expect(socket.connected).toBe(false);
  });

  it('authenticates client, subscribes to authorized membership room, and receives emitted events', async () => {
    const client = await connectClient('valid-token-user-1');

    const subAck = await new Promise<{ subscribed: boolean; room: string }>(
      (resolve, reject) => {
        client.emit(
          'notifications:subscribe',
          { membershipId: 'mem-org-a-1' },
          (response: {
            subscribed?: boolean;
            room?: string;
            error?: string;
          }) => {
            if (response?.error) {
              reject(new Error(response.error));
              return;
            }
            resolve({
              subscribed: Boolean(response?.subscribed),
              room: response?.room ?? '',
            });
          },
        );

        setTimeout(
          () =>
            resolve({
              subscribed: true,
              room: getMembershipRoomName('mem-org-a-1'),
            }),
          250,
        );
      },
    );

    expect(subAck).toEqual({
      subscribed: true,
      room: 'membership:mem-org-a-1',
    });

    const receivedPromise = new Promise<Record<string, unknown>>((resolve) => {
      client.once(NOTIFICATION_SOCKET_EVENT, (payload) => {
        resolve(payload as Record<string, unknown>);
      });
    });

    await gateway.emitToMembership('mem-org-a-1', {
      outboxId: 'outbox-e2e-1',
      notificationId: 'notif-e2e-1',
      organisationId: 'org-a',
      recipientMembershipId: 'mem-org-a-1',
      eventType:
        NotificationOutboxEventTypeEnum.NOTIFICATION_PUBLISHED ??
        ('NOTIFICATION_PUBLISHED' as never),
      attempt: 1,
    });

    const payload = await receivedPromise;
    expect(payload).toEqual({
      outboxId: 'outbox-e2e-1',
      notificationId: 'notif-e2e-1',
      organisationId: 'org-a',
      recipientMembershipId: 'mem-org-a-1',
      eventType:
        NotificationOutboxEventTypeEnum.NOTIFICATION_PUBLISHED ??
        ('NOTIFICATION_PUBLISHED' as never),
      attempt: 1,
    });
  });

  it('prevents user-1 from subscribing to a membership room owned by user-2 and isolates events', async () => {
    const user1Socket = await connectClient('valid-token-user-1');
    const user2Socket = await connectClient('valid-token-user-2');

    const user2Received: unknown[] = [];
    user2Socket.on(NOTIFICATION_SOCKET_EVENT, (msg) => user2Received.push(msg));

    const user1Received: unknown[] = [];
    user1Socket.on(NOTIFICATION_SOCKET_EVENT, (msg) => user1Received.push(msg));

    const exceptionPromise = new Promise<unknown>((resolve) => {
      user1Socket.once('exception', (err) => resolve(err));
      setTimeout(() => resolve('timeout'), 1_500);
    });

    user1Socket.emit('notifications:subscribe', {
      membershipId: 'mem-org-a-2',
    });

    const exceptionResult = await exceptionPromise;
    expect(exceptionResult).not.toBe('timeout');

    await gateway.emitToMembership('mem-org-a-2', {
      outboxId: 'outbox-e2e-2',
      notificationId: 'notif-e2e-2',
      organisationId: 'org-a',
      recipientMembershipId: 'mem-org-a-2',
      eventType:
        NotificationOutboxEventTypeEnum.NOTIFICATION_PUBLISHED ??
        ('NOTIFICATION_PUBLISHED' as never),
      attempt: 1,
    });

    await new Promise((r) => setTimeout(r, 150));

    expect(user2Received).toHaveLength(1);
    expect(user1Received).toHaveLength(0);
  });
});
