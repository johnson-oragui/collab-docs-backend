import { Module } from '@nestjs/common';
import { WebSocketNotificationsGateway } from './websocket-gateway';

@Module({
  imports: [],
  providers: [WebSocketNotificationsGateway],
  exports: [WebSocketNotificationsGateway],
})
export class WebsocketGatewayModule {}
