import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipPermissionEntity } from './membership_permissions.entity';
import { PermissionEntity } from '@/permissions/permissions.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([MembershipPermissionEntity, PermissionEntity]),
  ],
  exports: [TypeOrmModule],
})
export class MembershipPermissionModule {}
