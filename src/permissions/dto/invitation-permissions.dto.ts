import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';

export class DocumentPermissionsDto {
  @IsOptional()
  @IsBoolean()
  create?: boolean;

  @IsOptional()
  @IsBoolean()
  read?: boolean;

  @IsOptional()
  @IsBoolean()
  update?: boolean;

  @IsOptional()
  @IsBoolean()
  delete?: boolean;
}

export class DocumentCommentPermissionsDto {
  @IsOptional()
  @IsBoolean()
  create?: boolean;

  @IsOptional()
  @IsBoolean()
  read?: boolean;

  @IsOptional()
  @IsBoolean()
  update?: boolean;

  @IsOptional()
  @IsBoolean()
  delete?: boolean;
}

export class DocumentInvitationPermissionsDto {
  @IsOptional()
  @IsBoolean()
  create?: boolean;

  @IsOptional()
  @IsBoolean()
  read?: boolean;

  @IsOptional()
  @IsBoolean()
  update?: boolean;

  @IsOptional()
  @IsBoolean()
  delete?: boolean;
}

export class ExternalDocumentInvitationPermissionsDto {
  @IsOptional()
  @IsBoolean()
  create?: boolean;

  @IsOptional()
  @IsBoolean()
  read?: boolean;

  @IsOptional()
  @IsBoolean()
  update?: boolean;

  @IsOptional()
  @IsBoolean()
  delete?: boolean;
}

export class OrganisationPermissionsDto {
  @IsOptional()
  @IsBoolean()
  create?: boolean;

  @IsOptional()
  @IsBoolean()
  read?: boolean;

  @IsOptional()
  @IsBoolean()
  update?: boolean;

  @IsOptional()
  @IsBoolean()
  delete?: boolean;
}

export class OrganisationInvitationPermissionsDto {
  @IsOptional()
  @IsBoolean()
  create?: boolean;

  @IsOptional()
  @IsBoolean()
  read?: boolean;

  @IsOptional()
  @IsBoolean()
  update?: boolean;

  @IsOptional()
  @IsBoolean()
  delete?: boolean;
}

export class OrganisationMembershipPermissionsDto {
  @IsOptional()
  @IsBoolean()
  create?: boolean;

  @IsOptional()
  @IsBoolean()
  read?: boolean;

  @IsOptional()
  @IsBoolean()
  update?: boolean;

  @IsOptional()
  @IsBoolean()
  delete?: boolean;
}

export class OrganisationChatPermissionsDto {
  @IsOptional()
  @IsBoolean()
  create?: boolean;

  @IsOptional()
  @IsBoolean()
  read?: boolean;

  @IsOptional()
  @IsBoolean()
  update?: boolean;

  @IsOptional()
  @IsBoolean()
  delete?: boolean;
}

export class PlatformMemberPermissionsDto {
  @IsOptional()
  @IsBoolean()
  create?: boolean;

  @IsOptional()
  @IsBoolean()
  read?: boolean;

  @IsOptional()
  @IsBoolean()
  update?: boolean;

  @IsOptional()
  @IsBoolean()
  delete?: boolean;
}

export class MemberOrganisationPermissionsDto {
  @IsOptional()
  @IsBoolean()
  create?: boolean;

  @IsOptional()
  @IsBoolean()
  read?: boolean;

  @IsOptional()
  @IsBoolean()
  update?: boolean;

  @IsOptional()
  @IsBoolean()
  delete?: boolean;
}

export class AdminPermissionsDto {
  @IsOptional()
  @IsBoolean()
  create?: boolean;

  @IsOptional()
  @IsBoolean()
  read?: boolean;

  @IsOptional()
  @IsBoolean()
  update?: boolean;

  @IsOptional()
  @IsBoolean()
  delete?: boolean;
}

export class MemberPermissionsDto {
  @IsOptional()
  @IsBoolean()
  create?: boolean;

  @IsOptional()
  @IsBoolean()
  read?: boolean;

  @IsOptional()
  @IsBoolean()
  update?: boolean;

  @IsOptional()
  @IsBoolean()
  delete?: boolean;
}

export class RolePermissionsDto {
  @IsOptional()
  @IsBoolean()
  create?: boolean;

  @IsOptional()
  @IsBoolean()
  read?: boolean;

  @IsOptional()
  @IsBoolean()
  update?: boolean;

  @IsOptional()
  @IsBoolean()
  delete?: boolean;
}

export class AuditPermissionsDto {
  @IsOptional()
  @IsBoolean()
  read?: boolean;
}

export class InvitePermissionsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => DocumentPermissionsDto)
  document?: DocumentPermissionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DocumentCommentPermissionsDto)
  documentComment?: DocumentCommentPermissionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DocumentInvitationPermissionsDto)
  documentInvitation?: DocumentInvitationPermissionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ExternalDocumentInvitationPermissionsDto)
  externalDocumentInvitation?: ExternalDocumentInvitationPermissionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OrganisationPermissionsDto)
  organisation?: OrganisationPermissionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OrganisationInvitationPermissionsDto)
  organisationInvitation?: OrganisationInvitationPermissionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OrganisationMembershipPermissionsDto)
  organisationMembership?: OrganisationMembershipPermissionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OrganisationChatPermissionsDto)
  organisationChat?: OrganisationChatPermissionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PlatformMemberPermissionsDto)
  platformMember?: PlatformMemberPermissionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MemberOrganisationPermissionsDto)
  memberOrganisation?: MemberOrganisationPermissionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AdminPermissionsDto)
  admin?: AdminPermissionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MemberPermissionsDto)
  member?: MemberPermissionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RolePermissionsDto)
  role?: RolePermissionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AuditPermissionsDto)
  audit?: AuditPermissionsDto;
}
