import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipPermissionEntity } from './membership_permissions.entity';
import { PermissionEntity } from '@/permissions/permissions.entity';
import { MembershipPermissionsService } from './membership_permissions.service';
import { MembershipPermissionsController } from './membership_permissions.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([MembershipPermissionEntity, PermissionEntity]),
  ],
  exports: [TypeOrmModule],
  providers: [MembershipPermissionsService],
  controllers: [MembershipPermissionsController],
})
export class MembershipPermissionModule {}
