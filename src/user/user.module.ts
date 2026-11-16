import { Module } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { UserService } from './user.service';
import UserController from './user.controller';
import { PasswordModule } from '../password/password.module';
import { CustomJwtModule } from '../jwt-service/jwt.module';
import {
  IsEMailUniqueConstraint,
  IsOrgEMailUniqueConstraint,
} from './dto/user-custom-validator/uniqueEmail.validator';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './user.entity';
import { ProfileEntity } from '@/profile/profile.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { UserSessionModule } from '@/user_sessions/user-session.module';
import { OrganisationRepository } from '@/organisations/organisation.repository';
import { OrganisationEntity } from '@/organisations/organisations.entity';
import { CustomJwtAuthGuard } from '@/commons/guards/jwt.auth.guard';
import { UserResolver } from './graphql/user.resolver';
import { OrganisationApiKeyEntity } from '@/organisation-api-key/organisation-api-key.entity';
import { OrganisationApiKeyModule } from '@/organisation-api-key/organisation-api-key.module';

@Module({
  providers: [
    UserRepository,
    UserService,
    IsEMailUniqueConstraint,
    IsOrgEMailUniqueConstraint,
    OrganisationRepository,
    UserResolver,
    CustomJwtAuthGuard,
  ],
  controllers: [UserController],
  exports: [
    UserService,
    UserRepository,
    IsEMailUniqueConstraint,
    IsOrgEMailUniqueConstraint,
  ],
  imports: [
    PasswordModule,
    CustomJwtModule,
    TypeOrmModule.forFeature([
      UserEntity,
      ProfileEntity,
      OrganisationMembershipEntity,
      OrganisationEntity,
      OrganisationApiKeyEntity,
    ]),
    UserSessionModule,
    OrganisationApiKeyModule,
  ],
})
export default class UserModule {}
