import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganisationMembershipEntity } from './organisation-memberships.entity';
import { UserEntity } from '@/user/user.entity';
import { OrganisationEntity } from '@/organisations/organisations.entity';
import { OrganisationMembershipSuspensionHistoryEntity } from '@/org_membership_suspension_histories/entity';
import { OrganisationMembershipInvitationEntity } from '@/org_membership_invitation/entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganisationMembershipEntity,
      UserEntity,
      OrganisationEntity,
      OrganisationMembershipSuspensionHistoryEntity,
      OrganisationMembershipInvitationEntity,
    ]),
  ],
})
export class OrganisationMembershipEntityModule {}
