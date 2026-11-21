import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganisationMembershipSuspensionHistoryEntity } from './org_membership_suspension_histories.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganisationMembershipSuspensionHistoryEntity,
      OrganisationMembershipEntity,
    ]),
  ],
})
export class OrganisationMembershipSuspensionHistoryModule {}
