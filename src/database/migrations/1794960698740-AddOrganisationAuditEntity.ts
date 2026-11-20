import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrganisationAuditEntity1794960698740 implements MigrationInterface {
  name = 'AddOrganisationAuditEntity1794960698740';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_ownership_histories" DROP CONSTRAINT "fk_collabdocs_organisation_ownership_histories_organisation_id_"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_ownership_histories" DROP CONSTRAINT "fk_collabdocs_organisation_ownership_histories_previous_owner_i"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_ownership_histories" DROP CONSTRAINT "fk_collabdocs_organisation_ownership_histories_new_owner_id_col"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" DROP CONSTRAINT "fk_collabdocs_organisation_membership_invitations_organisation_"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" DROP CONSTRAINT "fk_collabdocs_organisation_membership_invitations_role_id_colla"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" DROP CONSTRAINT "fk_collabdocs_organisation_membership_invitations_invited_by_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisations" DROP CONSTRAINT "fk_collabdocs_organisations_owner_id_collabdocs_users"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisations" DROP CONSTRAINT "fk_collabdocs_organisations_creator_id_collabdocs_users"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_api_keys" DROP CONSTRAINT "fk_collabdocs_api_keys_user_id_collabdocs_users"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_api_keys" DROP CONSTRAINT "fk_collabdocs_api_keys_organisation_id_collabdocs_organisations"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_user_session_tokens" DROP CONSTRAINT "fk_collabdocs_user_session_tokens_session_id_collabdocs_user_se"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_user_sessions" DROP CONSTRAINT "fk_collabdocs_user_sessions_user_id_collabdocs_users"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_user_sessions" DROP CONSTRAINT "fk_collabdocs_user_sessions_organisation_id_collabdocs_organisa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_users" DROP CONSTRAINT "fk_collabdocs_users_profile_id_collabdocs_profiles"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_suspension_histories" DROP CONSTRAINT "fk_collabdocs_organisation_membership_suspension_histories_orga"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_membership_permissions" DROP CONSTRAINT "fk_collabdocs_membership_permissions_membership_id_collabdocs_o"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_membership_permissions" DROP CONSTRAINT "fk_collabdocs_membership_permissions_permission_id_collabdocs_p"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" DROP CONSTRAINT "fk_collabdocs_organisation_memberships_user_id_collabdocs_users"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" DROP CONSTRAINT "fk_collabdocs_organisation_memberships_role_id_collabdocs_roles"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" DROP CONSTRAINT "fk_collabdocs_organisation_memberships_organisation_id_collabdo"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_invitation_permissions" DROP CONSTRAINT "fk_collabdocs_invitation_permissions_invitation_id_collabdocs_o"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_invitation_permissions" DROP CONSTRAINT "fk_collabdocs_invitation_permissions_permission_id_collabdocs_p"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_password_reset_tokens" DROP CONSTRAINT "fk_collabdocs_password_reset_tokens_user_id_collabdocs_users"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_role_permission_templates" DROP CONSTRAINT "fk_collabdocs_role_permission_templates_role_id_collabdocs_role"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_role_permission_templates" DROP CONSTRAINT "fk_collabdocs_role_permission_templates_permission_id_collabdoc"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_email_outbox_id_is_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_profiles_id_is_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_organisation_ownership_histories_id_is_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_organisation_membership_invitations_id_is_delete"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_organisation_membership_invitations_email_organi"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_organisations_id_is_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_api_keys_id_is_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_api_keys_prefix"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_user_session_tokens_id_is_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_user_sessions_id_is_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_users_id_is_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_organisation_membership_suspension_histories_id_"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_membership_permissions_id_is_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_membership_permissions_membership_id_permission_"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_organisation_memberships_id_is_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_organisation_memberships_user_id_organisation_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_roles_id_is_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_permissions_id_is_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_invitation_permissions_id_is_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_invitation_permissions_invitation_id_permission_"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_password_reset_tokens_id_is_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_role_permission_templates_role_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_role_permission_templates_permission_id"`,
    );
    await queryRunner.query(
      `CREATE TABLE "collabdocs_organisation_audits" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "is_deleted" boolean NOT NULL DEFAULT false, "event_type" character varying(100) NOT NULL, "metadata" jsonb, "organisation_id" uuid, "actor_id" uuid, CONSTRAINT "pk_organisation_audits_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_organisation_audits_id_is_deleted" ON "collabdocs_organisation_audits" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_organisation_audits_organisation_id_created_at" ON "collabdocs_organisation_audits"  ("organisation_id", "created_at") `,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."collabdocs_email_outbox_event_type_enum" ADD VALUE IF NOT EXISTS  'ORGANISATION_INVITATION'`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_password_reset_tokens_user_status"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."collabdocs_password_reset_tokens_purpose_enum" ADD VALUE IF NOT EXISTS  'ORGANISATION_INVITATION'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_email_outbox_id_is_deleted" ON "collabdocs_email_outbox" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_profiles_id_is_deleted" ON "collabdocs_profiles" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_organisation_ownership_histories_id_is_deleted" ON "collabdocs_organisation_ownership_histories" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_organisation_membership_invitations_id_is_deleted" ON "collabdocs_organisation_membership_invitations" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_organisation_membership_invitations_invited_by_id" ON "collabdocs_organisation_membership_invitations"  ("invited_by_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_organisation_membership_invitations_email_organisation_id" ON "collabdocs_organisation_membership_invitations"  ("email", "organisation_id") WHERE status = 'PENDING'::collabdocs_invitation_status_enum`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_organisation_membership_invitations_email_organisation_id" ON "collabdocs_organisation_membership_invitations" ("email", "organisation_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_organisations_id_is_deleted" ON "collabdocs_organisations" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_api_keys_id_is_deleted" ON "collabdocs_api_keys" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_api_keys_prefix" ON "collabdocs_api_keys"  ("prefix") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_session_tokens_id_is_deleted" ON "collabdocs_user_session_tokens" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_sessions_id_is_deleted" ON "collabdocs_user_sessions" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_users_id_is_deleted" ON "collabdocs_users" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_organisation_membership_suspension_histories_id_is_deleted" ON "collabdocs_organisation_membership_suspension_histories" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_membership_permissions_id_is_deleted" ON "collabdocs_membership_permissions" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_membership_permissions_membership_id_permission_id" ON "collabdocs_membership_permissions"  ("membership_id", "permission_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_organisation_memberships_id_is_deleted" ON "collabdocs_organisation_memberships" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_organisation_memberships_user_id_organisation_id" ON "collabdocs_organisation_memberships"  ("user_id", "organisation_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_roles_id_is_deleted" ON "collabdocs_roles" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_permissions_id_is_deleted" ON "collabdocs_permissions" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_invitation_permissions_id_is_deleted" ON "collabdocs_invitation_permissions" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_invitation_permissions_invitation_id_permission_id" ON "collabdocs_invitation_permissions"  ("invitation_id", "permission_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_password_reset_tokens_id_is_deleted" ON "collabdocs_password_reset_tokens" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_password_reset_tokens_user_status" ON "collabdocs_password_reset_tokens"  ("user_id", "purpose", "used_at", "revoked_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_role_permission_templates_role_id" ON "collabdocs_role_permission_templates"  ("role_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_role_permission_templates_permission_id" ON "collabdocs_role_permission_templates"  ("permission_id") `,
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
      `ALTER TABLE "collabdocs_organisation_membership_invitations" ADD CONSTRAINT "fk_organisation_membership_invitations_role_id_collabdocs_roles" FOREIGN KEY ("role_id") REFERENCES "collabdocs_roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" ADD CONSTRAINT "fk_organisation_membership_invitations_invited_by_id_collabdocs_users" FOREIGN KEY ("invited_by_id") REFERENCES "collabdocs_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisations" ADD CONSTRAINT "fk_organisations_owner_id_collabdocs_users" FOREIGN KEY ("owner_id") REFERENCES "collabdocs_users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisations" ADD CONSTRAINT "fk_organisations_creator_id_collabdocs_users" FOREIGN KEY ("creator_id") REFERENCES "collabdocs_users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_api_keys" ADD CONSTRAINT "fk_api_keys_user_id_collabdocs_users" FOREIGN KEY ("user_id") REFERENCES "collabdocs_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_api_keys" ADD CONSTRAINT "fk_api_keys_organisation_id_collabdocs_organisations" FOREIGN KEY ("organisation_id") REFERENCES "collabdocs_organisations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_user_session_tokens" ADD CONSTRAINT "fk_user_session_tokens_session_id_collabdocs_user_sessions" FOREIGN KEY ("session_id") REFERENCES "collabdocs_user_sessions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_user_sessions" ADD CONSTRAINT "fk_user_sessions_user_id_collabdocs_users" FOREIGN KEY ("user_id") REFERENCES "collabdocs_users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_user_sessions" ADD CONSTRAINT "fk_user_sessions_organisation_id_collabdocs_organisations" FOREIGN KEY ("organisation_id") REFERENCES "collabdocs_organisations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_users" ADD CONSTRAINT "fk_users_profile_id_collabdocs_profiles" FOREIGN KEY ("profile_id") REFERENCES "collabdocs_profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_suspension_histories" ADD CONSTRAINT "fk_organisation_membership_suspension_histories_organisation_membership_id_collabdocs_organisation_memberships" FOREIGN KEY ("organisation_membership_id") REFERENCES "collabdocs_organisation_memberships"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_membership_permissions" ADD CONSTRAINT "fk_membership_permissions_membership_id_collabdocs_organisation_memberships" FOREIGN KEY ("membership_id") REFERENCES "collabdocs_organisation_memberships"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_membership_permissions" ADD CONSTRAINT "fk_membership_permissions_permission_id_collabdocs_permissions" FOREIGN KEY ("permission_id") REFERENCES "collabdocs_permissions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" ADD CONSTRAINT "fk_organisation_memberships_user_id_collabdocs_users" FOREIGN KEY ("user_id") REFERENCES "collabdocs_users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" ADD CONSTRAINT "fk_organisation_memberships_organisation_id_collabdocs_organisations" FOREIGN KEY ("organisation_id") REFERENCES "collabdocs_organisations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" ADD CONSTRAINT "fk_organisation_memberships_role_id_collabdocs_roles" FOREIGN KEY ("role_id") REFERENCES "collabdocs_roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_invitation_permissions" ADD CONSTRAINT "fk_invitation_permissions_invitation_id_collabdocs_organisation_membership_invitations" FOREIGN KEY ("invitation_id") REFERENCES "collabdocs_organisation_membership_invitations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_invitation_permissions" ADD CONSTRAINT "fk_invitation_permissions_permission_id_collabdocs_permissions" FOREIGN KEY ("permission_id") REFERENCES "collabdocs_permissions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_audits" ADD CONSTRAINT "fk_organisation_audits_organisation_id_collabdocs_organisations" FOREIGN KEY ("organisation_id") REFERENCES "collabdocs_organisations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_audits" ADD CONSTRAINT "fk_organisation_audits_actor_id_collabdocs_users" FOREIGN KEY ("actor_id") REFERENCES "collabdocs_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_password_reset_tokens" ADD CONSTRAINT "fk_password_reset_tokens_user_id_collabdocs_users" FOREIGN KEY ("user_id") REFERENCES "collabdocs_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_role_permission_templates" ADD CONSTRAINT "fk_role_permission_templates_role_id_collabdocs_roles" FOREIGN KEY ("role_id") REFERENCES "collabdocs_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
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
      `ALTER TABLE "collabdocs_role_permission_templates" DROP CONSTRAINT "fk_role_permission_templates_role_id_collabdocs_roles"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_password_reset_tokens" DROP CONSTRAINT "fk_password_reset_tokens_user_id_collabdocs_users"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_audits" DROP CONSTRAINT "fk_organisation_audits_actor_id_collabdocs_users"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_audits" DROP CONSTRAINT "fk_organisation_audits_organisation_id_collabdocs_organisations"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_invitation_permissions" DROP CONSTRAINT "fk_invitation_permissions_permission_id_collabdocs_permissions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_invitation_permissions" DROP CONSTRAINT "fk_invitation_permissions_invitation_id_collabdocs_organisation_membership_invitations"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" DROP CONSTRAINT "fk_organisation_memberships_role_id_collabdocs_roles"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" DROP CONSTRAINT "fk_organisation_memberships_organisation_id_collabdocs_organisations"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" DROP CONSTRAINT "fk_organisation_memberships_user_id_collabdocs_users"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_membership_permissions" DROP CONSTRAINT "fk_membership_permissions_permission_id_collabdocs_permissions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_membership_permissions" DROP CONSTRAINT "fk_membership_permissions_membership_id_collabdocs_organisation_memberships"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_suspension_histories" DROP CONSTRAINT "fk_organisation_membership_suspension_histories_organisation_membership_id_collabdocs_organisation_memberships"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_users" DROP CONSTRAINT "fk_users_profile_id_collabdocs_profiles"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_user_sessions" DROP CONSTRAINT "fk_user_sessions_organisation_id_collabdocs_organisations"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_user_sessions" DROP CONSTRAINT "fk_user_sessions_user_id_collabdocs_users"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_user_session_tokens" DROP CONSTRAINT "fk_user_session_tokens_session_id_collabdocs_user_sessions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_api_keys" DROP CONSTRAINT "fk_api_keys_organisation_id_collabdocs_organisations"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_api_keys" DROP CONSTRAINT "fk_api_keys_user_id_collabdocs_users"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisations" DROP CONSTRAINT "fk_organisations_creator_id_collabdocs_users"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisations" DROP CONSTRAINT "fk_organisations_owner_id_collabdocs_users"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" DROP CONSTRAINT "fk_organisation_membership_invitations_invited_by_id_collabdocs_users"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" DROP CONSTRAINT "fk_organisation_membership_invitations_role_id_collabdocs_roles"`,
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
      `DROP INDEX "public"."idx_role_permission_templates_permission_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_role_permission_templates_role_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_password_reset_tokens_user_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_password_reset_tokens_id_is_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_invitation_permissions_invitation_id_permission_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_invitation_permissions_id_is_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_permissions_id_is_deleted"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_roles_id_is_deleted"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_organisation_memberships_user_id_organisation_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_organisation_memberships_id_is_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_membership_permissions_membership_id_permission_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_membership_permissions_id_is_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_organisation_membership_suspension_histories_id_is_deleted"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_users_id_is_deleted"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_user_sessions_id_is_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_user_session_tokens_id_is_deleted"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_api_keys_prefix"`);
    await queryRunner.query(`DROP INDEX "public"."idx_api_keys_id_is_deleted"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_organisations_id_is_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_organisation_membership_invitations_email_organisation_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_organisation_membership_invitations_email_organisation_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_organisation_membership_invitations_invited_by_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_organisation_membership_invitations_id_is_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_organisation_ownership_histories_id_is_deleted"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_profiles_id_is_deleted"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_email_outbox_id_is_deleted"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."collabdocs_password_reset_tokens_purpose_enum_old" AS ENUM('PASSWORD_RESET', 'EMAIL_VERIFICATION')`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_password_reset_tokens" ALTER COLUMN "purpose" TYPE "public"."collabdocs_password_reset_tokens_purpose_enum_old" USING "purpose"::"text"::"public"."collabdocs_password_reset_tokens_purpose_enum_old"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."collabdocs_password_reset_tokens_purpose_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."collabdocs_password_reset_tokens_purpose_enum_old" RENAME TO "collabdocs_password_reset_tokens_purpose_enum"`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_password_reset_tokens_user_status" ON "collabdocs_password_reset_tokens" USING btree ("purpose", "revoked_at", "used_at", "user_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."collabdocs_email_outbox_event_type_enum_old" AS ENUM('PASSWORD_RESET', 'EMAIL_VERIFICATION')`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_email_outbox" ALTER COLUMN "event_type" TYPE "public"."collabdocs_email_outbox_event_type_enum_old" USING "event_type"::"text"::"public"."collabdocs_email_outbox_event_type_enum_old"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."collabdocs_email_outbox_event_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."collabdocs_email_outbox_event_type_enum_old" RENAME TO "collabdocs_email_outbox_event_type_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_organisation_audits_organisation_id_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_organisation_audits_id_is_deleted"`,
    );
    await queryRunner.query(`DROP TABLE "collabdocs_organisation_audits"`);
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_role_permission_templates_permission_id" ON "collabdocs_role_permission_templates" USING btree ("permission_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_role_permission_templates_role_id" ON "collabdocs_role_permission_templates" USING btree ("role_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_password_reset_tokens_id_is_deleted" ON "collabdocs_password_reset_tokens" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_collabdocs_invitation_permissions_invitation_id_permission_" ON "collabdocs_invitation_permissions" USING btree ("invitation_id", "permission_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_invitation_permissions_id_is_deleted" ON "collabdocs_invitation_permissions" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_permissions_id_is_deleted" ON "collabdocs_permissions" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_roles_id_is_deleted" ON "collabdocs_roles" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_collabdocs_organisation_memberships_user_id_organisation_id" ON "collabdocs_organisation_memberships" USING btree ("organisation_id", "user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_organisation_memberships_id_is_deleted" ON "collabdocs_organisation_memberships" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_collabdocs_membership_permissions_membership_id_permission_" ON "collabdocs_membership_permissions" USING btree ("membership_id", "permission_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_membership_permissions_id_is_deleted" ON "collabdocs_membership_permissions" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_organisation_membership_suspension_histories_id_" ON "collabdocs_organisation_membership_suspension_histories" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_users_id_is_deleted" ON "collabdocs_users" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_user_sessions_id_is_deleted" ON "collabdocs_user_sessions" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_user_session_tokens_id_is_deleted" ON "collabdocs_user_session_tokens" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_api_keys_prefix" ON "collabdocs_api_keys" USING btree ("prefix") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_api_keys_id_is_deleted" ON "collabdocs_api_keys" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_organisations_id_is_deleted" ON "collabdocs_organisations" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_organisation_membership_invitations_email_organi" ON "collabdocs_organisation_membership_invitations" USING btree ("email", "organisation_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_organisation_membership_invitations_id_is_delete" ON "collabdocs_organisation_membership_invitations" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_organisation_ownership_histories_id_is_deleted" ON "collabdocs_organisation_ownership_histories" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_profiles_id_is_deleted" ON "collabdocs_profiles" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_email_outbox_id_is_deleted" ON "collabdocs_email_outbox" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_role_permission_templates" ADD CONSTRAINT "fk_collabdocs_role_permission_templates_permission_id_collabdoc" FOREIGN KEY ("permission_id") REFERENCES "collabdocs_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_role_permission_templates" ADD CONSTRAINT "fk_collabdocs_role_permission_templates_role_id_collabdocs_role" FOREIGN KEY ("role_id") REFERENCES "collabdocs_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_password_reset_tokens" ADD CONSTRAINT "fk_collabdocs_password_reset_tokens_user_id_collabdocs_users" FOREIGN KEY ("user_id") REFERENCES "collabdocs_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_invitation_permissions" ADD CONSTRAINT "fk_collabdocs_invitation_permissions_permission_id_collabdocs_p" FOREIGN KEY ("permission_id") REFERENCES "collabdocs_permissions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_invitation_permissions" ADD CONSTRAINT "fk_collabdocs_invitation_permissions_invitation_id_collabdocs_o" FOREIGN KEY ("invitation_id") REFERENCES "collabdocs_organisation_membership_invitations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" ADD CONSTRAINT "fk_collabdocs_organisation_memberships_organisation_id_collabdo" FOREIGN KEY ("organisation_id") REFERENCES "collabdocs_organisations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" ADD CONSTRAINT "fk_collabdocs_organisation_memberships_role_id_collabdocs_roles" FOREIGN KEY ("role_id") REFERENCES "collabdocs_roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" ADD CONSTRAINT "fk_collabdocs_organisation_memberships_user_id_collabdocs_users" FOREIGN KEY ("user_id") REFERENCES "collabdocs_users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_membership_permissions" ADD CONSTRAINT "fk_collabdocs_membership_permissions_permission_id_collabdocs_p" FOREIGN KEY ("permission_id") REFERENCES "collabdocs_permissions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_membership_permissions" ADD CONSTRAINT "fk_collabdocs_membership_permissions_membership_id_collabdocs_o" FOREIGN KEY ("membership_id") REFERENCES "collabdocs_organisation_memberships"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_suspension_histories" ADD CONSTRAINT "fk_collabdocs_organisation_membership_suspension_histories_orga" FOREIGN KEY ("organisation_membership_id") REFERENCES "collabdocs_organisation_memberships"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_users" ADD CONSTRAINT "fk_collabdocs_users_profile_id_collabdocs_profiles" FOREIGN KEY ("profile_id") REFERENCES "collabdocs_profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_user_sessions" ADD CONSTRAINT "fk_collabdocs_user_sessions_organisation_id_collabdocs_organisa" FOREIGN KEY ("organisation_id") REFERENCES "collabdocs_organisations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_user_sessions" ADD CONSTRAINT "fk_collabdocs_user_sessions_user_id_collabdocs_users" FOREIGN KEY ("user_id") REFERENCES "collabdocs_users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_user_session_tokens" ADD CONSTRAINT "fk_collabdocs_user_session_tokens_session_id_collabdocs_user_se" FOREIGN KEY ("session_id") REFERENCES "collabdocs_user_sessions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_api_keys" ADD CONSTRAINT "fk_collabdocs_api_keys_organisation_id_collabdocs_organisations" FOREIGN KEY ("organisation_id") REFERENCES "collabdocs_organisations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_api_keys" ADD CONSTRAINT "fk_collabdocs_api_keys_user_id_collabdocs_users" FOREIGN KEY ("user_id") REFERENCES "collabdocs_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisations" ADD CONSTRAINT "fk_collabdocs_organisations_creator_id_collabdocs_users" FOREIGN KEY ("creator_id") REFERENCES "collabdocs_users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisations" ADD CONSTRAINT "fk_collabdocs_organisations_owner_id_collabdocs_users" FOREIGN KEY ("owner_id") REFERENCES "collabdocs_users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" ADD CONSTRAINT "fk_collabdocs_organisation_membership_invitations_invited_by_id" FOREIGN KEY ("invited_by_id") REFERENCES "collabdocs_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" ADD CONSTRAINT "fk_collabdocs_organisation_membership_invitations_role_id_colla" FOREIGN KEY ("role_id") REFERENCES "collabdocs_roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" ADD CONSTRAINT "fk_collabdocs_organisation_membership_invitations_organisation_" FOREIGN KEY ("organisation_id") REFERENCES "collabdocs_organisations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_ownership_histories" ADD CONSTRAINT "fk_collabdocs_organisation_ownership_histories_new_owner_id_col" FOREIGN KEY ("new_owner_id") REFERENCES "collabdocs_users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_ownership_histories" ADD CONSTRAINT "fk_collabdocs_organisation_ownership_histories_previous_owner_i" FOREIGN KEY ("previous_owner_id") REFERENCES "collabdocs_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_ownership_histories" ADD CONSTRAINT "fk_collabdocs_organisation_ownership_histories_organisation_id_" FOREIGN KEY ("organisation_id") REFERENCES "collabdocs_organisations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
