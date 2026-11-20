import { MigrationInterface, QueryRunner } from 'typeorm';

export class InvitationAddRevokedAt1795168467864 implements MigrationInterface {
  name = 'InvitationAddRevokedAt1795168467864';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_ownership_histories" DROP CONSTRAINT "fk_organisation_ownership_histories_organisation_id_collabdocs_"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_ownership_histories" DROP CONSTRAINT "fk_organisation_ownership_histories_previous_owner_id_collabdoc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_ownership_histories" DROP CONSTRAINT "fk_organisation_ownership_histories_new_owner_id_collabdocs_use"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" DROP CONSTRAINT "fk_organisation_membership_invitations_organisation_id_collabdo"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" DROP CONSTRAINT "fk_organisation_membership_invitations_invited_by_id_collabdocs"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_suspension_histories" DROP CONSTRAINT "fk_organisation_membership_suspension_histories_organisation_me"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_membership_permissions" DROP CONSTRAINT "fk_membership_permissions_membership_id_collabdocs_organisation"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" DROP CONSTRAINT "fk_organisation_memberships_organisation_id_collabdocs_organisa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_invitation_permissions" DROP CONSTRAINT "fk_invitation_permissions_invitation_id_collabdocs_organisation"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_role_permission_templates" DROP CONSTRAINT "fk_role_permission_templates_permission_id_collabdocs_permissio"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" ADD "revoked_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" ADD "resent_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" ADD "revoked_by_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_ownership_histories" ADD CONSTRAINT "fk_organisation_ownership_histories_organisation_id_collabdocs_organisations" FOREIGN KEY ("organisation_id") REFERENCES "collabdocs_organisations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_ownership_histories" ADD CONSTRAINT "fk_organisation_ownership_histories_previous_owner_id_collabdocs_users" FOREIGN KEY ("previous_owner_id") REFERENCES "collabdocs_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_ownership_histories" ADD CONSTRAINT "fk_organisation_ownership_histories_new_owner_id_collabdocs_users" FOREIGN KEY ("new_owner_id") REFERENCES "collabdocs_users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" ADD CONSTRAINT "fk_organisation_membership_invitations_organisation_id_collabdocs_organisations" FOREIGN KEY ("organisation_id") REFERENCES "collabdocs_organisations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" ADD CONSTRAINT "fk_organisation_membership_invitations_invited_by_id_collabdocs_users" FOREIGN KEY ("invited_by_id") REFERENCES "collabdocs_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" ADD CONSTRAINT "fk_organisation_membership_invitations_revoked_by_id_collabdocs_users" FOREIGN KEY ("revoked_by_id") REFERENCES "collabdocs_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_suspension_histories" ADD CONSTRAINT "fk_organisation_membership_suspension_histories_organisation_membership_id_collabdocs_organisation_memberships" FOREIGN KEY ("organisation_membership_id") REFERENCES "collabdocs_organisation_memberships"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_membership_permissions" ADD CONSTRAINT "fk_membership_permissions_membership_id_collabdocs_organisation_memberships" FOREIGN KEY ("membership_id") REFERENCES "collabdocs_organisation_memberships"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" ADD CONSTRAINT "fk_organisation_memberships_organisation_id_collabdocs_organisations" FOREIGN KEY ("organisation_id") REFERENCES "collabdocs_organisations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_invitation_permissions" ADD CONSTRAINT "fk_invitation_permissions_invitation_id_collabdocs_organisation_membership_invitations" FOREIGN KEY ("invitation_id") REFERENCES "collabdocs_organisation_membership_invitations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_role_permission_templates" ADD CONSTRAINT "fk_role_permission_templates_permission_id_collabdocs_permissions" FOREIGN KEY ("permission_id") REFERENCES "collabdocs_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "collabdocs_role_permission_templates" DROP CONSTRAINT "fk_role_permission_templates_permission_id_collabdocs_permissions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_invitation_permissions" DROP CONSTRAINT "fk_invitation_permissions_invitation_id_collabdocs_organisation_membership_invitations"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" DROP CONSTRAINT "fk_organisation_memberships_organisation_id_collabdocs_organisations"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_membership_permissions" DROP CONSTRAINT "fk_membership_permissions_membership_id_collabdocs_organisation_memberships"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_suspension_histories" DROP CONSTRAINT "fk_organisation_membership_suspension_histories_organisation_membership_id_collabdocs_organisation_memberships"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" DROP CONSTRAINT "fk_organisation_membership_invitations_revoked_by_id_collabdocs_users"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" DROP CONSTRAINT "fk_organisation_membership_invitations_invited_by_id_collabdocs_users"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" DROP CONSTRAINT "fk_organisation_membership_invitations_organisation_id_collabdocs_organisations"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_ownership_histories" DROP CONSTRAINT "fk_organisation_ownership_histories_new_owner_id_collabdocs_users"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_ownership_histories" DROP CONSTRAINT "fk_organisation_ownership_histories_previous_owner_id_collabdocs_users"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_ownership_histories" DROP CONSTRAINT "fk_organisation_ownership_histories_organisation_id_collabdocs_organisations"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" DROP COLUMN "revoked_by_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" DROP COLUMN "resent_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" DROP COLUMN "revoked_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_role_permission_templates" ADD CONSTRAINT "fk_role_permission_templates_permission_id_collabdocs_permissio" FOREIGN KEY ("permission_id") REFERENCES "collabdocs_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_invitation_permissions" ADD CONSTRAINT "fk_invitation_permissions_invitation_id_collabdocs_organisation" FOREIGN KEY ("invitation_id") REFERENCES "collabdocs_organisation_membership_invitations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" ADD CONSTRAINT "fk_organisation_memberships_organisation_id_collabdocs_organisa" FOREIGN KEY ("organisation_id") REFERENCES "collabdocs_organisations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_membership_permissions" ADD CONSTRAINT "fk_membership_permissions_membership_id_collabdocs_organisation" FOREIGN KEY ("membership_id") REFERENCES "collabdocs_organisation_memberships"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_suspension_histories" ADD CONSTRAINT "fk_organisation_membership_suspension_histories_organisation_me" FOREIGN KEY ("organisation_membership_id") REFERENCES "collabdocs_organisation_memberships"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" ADD CONSTRAINT "fk_organisation_membership_invitations_invited_by_id_collabdocs" FOREIGN KEY ("invited_by_id") REFERENCES "collabdocs_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" ADD CONSTRAINT "fk_organisation_membership_invitations_organisation_id_collabdo" FOREIGN KEY ("organisation_id") REFERENCES "collabdocs_organisations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_ownership_histories" ADD CONSTRAINT "fk_organisation_ownership_histories_new_owner_id_collabdocs_use" FOREIGN KEY ("new_owner_id") REFERENCES "collabdocs_users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_ownership_histories" ADD CONSTRAINT "fk_organisation_ownership_histories_previous_owner_id_collabdoc" FOREIGN KEY ("previous_owner_id") REFERENCES "collabdocs_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_ownership_histories" ADD CONSTRAINT "fk_organisation_ownership_histories_organisation_id_collabdocs_" FOREIGN KEY ("organisation_id") REFERENCES "collabdocs_organisations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
