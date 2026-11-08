import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganisationMembershipSuspensionHistoryEntity } from './entity';
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
