import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganisationMembershipInvitationEntity } from './org_membership_invitation.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { InvitationPermissionModule } from '@/invitation_permissions/invitation_permissions.module';
import { MembershipPermissionModule } from '@/membership_permissions/membership_permissions.module';
import { OrganisationInvitationController } from './org_membership_invitation.controller';
import { OrganisationmembershipinvitationService } from './org_membership_invitation.service';
import { PasswordResetTokenEntity } from '@/password-recovery/password-recovery.entity';
import { OrganisationAuditEntity } from '@/organisation_audit/organisation_audit.entity';
import { InvitationPermissionEntity } from '@/invitation_permissions/invitation_permissions.entity';
import { MembershipPermissionEntity } from '@/membership_permissions/membership_permissions.entity';
import { EmailOutboxModule } from '@/email-outbox/email-outbox.module';
import { EmailTemplateService } from '@/email/email-template.service';
import { UserEntity } from '@/user/user.entity';
import { UserSessionModule } from '@/user_sessions/user-session.module';
import { OrganisationApiKeyModule } from '@/organisation-api-key/organisation-api-key.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganisationMembershipInvitationEntity,
      OrganisationMembershipEntity,
      PasswordResetTokenEntity,
      OrganisationAuditEntity,
      InvitationPermissionEntity,
      MembershipPermissionEntity,
      UserEntity,
    ]),
    InvitationPermissionModule,
    MembershipPermissionModule,
    EmailOutboxModule,
    UserSessionModule,
    OrganisationApiKeyModule,
  ],
  controllers: [OrganisationInvitationController],
  providers: [OrganisationmembershipinvitationService, EmailTemplateService],
})
export class OrganisationMembershipInvitationModule {}
