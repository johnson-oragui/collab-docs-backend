import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserSessions1794164982089 implements MigrationInterface {
  name = 'CreateUserSessions1794164982089';

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
      `ALTER TABLE "collabdocs_organisation_membership_suspension_histories" DROP CONSTRAINT "fk_collabdocs_organisation_membership_suspension_histories_orga"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" DROP CONSTRAINT "fk_collabdocs_organisation_membership_invitations_organisation_"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" DROP CONSTRAINT "fk_collabdocs_organisation_memberships_organisation_id_collabdo"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_role_permissions" DROP CONSTRAINT "fk_collabdocs_role_permissions_permission_id_collabdocs_permiss"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_organisation_membership_suspension_histories_id_"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_organisation_membership_invitations_id_is_delete"`,
    );

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'collabdocs_user_session_token_status_enum'
          AND n.nspname = 'public'
        ) THEN
          CREATE TYPE "public"."collabdocs_user_session_token_status_enum"
          AS ENUM ('USED', 'REVOKED', 'ACTIVE');
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `CREATE TABLE "collabdocs_user_session_tokens" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "is_deleted" boolean NOT NULL DEFAULT false, "token_hash" character varying(255) NOT NULL, "status" "public"."collabdocs_user_session_token_status_enum" NOT NULL DEFAULT 'ACTIVE', "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "replaced_by_token_id" uuid, "session_id" uuid NOT NULL, CONSTRAINT "pk_collabdocs_user_session_tokens_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_user_session_tokens_id_is_deleted" ON "collabdocs_user_session_tokens" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_session_tokens_session_status" ON "collabdocs_user_session_tokens"  ("session_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_session_tokens_session_id" ON "collabdocs_user_session_tokens"  ("session_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_user_session_tokens_token_hash" ON "collabdocs_user_session_tokens"  ("token_hash") `,
    );
    await queryRunner.query(
      `CREATE TABLE "collabdocs_user_sessions" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "is_deleted" boolean NOT NULL DEFAULT false, "device_name" character varying(255), "user_agent" text, "ip_address" character varying(45), "last_used_at" TIMESTAMP WITH TIME ZONE, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "revoke_reason" character varying(100), "user_id" uuid NOT NULL, CONSTRAINT "pk_collabdocs_user_sessions_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_user_sessions_id_is_deleted" ON "collabdocs_user_sessions" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_sessions_user_active" ON "collabdocs_user_sessions"  ("user_id", "revoked_at", "expires_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_sessions_user_id" ON "collabdocs_user_sessions"  ("user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisations" ADD "creator_id" uuid NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisations" ADD CONSTRAINT "uq_collabdocs_organisations_creator_id" UNIQUE ("creator_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_organisation_membership_suspension_histories_id_is_deleted" ON "collabdocs_organisation_membership_suspension_histories" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_organisation_membership_invitations_id_is_deleted" ON "collabdocs_organisation_membership_invitations" USING btree ("id", "is_deleted") `,
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
      `ALTER TABLE "collabdocs_organisations" ADD CONSTRAINT "fk_collabdocs_organisations_creator_id_collabdocs_users" FOREIGN KEY ("creator_id") REFERENCES "collabdocs_users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_suspension_histories" ADD CONSTRAINT "fk_collabdocs_organisation_membership_suspension_histories_organisation_membership_id_collabdocs_organisation_memberships" FOREIGN KEY ("organisation_membership_id") REFERENCES "collabdocs_organisation_memberships"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" ADD CONSTRAINT "fk_collabdocs_organisation_membership_invitations_organisation_membership_id_collabdocs_organisation_memberships" FOREIGN KEY ("organisation_membership_id") REFERENCES "collabdocs_organisation_memberships"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" ADD CONSTRAINT "fk_collabdocs_organisation_memberships_organisation_id_collabdocs_organisations" FOREIGN KEY ("organisation_id") REFERENCES "collabdocs_organisations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_user_session_tokens" ADD CONSTRAINT "fk_collabdocs_user_session_tokens_session_id_collabdocs_user_sessions" FOREIGN KEY ("session_id") REFERENCES "collabdocs_user_sessions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_user_sessions" ADD CONSTRAINT "fk_collabdocs_user_sessions_user_id_collabdocs_users" FOREIGN KEY ("user_id") REFERENCES "collabdocs_users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_role_permissions" ADD CONSTRAINT "fk_collabdocs_role_permissions_permission_id_collabdocs_permissions" FOREIGN KEY ("permission_id") REFERENCES "collabdocs_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(`
        CREATE UNIQUE INDEX uq_user_session_tokens_one_active
        ON collabdocs_user_session_tokens (session_id)
        WHERE status = 'ACTIVE' AND is_deleted = false;    
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE "collabdocs_user_session_tokens" DROP CONSTRAINT
        "uq_user_session_tokens_one_active" ;    
    `);
    await queryRunner.query(
      `ALTER TABLE "collabdocs_role_permissions" DROP CONSTRAINT "fk_collabdocs_role_permissions_permission_id_collabdocs_permissions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_user_sessions" DROP CONSTRAINT "fk_collabdocs_user_sessions_user_id_collabdocs_users"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_user_session_tokens" DROP CONSTRAINT "fk_collabdocs_user_session_tokens_session_id_collabdocs_user_sessions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" DROP CONSTRAINT "fk_collabdocs_organisation_memberships_organisation_id_collabdocs_organisations"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" DROP CONSTRAINT "fk_collabdocs_organisation_membership_invitations_organisation_membership_id_collabdocs_organisation_memberships"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_suspension_histories" DROP CONSTRAINT "fk_collabdocs_organisation_membership_suspension_histories_organisation_membership_id_collabdocs_organisation_memberships"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisations" DROP CONSTRAINT "fk_collabdocs_organisations_creator_id_collabdocs_users"`,
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
      `DROP INDEX "public"."idx_collabdocs_organisation_membership_invitations_id_is_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_organisation_membership_suspension_histories_id_is_deleted"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisations" DROP CONSTRAINT "uq_collabdocs_organisations_creator_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisations" DROP COLUMN "creator_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_user_sessions_user_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_user_sessions_user_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_user_sessions_id_is_deleted"`,
    );
    await queryRunner.query(`DROP TABLE "collabdocs_user_sessions"`);
    await queryRunner.query(
      `DROP INDEX "public"."uq_user_session_tokens_token_hash"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_user_session_tokens_session_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_user_session_tokens_session_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_user_session_tokens_id_is_deleted"`,
    );
    await queryRunner.query(`DROP TABLE "collabdocs_user_session_tokens"`);
    await queryRunner.query(
      `DROP TYPE "public"."collabdocs_user_session_token_status_enum"`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_organisation_membership_invitations_id_is_delete" ON "collabdocs_organisation_membership_invitations" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_organisation_membership_suspension_histories_id_" ON "collabdocs_organisation_membership_suspension_histories" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_role_permissions" ADD CONSTRAINT "fk_collabdocs_role_permissions_permission_id_collabdocs_permiss" FOREIGN KEY ("permission_id") REFERENCES "collabdocs_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" ADD CONSTRAINT "fk_collabdocs_organisation_memberships_organisation_id_collabdo" FOREIGN KEY ("organisation_id") REFERENCES "collabdocs_organisations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" ADD CONSTRAINT "fk_collabdocs_organisation_membership_invitations_organisation_" FOREIGN KEY ("organisation_membership_id") REFERENCES "collabdocs_organisation_memberships"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_suspension_histories" ADD CONSTRAINT "fk_collabdocs_organisation_membership_suspension_histories_orga" FOREIGN KEY ("organisation_membership_id") REFERENCES "collabdocs_organisation_memberships"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
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
