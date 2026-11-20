import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleEntity } from './roles.entity';
import { PermissionEntity } from '../permissions/permissions.entity';
import { RolesSeedService } from './roles.roles-seed.service';
import { PermissionsSeedService } from '@/permissions/permissions-seed.service';
import { RoleService } from './role.service';
import { RoleController } from './role.controller';
import { UserEntity } from '@/user/user.entity';
import { UserSessionModule } from '@/user_sessions/user-session.module';
import { OrganisationApiKeyModule } from '@/organisation-api-key/organisation-api-key.module';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RoleEntity,
      PermissionEntity,
      UserEntity,
      OrganisationMembershipEntity,
    ]),
    UserSessionModule,
    OrganisationApiKeyModule,
  ],
  providers: [RolesSeedService, PermissionsSeedService, RoleService],
  exports: [RolesSeedService],
  controllers: [RoleController],
})
export class RolesModule {}
