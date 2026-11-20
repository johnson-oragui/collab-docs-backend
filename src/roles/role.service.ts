import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RoleEntity } from './roles.entity';
import { Repository } from 'typeorm';
import { handleServiceMethodError } from '@/commons/util/errorHandler';
import { ApiResponseDto } from '@/commons/dtos/api-response.dto';
import { groupPermissionsToNested } from '@/commons/util/groupPermissionsToNested';
import { TRoleEnum } from '@/database/database.enums';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
  ) {}

  async getRoleWithPermissions(roleId: string): Promise<
    ApiResponseDto<
      {
        id: string;
        name: TRoleEnum;
        description: string;
        permissions: Record<string, Record<string, boolean>>;
      }[]
    >
  > {
    try {
      const roleWithPermissions = await this.roleRepository.findOne({
        where: {
          id: roleId,
          isDeleted: false,
          permissions: { isDeleted: false },
        },
        relations: { permissions: true },
      });
      if (!roleWithPermissions)
        throw new HttpException({ message: 'Role was not found' }, 404);

      const { permissions, ...restOfRole } = roleWithPermissions ?? {};
      const data = [
        {
          id: restOfRole.id,
          name: restOfRole.name,
          description: restOfRole.description,
          permissions: groupPermissionsToNested(permissions),
        },
      ];
      return new ApiResponseDto<
        {
          id: string;
          name: TRoleEnum;
          description: string;
          permissions: Record<string, Record<string, boolean>>;
        }[]
      >({
        data,
        message: 'Role with Permissions retrieved succesfully',
        success: true,
      });
    } catch (error) {
      return handleServiceMethodError(
        error,
        'Could not retrieve Role with Permissions',
      );
    }
  }

  async getRolesWithPermissions(): Promise<
    ApiResponseDto<
      {
        id: string;
        name: TRoleEnum;
        description: string;
        permissions: Record<string, Record<string, boolean>>;
      }[]
    >
  > {
    try {
      const roles = await this.roleRepository.find({
        where: { isDeleted: false },
        relations: { permissions: true },
      });

      const rolesWithPermissions = roles.map((role) => {
        const { permissions, ...restOfRole } = role;
        return {
          id: restOfRole.id,
          name: restOfRole.name,
          description: restOfRole.description,
          permissions: groupPermissionsToNested(permissions),
        };
      });
      return new ApiResponseDto<
        {
          id: string;
          name: TRoleEnum;
          description: string;
          permissions: Record<string, Record<string, boolean>>;
        }[]
      >({
        data: rolesWithPermissions,
        message: 'Role with Permissions retrieved succesfully',
        success: true,
      });
    } catch (error) {
      return handleServiceMethodError(
        error,
        'Could not retrieve Roles with Permissions',
      );
    }
  }
}
