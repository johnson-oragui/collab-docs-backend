import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameRolePermissions1794928436258 implements MigrationInterface {
  name = 'RenameRolePermissions1794928436258';

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
      `ALTER TABLE "collabdocs_user_session_tokens" DROP CONSTRAINT "fk_collabdocs_user_session_tokens_session_id_collabdocs_user_se"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_user_sessions" DROP CONSTRAINT "fk_collabdocs_user_sessions_organisation_id_collabdocs_organisa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_suspension_histories" DROP CONSTRAINT "fk_collabdocs_organisation_membership_suspension_histories_orga"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" DROP CONSTRAINT "fk_collabdocs_organisation_memberships_organisation_id_collabdo"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_organisation_membership_invitations_id_is_delete"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_organisation_membership_suspension_histories_id_"`,
    );
    await queryRunner.query(
      `CREATE TABLE "collabdocs_membership_permissions" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "is_deleted" boolean NOT NULL DEFAULT false, "membership_id" uuid, "permission_id" uuid, CONSTRAINT "pk_collabdocs_membership_permissions_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_membership_permissions_id_is_deleted" ON "collabdocs_membership_permissions" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_collabdocs_membership_permissions_membership_id_permission_id" ON "collabdocs_membership_permissions"  ("membership_id", "permission_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "collabdocs_invitation_permissions" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "is_deleted" boolean NOT NULL DEFAULT false, "invitation_id" uuid, "permission_id" uuid, CONSTRAINT "pk_collabdocs_invitation_permissions_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_invitation_permissions_id_is_deleted" ON "collabdocs_invitation_permissions" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_collabdocs_invitation_permissions_invitation_id_permission_id" ON "collabdocs_invitation_permissions"  ("invitation_id", "permission_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "collabdocs_role_permission_templates" ("role_id" uuid NOT NULL, "permission_id" uuid NOT NULL, CONSTRAINT "pk_collabdocs_role_permission_templates_role_id_permission_id" PRIMARY KEY ("role_id", "permission_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_role_permission_templates_role_id" ON "collabdocs_role_permission_templates"  ("role_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_role_permission_templates_permission_id" ON "collabdocs_role_permission_templates"  ("permission_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" DROP COLUMN "organisation_membership_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" ADD "email" character varying(254) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" ADD "first_name" character varying(255) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" ADD "last_name" character varying(255) NOT NULL`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'collabdocs_permission_assignment_mode_enum'
          AND n.nspname = 'public'
        ) THEN
          CREATE TYPE "public"."collabdocs_permission_assignment_mode_enum"
          AS ENUM ('DEFAULT', 'CUSTOM', 'NONE');
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" ADD "permission_mode" "public"."collabdocs_permission_assignment_mode_enum" NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" ADD "organisation_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" ADD "role_id" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_organisation_membership_invitations_id_is_deleted" ON "collabdocs_organisation_membership_invitations" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_organisation_membership_invitations_email_organisation_id" ON "collabdocs_organisation_membership_invitations"  ("email", "organisation_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_organisation_membership_suspension_histories_id_is_deleted" ON "collabdocs_organisation_membership_suspension_histories" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_ownership_histories" ADD CONSTRAINT "fk_collabdocs_organisation_ownership_histories_organisation_id_collabdocs_organisations" FOREIGN KEY ("organisation_id") REFERENCES "collabdocs_organisations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_ownership_histories" ADD CONSTRAINT "fk_collabdocs_organisation_ownership_histories_previous_owner_id_collabdocs_users" FOREIGN KEY ("previous_owner_id") REFERENCES "collabdocs_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_ownership_histories" ADD CONSTRAINT "fk_collabdocs_organisation_ownership_histories_new_owner_id_collabdocs_users" FOREIGN KEY ("new_owner_id") REFERENCES "collabdocs_users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" ADD CONSTRAINT "fk_collabdocs_organisation_membership_invitations_organisation_id_collabdocs_organisations" FOREIGN KEY ("organisation_id") REFERENCES "collabdocs_organisations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" ADD CONSTRAINT "fk_collabdocs_organisation_membership_invitations_role_id_collabdocs_roles" FOREIGN KEY ("role_id") REFERENCES "collabdocs_roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_user_session_tokens" ADD CONSTRAINT "fk_collabdocs_user_session_tokens_session_id_collabdocs_user_sessions" FOREIGN KEY ("session_id") REFERENCES "collabdocs_user_sessions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_user_sessions" ADD CONSTRAINT "fk_collabdocs_user_sessions_organisation_id_collabdocs_organisations" FOREIGN KEY ("organisation_id") REFERENCES "collabdocs_organisations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_suspension_histories" ADD CONSTRAINT "fk_collabdocs_organisation_membership_suspension_histories_organisation_membership_id_collabdocs_organisation_memberships" FOREIGN KEY ("organisation_membership_id") REFERENCES "collabdocs_organisation_memberships"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_membership_permissions" ADD CONSTRAINT "fk_collabdocs_membership_permissions_membership_id_collabdocs_organisation_memberships" FOREIGN KEY ("membership_id") REFERENCES "collabdocs_organisation_memberships"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_membership_permissions" ADD CONSTRAINT "fk_collabdocs_membership_permissions_permission_id_collabdocs_permissions" FOREIGN KEY ("permission_id") REFERENCES "collabdocs_permissions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" ADD CONSTRAINT "fk_collabdocs_organisation_memberships_organisation_id_collabdocs_organisations" FOREIGN KEY ("organisation_id") REFERENCES "collabdocs_organisations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_invitation_permissions" ADD CONSTRAINT "fk_collabdocs_invitation_permissions_invitation_id_collabdocs_organisation_membership_invitations" FOREIGN KEY ("invitation_id") REFERENCES "collabdocs_organisation_membership_invitations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_invitation_permissions" ADD CONSTRAINT "fk_collabdocs_invitation_permissions_permission_id_collabdocs_permissions" FOREIGN KEY ("permission_id") REFERENCES "collabdocs_permissions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_role_permission_templates" ADD CONSTRAINT "fk_collabdocs_role_permission_templates_role_id_collabdocs_roles" FOREIGN KEY ("role_id") REFERENCES "collabdocs_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_role_permission_templates" ADD CONSTRAINT "fk_collabdocs_role_permission_templates_permission_id_collabdocs_permissions" FOREIGN KEY ("permission_id") REFERENCES "collabdocs_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "collabdocs_role_permission_templates" DROP CONSTRAINT "fk_collabdocs_role_permission_templates_permission_id_collabdocs_permissions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_role_permission_templates" DROP CONSTRAINT "fk_collabdocs_role_permission_templates_role_id_collabdocs_roles"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_invitation_permissions" DROP CONSTRAINT "fk_collabdocs_invitation_permissions_permission_id_collabdocs_permissions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_invitation_permissions" DROP CONSTRAINT "fk_collabdocs_invitation_permissions_invitation_id_collabdocs_organisation_membership_invitations"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" DROP CONSTRAINT "fk_collabdocs_organisation_memberships_organisation_id_collabdocs_organisations"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_membership_permissions" DROP CONSTRAINT "fk_collabdocs_membership_permissions_permission_id_collabdocs_permissions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_membership_permissions" DROP CONSTRAINT "fk_collabdocs_membership_permissions_membership_id_collabdocs_organisation_memberships"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_suspension_histories" DROP CONSTRAINT "fk_collabdocs_organisation_membership_suspension_histories_organisation_membership_id_collabdocs_organisation_memberships"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_user_sessions" DROP CONSTRAINT "fk_collabdocs_user_sessions_organisation_id_collabdocs_organisations"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_user_session_tokens" DROP CONSTRAINT "fk_collabdocs_user_session_tokens_session_id_collabdocs_user_sessions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" DROP CONSTRAINT "fk_collabdocs_organisation_membership_invitations_role_id_collabdocs_roles"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" DROP CONSTRAINT "fk_collabdocs_organisation_membership_invitations_organisation_id_collabdocs_organisations"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_ownership_histories" DROP CONSTRAINT "fk_collabdocs_organisation_ownership_histories_new_owner_id_collabdocs_users"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_ownership_histories" DROP CONSTRAINT "fk_collabdocs_organisation_ownership_histories_previous_owner_id_collabdocs_users"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_ownership_histories" DROP CONSTRAINT "fk_collabdocs_organisation_ownership_histories_organisation_id_collabdocs_organisations"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_organisation_membership_suspension_histories_id_is_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_organisation_membership_invitations_email_organisation_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_organisation_membership_invitations_id_is_deleted"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" DROP COLUMN "role_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" DROP COLUMN "organisation_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" DROP COLUMN "permission_mode"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."collabdocs_permission_assignment_mode_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" DROP COLUMN "last_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" DROP COLUMN "first_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" DROP COLUMN "email"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" ADD "organisation_membership_id" uuid`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_role_permission_templates_permission_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_role_permission_templates_role_id"`,
    );
    await queryRunner.query(
      `DROP TABLE "collabdocs_role_permission_templates"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_invitation_permissions_invitation_id_permission_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_invitation_permissions_id_is_deleted"`,
    );
    await queryRunner.query(`DROP TABLE "collabdocs_invitation_permissions"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_membership_permissions_membership_id_permission_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_membership_permissions_id_is_deleted"`,
    );
    await queryRunner.query(`DROP TABLE "collabdocs_membership_permissions"`);
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_organisation_membership_suspension_histories_id_" ON "collabdocs_organisation_membership_suspension_histories" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_organisation_membership_invitations_id_is_delete" ON "collabdocs_organisation_membership_invitations" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" ADD CONSTRAINT "fk_collabdocs_organisation_memberships_organisation_id_collabdo" FOREIGN KEY ("organisation_id") REFERENCES "collabdocs_organisations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_suspension_histories" ADD CONSTRAINT "fk_collabdocs_organisation_membership_suspension_histories_orga" FOREIGN KEY ("organisation_membership_id") REFERENCES "collabdocs_organisation_memberships"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_user_sessions" ADD CONSTRAINT "fk_collabdocs_user_sessions_organisation_id_collabdocs_organisa" FOREIGN KEY ("organisation_id") REFERENCES "collabdocs_organisations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_user_session_tokens" ADD CONSTRAINT "fk_collabdocs_user_session_tokens_session_id_collabdocs_user_se" FOREIGN KEY ("session_id") REFERENCES "collabdocs_user_sessions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" ADD CONSTRAINT "fk_collabdocs_organisation_membership_invitations_organisation_" FOREIGN KEY ("organisation_membership_id") REFERENCES "collabdocs_organisation_memberships"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
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
