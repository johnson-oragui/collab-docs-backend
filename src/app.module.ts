import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnvConfig } from './config/env.validation';
import { LoggerMiddleware } from './commons/middlewares/logging.middleware';
import { CatchAllMiddleware } from './commons/middlewares/catchall.middleware';
import { UserAgentGuard } from './commons/guards/userAgent.guards';
import UserModule from './user/user.module';
import { CustomJwtModule } from './jwt-service/jwt.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { OrganisationMembershipInvitationModule } from './org_membership_invitation/org_membership_invitation.module';
import { OrganisationMembershipSuspensionHistoryModule } from './org_membership_suspension_histories/org_membership_suspension_histories.module';
import { OrganisationMembershipEntityModule } from './organisation-memberships/organisation-memberships.module';
import { OrganisationModule } from './organisations/module';
import { ProfileModule } from './profile/profile.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { OrganisationOwnershipHistoryModule } from './organisation-ownership-history/organisation-ownership-history.module';
import { OrganisationApiKeyModule } from './organisation-api-key/organisation-api-key.module';
import { UserSessionTokenModule } from './user-session-token/user-session-token.module';
import { UserSessionModule } from './user_sessions/user-session.module';
import { LoginLockoutModule } from './login-lockout/login-lockout.module';
import { PasswordRecoveryModule } from './password-recovery/password-recovery.module';
import { EmailModule } from './email/email.module';
import { ScheduleModule } from '@nestjs/schedule';
import { EmailOutboxModule } from './email-outbox/email-outbox.module';
import { EmailVerificationModule } from './email-verification/email-verification.module';
import { AppGraphQLModule } from './graphql/graphql.module';
import { MembershipPermissionModule } from './membership_permissions/membership_permissions.module';
import { OrganisationAuditModule } from './organisation_audit/organisation_audit.module';
import { registerGraphqlEnums } from './commons/grapgql/registered-enums';
import { OrganisationMembershipRoleModule } from './org-membership-role/org-membership-role.modul';
import { OwnershipTransferModule } from './ownership-transfer/ownership-transfer.module';

registerGraphqlEnums();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvConfig }),
    ScheduleModule.forRoot(),
    AppGraphQLModule,
    DatabaseModule,
    EmailModule,
    LoginLockoutModule,
    UserModule,
    ProfileModule,
    CustomJwtModule,
    AuthModule,
    OrganisationModule,
    OrganisationMembershipEntityModule,
    OrganisationMembershipInvitationModule,
    OrganisationMembershipSuspensionHistoryModule,
    RolesModule,
    PermissionsModule,
    OrganisationOwnershipHistoryModule,
    OrganisationApiKeyModule,
    UserSessionTokenModule,
    UserSessionModule,
    PasswordRecoveryModule,
    EmailOutboxModule,
    EmailVerificationModule,
    MembershipPermissionModule,
    OrganisationAuditModule,
    OrganisationMembershipRoleModule,
    OwnershipTransferModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: UserAgentGuard,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
    consumer.apply(CatchAllMiddleware).forRoutes('*');
  }
}
