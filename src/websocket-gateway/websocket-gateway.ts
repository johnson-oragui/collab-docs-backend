import { INotificationDeliveryPayload } from '@/notification/notification.interface';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Repository } from 'typeorm';
import {
  type ISubscribeMembershipRoomDto,
  NOTIFICATION_SOCKET_EVENT,
  type TAuthenticatedSocket,
} from './websocket-gateway.interface';
import { getMembershipRoomName } from './websocket-gateway.helpers';

@Injectable()
@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class WebSocketNotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(WebSocketNotificationsGateway.name);

  @WebSocketServer()
  server?: Server;

  constructor(
    @Optional()
    @InjectRepository(OrganisationMembershipEntity)
    private readonly membershipRepo?: Repository<OrganisationMembershipEntity>,
  ) {}

  async handleConnection(client: TAuthenticatedSocket): Promise<void> {
    const userId = this.extractUserId(client);
    if (!userId) {
      this.logger.warn(`Disconnecting unauthenticated socket ${client.id}`);
      client.disconnect(true);
      return;
    }

    client.data.userId = userId;

    const allowedMembershipIds = await this.resolveUserMembershipIds(userId);
    client.data.membershipIds = allowedMembershipIds;

    for (const membershipId of allowedMembershipIds) {
      await client.join(getMembershipRoomName(membershipId));
    }

    this.logger.debug(
      `Socket ${client.id} (user=${userId}) joined ${allowedMembershipIds.length} membership room(s)`,
    );
  }

  handleDisconnect(client: TAuthenticatedSocket): void {
    this.logger.debug(
      `Socket ${client.id} (user=${client.data.userId ?? 'unknown'}) disconnected`,
    );
  }

  @SubscribeMessage('notifications:subscribe')
  async handleSubscribeMembership(
    @ConnectedSocket() client: TAuthenticatedSocket,
    @MessageBody() payload: ISubscribeMembershipRoomDto,
  ): Promise<{ subscribed: boolean; room: string }> {
    const membershipId = payload?.membershipId?.trim();
    if (!membershipId) {
      throw new WsException('membershipId is required');
    }

    const userId = client.data.userId ?? this.extractUserId(client);
    if (!userId) {
      throw new WsException('Unauthorized');
    }

    const authorized = await this.isMembershipAuthorizedForUser(
      userId,
      membershipId,
      client.data.membershipIds,
    );

    if (!authorized) {
      throw new WsException('Forbidden membership subscription');
    }

    const room = getMembershipRoomName(membershipId);
    await client.join(room);

    return { subscribed: true, room };
  }

  @SubscribeMessage('notifications:unsubscribe')
  async handleUnsubscribeMembership(
    @ConnectedSocket() client: TAuthenticatedSocket,
    @MessageBody() payload: ISubscribeMembershipRoomDto,
  ): Promise<{ unsubscribed: boolean; room: string }> {
    const membershipId = payload?.membershipId?.trim();
    if (!membershipId) {
      throw new WsException('membershipId is required');
    }

    const room = getMembershipRoomName(membershipId);
    await client.leave(room);

    return { unsubscribed: true, room };
  }

  async emitToMembership(
    recipientMembershipId: string,
    event: INotificationDeliveryPayload,
  ): Promise<void> {
    if (!recipientMembershipId) {
      throw new Error('recipientMembershipId is required for room emission');
    }

    if (!this.server) {
      throw new Error('Socket.IO server instance is not initialized');
    }

    const room = getMembershipRoomName(recipientMembershipId);
    const payload = {
      outboxId: event.outboxId,
      notificationId: event.notificationId,
      organisationId: event.organisationId ?? null,
      recipientMembershipId: event.recipientMembershipId,
      eventType: event.eventType,
      attempt: event.attempt,
    };
    this.server.to(room).emit(NOTIFICATION_SOCKET_EVENT, payload);
    this.logger.debug(
      `Emitted to room ${room}. Payload: ${JSON.stringify(payload)}`,
    );
  }

  private extractUserId(client: TAuthenticatedSocket): string | undefined {
    const handshakeAuthUserId = client.handshake?.auth?.userId;
    if (typeof handshakeAuthUserId === 'string' && handshakeAuthUserId.trim()) {
      return handshakeAuthUserId.trim();
    }

    const queryUserId = client.handshake?.query?.userId;
    if (typeof queryUserId === 'string' && queryUserId.trim()) {
      return queryUserId.trim();
    }

    return client.data?.userId;
  }

  private async resolveUserMembershipIds(userId: string): Promise<string[]> {
    if (!this.membershipRepo) {
      return [];
    }

    const memberships = await this.membershipRepo.find({
      where: { userId } as never,
      select: { id: true } as never,
    });

    return memberships
      .map((m) => (m as unknown as { id?: string }).id)
      .filter((id): id is string => Boolean(id));
  }

  private async isMembershipAuthorizedForUser(
    userId: string,
    membershipId: string,
    cachedIds?: string[],
  ): Promise<boolean> {
    if (Array.isArray(cachedIds) && cachedIds.includes(membershipId)) {
      return true;
    }

    if (!this.membershipRepo) {
      return false;
    }

    const membership = await this.membershipRepo.findOne({
      where: { id: membershipId, userId } as never,
    });

    return Boolean(membership);
  }
}
