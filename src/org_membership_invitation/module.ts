import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganisationMembershipInvitationEntity } from './entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganisationMembershipInvitationEntity,
      OrganisationMembershipEntity,
    ]),
  ],
})
export class OrganisationMembershipInvitationModule {}
