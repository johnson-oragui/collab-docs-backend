import {
  OrganisationRoleEnum,
  PermissionAssignmentModeEnum,
  type TOrganisationRoleEnum,
} from '@/commons/enums';
import { InvitePermissionsDto } from '@/permissions/dto/invitation-permissions.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEnum,
  ValidateIf,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  Validate,
  IsOptional,
} from 'class-validator';

@ValidatorConstraint({ name: 'RejectPermissionsForOrgAdmin', async: false })
export class RejectPermissionsForOrgAdminConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const dto = args.object as ReassignOrganisationMemberShipRoleDto;

    if (dto.role === OrganisationRoleEnum.ORG_ADMIN && value !== undefined) {
      return false;
    }

    return true;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Permissions cannot be configured or provided for the ORG_ADMIN role.';
  }
}

@ValidatorConstraint({ name: 'RejectPermissionModeForOrgAdmin', async: false })
export class RejectPermissionModeForOrgAdminConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const dto = args.object as any;

    if (dto.role === OrganisationRoleEnum.ORG_ADMIN && value !== undefined) {
      return false;
    }

    if (dto.role !== OrganisationRoleEnum.ORG_ADMIN) {
      if (!dto.permissionMode) return false;
    }

    return true;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Permission mode can only be configured for role that is not ORG_ADMIN.';
  }
}

export class ReassignOrganisationMemberShipRoleDto {
  @ApiProperty({ example: OrganisationRoleEnum.ORG_MEMBER, required: true })
  @IsEnum(OrganisationRoleEnum)
  declare role: TOrganisationRoleEnum;

  @ApiProperty({ example: 'DEFAULT', required: false })
  @Validate(RejectPermissionModeForOrgAdminConstraint)
  @IsOptional()
  @IsEnum(['DEFAULT', 'CUSTOM'])
  permissionMode?: 'DEFAULT' | 'CUSTOM' = 'DEFAULT';

  @ApiProperty({
    example: {
      document: {
        create: true,
        read: true,
        update: false,
        delete: false,
      },
      documentComment: {
        create: true,
        read: true,
      },
      organisation: {
        read: true,
      },
    },
  })
  @Validate(RejectPermissionsForOrgAdminConstraint)
  @ValidateIf(
    (dto) => dto.permissionMode === PermissionAssignmentModeEnum.CUSTOM,
  )
  @IsDefined()
  @ValidateNested()
  @Type(() => InvitePermissionsDto)
  permissions?: InvitePermissionsDto;
}
