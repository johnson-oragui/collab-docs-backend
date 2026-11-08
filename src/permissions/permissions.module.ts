import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionsSeedService } from './permissions-seed.service';
import { PermissionEntity } from './permissions.entity';
import { RoleEntity } from '@/roles/roles.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PermissionEntity, RoleEntity])],
  providers: [PermissionsSeedService],
  exports: [PermissionsSeedService],
})
export class PermissionsModule {}