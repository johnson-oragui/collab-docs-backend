import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('GQLCrudPermissions')
export class GQLCrudPermissionsModel {
  @Field(() => Boolean, { nullable: true })
  create?: boolean;

  @Field(() => Boolean, { nullable: true })
  read?: boolean;

  @Field(() => Boolean, { nullable: true })
  update?: boolean;

  @Field(() => Boolean, { nullable: true })
  delete?: boolean;
}

@ObjectType('GQLAuditPermissions')
export class GQLAuditPermissionsModel {
  @Field(() => Boolean, { nullable: true })
  read?: boolean;
}

@ObjectType('GQLGroupedOrganisationPermissions')
export class GQLGroupedOrganisationPermissionsModel {
  @Field(() => GQLCrudPermissionsModel, { nullable: true })
  document?: GQLCrudPermissionsModel;

  @Field(() => GQLCrudPermissionsModel, { nullable: true })
  documentComment?: GQLCrudPermissionsModel;

  @Field(() => GQLCrudPermissionsModel, { nullable: true })
  documentInvitation?: GQLCrudPermissionsModel;

  @Field(() => GQLCrudPermissionsModel, { nullable: true })
  externalDocumentInvitation?: GQLCrudPermissionsModel;

  @Field(() => GQLCrudPermissionsModel, { nullable: true })
  organisation?: GQLCrudPermissionsModel;

  @Field(() => GQLCrudPermissionsModel, { nullable: true })
  organisationInvitation?: GQLCrudPermissionsModel;

  @Field(() => GQLCrudPermissionsModel, { nullable: true })
  organisationMembership?: GQLCrudPermissionsModel;

  @Field(() => GQLCrudPermissionsModel, { nullable: true })
  organisationMembershipPermission?: GQLCrudPermissionsModel;

  @Field(() => GQLCrudPermissionsModel, { nullable: true })
  organisationChat?: GQLCrudPermissionsModel;

  @Field(() => GQLCrudPermissionsModel, { nullable: true })
  memberOrganisation?: GQLCrudPermissionsModel;

  @Field(() => GQLCrudPermissionsModel, { nullable: true })
  member?: GQLCrudPermissionsModel;

  @Field(() => GQLCrudPermissionsModel, { nullable: true })
  role?: GQLCrudPermissionsModel;

  @Field(() => GQLAuditPermissionsModel, { nullable: true })
  audit?: GQLAuditPermissionsModel;
}

// ++++++++ Admin
@ObjectType('GQLGroupedAdminPermissions')
export class GQLGroupedAdminPermissionsModel {
  @Field(() => GQLCrudPermissionsModel, { nullable: true })
  document?: GQLCrudPermissionsModel;

  @Field(() => GQLCrudPermissionsModel, { nullable: true })
  documentComment?: GQLCrudPermissionsModel;

  @Field(() => GQLCrudPermissionsModel, { nullable: true })
  documentInvitation?: GQLCrudPermissionsModel;

  @Field(() => GQLCrudPermissionsModel, { nullable: true })
  externalDocumentInvitation?: GQLCrudPermissionsModel;

  @Field(() => GQLCrudPermissionsModel, { nullable: true })
  organisation?: GQLCrudPermissionsModel;

  @Field(() => GQLCrudPermissionsModel, { nullable: true })
  organisationInvitation?: GQLCrudPermissionsModel;

  @Field(() => GQLCrudPermissionsModel, { nullable: true })
  organisationMembership?: GQLCrudPermissionsModel;

  @Field(() => GQLCrudPermissionsModel, { nullable: true })
  organisationMembershipPermission?: GQLCrudPermissionsModel;

  @Field(() => GQLCrudPermissionsModel, { nullable: true })
  organisationChat?: GQLCrudPermissionsModel;

  @Field(() => GQLCrudPermissionsModel, { nullable: true })
  platformMember?: GQLCrudPermissionsModel;

  @Field(() => GQLCrudPermissionsModel, { nullable: true })
  memberOrganisation?: GQLCrudPermissionsModel;

  @Field(() => GQLCrudPermissionsModel, { nullable: true })
  admin?: GQLCrudPermissionsModel;

  @Field(() => GQLCrudPermissionsModel, { nullable: true })
  member?: GQLCrudPermissionsModel;

  @Field(() => GQLCrudPermissionsModel, { nullable: true })
  role?: GQLCrudPermissionsModel;

  @Field(() => GQLAuditPermissionsModel, { nullable: true })
  audit?: GQLAuditPermissionsModel;
}

@ObjectType('GQLAdminMembershipPermissionModel')
export class GQLAdminMembershipPermissionModel {
  @Field(() => ID)
  id!: string;

  @Field(() => GQLGroupedAdminPermissionsModel, { nullable: true })
  declare permissions: GQLGroupedAdminPermissionsModel | null;
}
