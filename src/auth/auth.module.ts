import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CustomJwtModule } from '@/jwt-service/jwt.module';
import { PasswordModule } from '@/password/password.module';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { UserEntity } from '@/user/user.entity';
import UserModule from '@/user/user.module';
import { UserSessionModule } from '@/user_sessions/user-session.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserSessionEntity } from '@/user_sessions/user-session.entity';
import { OrganisationEntity } from '@/organisations/organisations.entity';
import { ProfileEntity } from '@/profile/profile.entity';
import { RoleEntity } from '@/roles/roles.entity';
import { OrganisationOwnershipHistoryEntity } from '@/organisation-ownership-history/organisation-ownership-history.entity';
import { DatabaseModule } from '@/database/database.module';
import { OrganisationModule } from '@/organisations/module';
import { LoginLockoutModule } from '@/login-lockout/login-lockout.module';

@Module({
  imports: [
    DatabaseModule,
    TypeOrmModule.forFeature([
      UserEntity,
      OrganisationEntity,
      OrganisationMembershipEntity,
      OrganisationOwnershipHistoryEntity,
      ProfileEntity,
      RoleEntity,
      UserSessionEntity,
    ]),
    UserModule,
    PasswordModule,
    CustomJwtModule,
    UserSessionModule,
    OrganisationModule,
    LoginLockoutModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
