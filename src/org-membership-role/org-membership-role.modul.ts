import { Module } from '@nestjs/common';
import { OrganisationMembershipRoleController } from './org-membership-role.controller';
import { OrganisationMembershipRoleService } from './org-membership-role.service';
import { RolesModule } from '@/roles/roles.module';
import { EmailOutboxModule } from '@/email-outbox/email-outbox.module';

@Module({
  controllers: [OrganisationMembershipRoleController],
  providers: [OrganisationMembershipRoleService],
  imports: [RolesModule, EmailOutboxModule],
})
export class OrganisationMembershipRoleModule {}
