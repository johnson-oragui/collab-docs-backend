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
import { OrganisationMembershipInvitationModule } from './org_membership_invitation/module';
import { OrganisationMembershipSuspensionHistoryModule } from './org_membership_suspension_histories/module';
import { OrganisationMembershipEntityModule } from './organisation-memberships/module';
import { OrganisationModule } from './organisations/module';
import { ProfileModule } from './profile/profile.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { OrganisationOwnershipHistoryModule } from './organisation-ownership-history/organisation-ownership-history.module';
import { OrganisationApiKeyModule } from './organisation-api-key/organisation-api-key.module';
import { UserSessionTokenModule } from './user-session-token/user-session-token.module';
import { UserSessionModule } from './user_sessions/user-session.module';
import { LoginLockoutModule } from './login-lockout/login-lockout.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvConfig }),
    DatabaseModule,
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
