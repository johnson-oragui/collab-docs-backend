import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationEntity } from './notification.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { NotificationRecipientEntity } from '@/notification-recipients/notification-recipients.entity';
import { NotificationOutboxEntity } from '@/notification-outbox/notification-outbox.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationEntity,
      OrganisationMembershipEntity,
      NotificationRecipientEntity,
      NotificationOutboxEntity,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class NotificationModule {}
