import {
  OrganisationRoleEnum,
  PermissionAssignmentModeEnum,
  type TOrganisationRoleEnum,
  type TPermissionAssignmentModeEnum,
} from '@/commons/enums';
import { InvitePermissionsDto } from '@/permissions/dto/invitation-permissions.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
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
    const dto = args.object as InviteOrganisationMemberDto;

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

export class InviteOrganisationMemberDto {
  @ApiProperty({ example: 'johnson@email.com', required: true })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  declare email: string;

  @ApiProperty({ example: 'Johnson', required: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  declare firstName: string;

  @ApiProperty({ example: 'Dennis', required: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  declare lastName: string;

  @ApiProperty({ example: OrganisationRoleEnum.ORG_MEMBER, required: true })
  @IsEnum(OrganisationRoleEnum)
  declare role: TOrganisationRoleEnum;

  @ApiProperty({ example: 'DEFAULT', required: false })
  @Validate(RejectPermissionModeForOrgAdminConstraint)
  @IsOptional()
  @IsEnum(PermissionAssignmentModeEnum)
  permissionMode?: TPermissionAssignmentModeEnum;

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
