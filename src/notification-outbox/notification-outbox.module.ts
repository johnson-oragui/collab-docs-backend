import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationOutboxEntity } from './notification-outbox.entity';
import { NotificationEntity } from '@/notification/notification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationOutboxEntity, NotificationEntity]),
  ],
  exports: [TypeOrmModule],
})
export class NotificationOutboxModule {}
