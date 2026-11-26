import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DatabaseModule } from '../../src/database/database.module';
import { UserEntity } from '@/user/user.entity';
import { ProfileEntity } from '@/profile/profile.entity';
import { RoleEntity } from '@/roles/roles.entity';
import { PermissionEntity } from '@/permissions/permissions.entity';
import { OrganisationEntity } from '@/organisations/organisations.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { OrganisationMembershipInvitationEntity } from '@/org_membership_invitation/org_membership_invitation.entity';
import { OrganisationMembershipSuspensionHistoryEntity } from '@/org_membership_suspension_histories/org_membership_suspension_histories.entity';
import { OrganisationOwnershipHistoryEntity } from '@/organisation-ownership-history/organisation-ownership-history.entity';
import { OrganisationApiKeyEntity } from '@/organisation-api-key/organisation-api-key.entity';
import { UserSessionTokenEntity } from '@/user-session-token/user-session-token.entity';
import { UserSessionEntity } from '@/user_sessions/user-session.entity';
import { PasswordResetTokenEntity } from '@/password-recovery/password-recovery.entity';
import { EmailOutboxEntity } from '@/email-outbox/email.entity';
import { InvitationPermissionEntity } from '@/invitation_permissions/invitation_permissions.entity';
import { MembershipPermissionEntity } from '@/membership_permissions/membership_permissions.entity';
import { OrganisationAuditEntity } from '@/organisation_audit/organisation_audit.entity';
import { NotificationEntity } from '@/notification/notification.entity';
import { NotificationOutboxEntity } from '@/notification-outbox/notification-outbox.entity';
import { NotificationPreferenceEntity } from '@/notification-preference/notification-preference.entity';
import { NotificationRecipientEntity } from '@/notification-recipients/notification-recipients.entity';

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
      UserSessionTokenEntity,
      UserSessionEntity,
      PasswordResetTokenEntity,
      EmailOutboxEntity,
      InvitationPermissionEntity,
      MembershipPermissionEntity,
      OrganisationAuditEntity,
      NotificationEntity,
      NotificationOutboxEntity,
      NotificationPreferenceEntity,
      NotificationRecipientEntity,
    ]),
  ],
  exports: [
    // Make registered repositories available to importing test modules.
    TypeOrmModule,
  ],
})
export class TestingDatabaseModule {}
