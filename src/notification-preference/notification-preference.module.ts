import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationPreferenceEntity } from './notification-preference.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationPreferenceEntity,
      OrganisationMembershipEntity,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class NotificationPreferenceModule {}
