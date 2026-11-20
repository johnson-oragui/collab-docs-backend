import { RequirePermissions } from '@/commons/decorators/require-permissions.decorator';
import { CustomJwtAuthGuard } from '@/commons/guards/jwt.auth.guard';
import { PermissionGuard } from '@/commons/guards/permission.guard';
import { PermissionEnum } from '@/permissions/permission.registry';
import {
  Controller,
  Get,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RoleService } from './role.service';

@ApiTags('ROLES -> PERMISSIONS')
@Controller('api/v1/roles-permissions')
@UseGuards(CustomJwtAuthGuard, PermissionGuard)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @RequirePermissions(PermissionEnum.ROLE.READ)
  async getRolesWithPermissions(
    @Query('roleId', new ParseUUIDPipe({ version: '7', optional: true }))
    roleId?: string,
  ) {
    if (roleId) return await this.roleService.getRoleWithPermissions(roleId);
    return await this.roleService.getRolesWithPermissions();
  }
}
