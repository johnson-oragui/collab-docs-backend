import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationRecipientEntity } from './notification-recipients.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationRecipientEntity,
      OrganisationMembershipEntity,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class NotificationRecipientModule {}
