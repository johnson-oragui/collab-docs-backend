import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganisationAuditEntity } from './organisation_audit.entity';
import { OrganisationAuditController } from './organisation_audit.controller';
import { OrganisationAuditService } from './organisation_audit.service';
import { UserEntity } from '@/user/user.entity';
import { UserSessionEntity } from '@/user_sessions/user-session.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganisationAuditEntity,
      UserEntity,
      UserSessionEntity,
      OrganisationMembershipEntity,
    ]),
  ],
  exports: [TypeOrmModule],
  controllers: [OrganisationAuditController],
  providers: [OrganisationAuditService],
})
export class OrganisationAuditModule {}
