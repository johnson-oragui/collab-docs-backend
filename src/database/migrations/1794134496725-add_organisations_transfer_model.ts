import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrganisationsTransferModel1794134496725 implements MigrationInterface {
  name = 'AddOrganisationsTransferModel1794134496725';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
    await queryRunner.query(
      `CREATE TABLE "collabdocs_organisation_ownership_histories" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "is_deleted" boolean NOT NULL DEFAULT false, "request_id" uuid, "transferred_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "reason" text, "organisation_id" uuid, "previous_owner_id" uuid, "new_owner_id" uuid NOT NULL, CONSTRAINT "pk_collabdocs_organisation_ownership_histories_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_organisation_ownership_histories_id_is_deleted" ON "collabdocs_organisation_ownership_histories" USING btree ("id", "is_deleted") `,
    );

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'collabdocs_api_keys_status_enum'
          AND n.nspname = 'public'
        ) THEN
          CREATE TYPE "public"."collabdocs_api_keys_status_enum"
          AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `CREATE TABLE "collabdocs_api_keys" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "is_deleted" boolean NOT NULL DEFAULT false, "name" character varying NOT NULL, "key_hash" character varying NOT NULL, "prefix" character varying(10) NOT NULL, "request_id" uuid, "status" "public"."collabdocs_api_keys_status_enum" NOT NULL DEFAULT 'ACTIVE', "expires_at" TIMESTAMP WITH TIME ZONE, "last_used_at" TIMESTAMP WITH TIME ZONE, "allowed_ips" text, "user_id" uuid, "organisation_id" uuid, CONSTRAINT "uq_collabdocs_api_keys_key_hash" UNIQUE ("key_hash"), CONSTRAINT "pk_collabdocs_api_keys_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_api_keys_id_is_deleted" ON "collabdocs_api_keys" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_api_keys_prefix" ON "collabdocs_api_keys"  ("prefix") `,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_profiles" ADD "request_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisations" ADD "request_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisations" ADD "owner_id" uuid NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_permissions" ADD "request_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_roles" ADD "request_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_suspension_histories" ADD "request_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" ADD "request_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" ADD "request_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_users" ADD "request_id" uuid`,
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
      `ALTER TABLE "collabdocs_organisations" ADD CONSTRAINT "fk_collabdocs_organisations_owner_id_collabdocs_users" FOREIGN KEY ("owner_id") REFERENCES "collabdocs_users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
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
      `ALTER TABLE "collabdocs_api_keys" ADD CONSTRAINT "fk_collabdocs_api_keys_user_id_collabdocs_users" FOREIGN KEY ("user_id") REFERENCES "collabdocs_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_api_keys" ADD CONSTRAINT "fk_collabdocs_api_keys_organisation_id_collabdocs_organisations" FOREIGN KEY ("organisation_id") REFERENCES "collabdocs_organisations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_role_permissions" ADD CONSTRAINT "fk_collabdocs_role_permissions_permission_id_collabdocs_permissions" FOREIGN KEY ("permission_id") REFERENCES "collabdocs_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "collabdocs_role_permissions" DROP CONSTRAINT "fk_collabdocs_role_permissions_permission_id_collabdocs_permissions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_api_keys" DROP CONSTRAINT "fk_collabdocs_api_keys_organisation_id_collabdocs_organisations"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_api_keys" DROP CONSTRAINT "fk_collabdocs_api_keys_user_id_collabdocs_users"`,
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
      `ALTER TABLE "collabdocs_organisations" DROP CONSTRAINT "fk_collabdocs_organisations_owner_id_collabdocs_users"`,
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
      `ALTER TABLE "collabdocs_users" DROP COLUMN "request_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" DROP COLUMN "request_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" DROP COLUMN "request_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_suspension_histories" DROP COLUMN "request_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_roles" DROP COLUMN "request_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_permissions" DROP COLUMN "request_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisations" DROP COLUMN "owner_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisations" DROP COLUMN "request_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_profiles" DROP COLUMN "request_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_api_keys_prefix"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_api_keys_id_is_deleted"`,
    );
    await queryRunner.query(`DROP TABLE "collabdocs_api_keys"`);
    await queryRunner.query(
      `DROP TYPE "public"."collabdocs_api_keys_status_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_organisation_ownership_histories_id_is_deleted"`,
    );
    await queryRunner.query(
      `DROP TABLE "collabdocs_organisation_ownership_histories"`,
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
  }
}
