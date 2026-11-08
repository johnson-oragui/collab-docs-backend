import { Module } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { UserService } from './user.service';
import UserController from './user.controller';
import { PasswordModule } from '../password/password.module';
import { CustomJwtModule } from '../jwt-service/jwt.module';
import { IsEMailUniqueConstraint } from './dto/user-custom-validator/uniqueEmail.validator';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './user.entity';
import { ProfileEntity } from '@/profile/profile.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';

@Module({
  providers: [UserRepository, UserService, IsEMailUniqueConstraint],
  controllers: [UserController],
  exports: [UserService, UserRepository, IsEMailUniqueConstraint],
  imports: [
    PasswordModule,
    CustomJwtModule,
    TypeOrmModule.forFeature([
      UserEntity,
      ProfileEntity,
      OrganisationMembershipEntity,
    ]),
  ],
})
export default class UserModule {}
