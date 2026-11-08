import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DatabaseModule } from '../../src/database/database.module';
import { UserEntity } from '@/user/user.entity';
import { ProfileEntity } from '@/profile/profile.entity';
import { RoleEntity } from '@/roles/roles.entity';
import { PermissionEntity } from '@/permissions/permissions.entity';
import { OrganisationEntity } from '@/organisations/organisations.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { OrganisationMembershipInvitationEntity } from '@/org_membership_invitation/entity';
import { OrganisationMembershipSuspensionHistoryEntity } from '@/org_membership_suspension_histories/entity';
import { OrganisationOwnershipHistoryEntity } from '@/organisation-ownership-history/organisation-ownership-history.entity';
import { OrganisationApiKeyEntity } from '@/organisation-api-key/organisation-api-key.entity';

@Module({
  imports: [
    // Establish the database connection using your existing configuration.
    DatabaseModule,

    // Register all entities required by integration tests.
    TypeOrmModule.forFeature([
      UserEntity,
      ProfileEntity,
      RoleEntity,
      PermissionEntity,
      OrganisationEntity,
      OrganisationMembershipEntity,
      OrganisationMembershipInvitationEntity,
      OrganisationMembershipSuspensionHistoryEntity,
      OrganisationOwnershipHistoryEntity,
      OrganisationApiKeyEntity,
    ]),
  ],
  exports: [
    // Make registered repositories available to importing test modules.
    TypeOrmModule,
  ],
})
export class TestingDatabaseModule {}
