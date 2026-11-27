import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { NOTIFICATION_DELIVERY_EVENT } from './notification-outbox-dispatcher.service';
import { type INotificationDeliveryPayload } from './notification.interface';
import { WebSocketNotificationsGateway } from '@/websocket-gateway/websocket-gateway';

@Injectable()
export class NotificationDeliveryWorker {
  private readonly logger = new Logger(NotificationDeliveryWorker.name);
  constructor(
    private readonly notificationsGateway: WebSocketNotificationsGateway,
  ) {}

  /**
   * Recieves event from NotificationOutboxDispatcherService.emitDeliveryEvent
   * sending on NOTIFICATION_DELIVERY_EVENT.
   * @param event
   */
  @OnEvent(NOTIFICATION_DELIVERY_EVENT, { async: true })
  async handleNotificationDelivery(
    event: INotificationDeliveryPayload,
  ): Promise<void> {
    this.logger.debug(
      `Delivering event=${event.eventType} for notification=${event.notificationId} to membership=${event.recipientMembershipId} (outbox=${event.outboxId}, attempt=${event.attempt})`,
    );

    await this.notificationsGateway.emitToMembership(
      event.recipientMembershipId,
      event,
    );
  }
}
