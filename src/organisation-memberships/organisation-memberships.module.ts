import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganisationMembershipEntity } from './organisation-memberships.entity';
import { UserEntity } from '@/user/user.entity';
import { OrganisationEntity } from '@/organisations/organisations.entity';
import { OrganisationMembershipSuspensionHistoryEntity } from '@/org_membership_suspension_histories/org_membership_suspension_histories.entity';
import { OrganisationMembershipInvitationEntity } from '@/org_membership_invitation/org_membership_invitation.entity';
import { PermissionGuard } from '@/commons/guards/permission.guard';
import { OrganisationMembershipService } from './organisation-memberships.service';
import { OrganisationMembershipController } from './organisation-memberships.controller';
import { OrganisationMembershipResolver } from './graphql/resolver';

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
  providers: [
    PermissionGuard,
    OrganisationMembershipService,
    OrganisationMembershipResolver,
  ],
  exports: [PermissionGuard],
  controllers: [OrganisationMembershipController],
})
export class OrganisationMembershipEntityModule {}
