import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvitationPermissionEntity } from './invitation_permissions.entity';

@Module({
  imports: [TypeOrmModule.forFeature([InvitationPermissionEntity])],
  exports: [TypeOrmModule],
})
export class InvitationPermissionModule {}
