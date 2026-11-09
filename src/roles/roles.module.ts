import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleEntity } from './roles.entity';
import { PermissionEntity } from '../permissions/permissions.entity';
import { RolesSeedService } from './roles.roles-seed.service';
import { PermissionsSeedService } from '@/permissions/permissions-seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([RoleEntity, PermissionEntity])],
  providers: [RolesSeedService, PermissionsSeedService],
  exports: [RolesSeedService],
})
export class RolesModule {}