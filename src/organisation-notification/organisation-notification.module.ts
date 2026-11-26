import { NotificationOutboxModule } from '@/notification-outbox/notification-outbox.module';
import { NotificationPreferenceModule } from '@/notification-preference/notification-preference.module';
import { NotificationRecipientModule } from '@/notification-recipients/notification-recipients.module';
import { NotificationModule } from '@/notification/notification.module';
import { Module } from '@nestjs/common';
import { OrganisationNotificationService } from './organisation-notification.service';
import { OrganisationNotificationController } from './organisation-notification.controller';

@Module({
  imports: [
    NotificationModule,
    NotificationOutboxModule,
    NotificationPreferenceModule,
    NotificationRecipientModule,
  ],
  providers: [OrganisationNotificationService],
  controllers: [OrganisationNotificationController],
})
export class OrganisationNotificationModule {}
