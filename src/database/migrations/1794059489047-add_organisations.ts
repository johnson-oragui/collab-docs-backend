import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrganisations1794059489047 implements MigrationInterface {
  name = 'AddOrganisations1794059489047';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'collabdocs_roles_name_enum'
          AND n.nspname = 'public'
        ) THEN
          CREATE TYPE "public"."collabdocs_roles_name_enum"
          AS ENUM ('APP_SUPER_ADMIN', 'ORG_ADMIN', 'ORG_MEMBER');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'collabdocs_roles_scope_enum'
          AND n.nspname = 'public'
        ) THEN
          CREATE TYPE "public"."collabdocs_roles_scope_enum"
          AS ENUM ('APPLICATION', 'ORGANISATION');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'collabdocs_invitation_status_enum'
          AND n.nspname = 'public'
        ) THEN
          CREATE TYPE "public"."collabdocs_invitation_status_enum"
          AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'collabdocs_org_membership_status_enum'
          AND n.nspname = 'public'
        ) THEN
          CREATE TYPE "public"."collabdocs_org_membership_status_enum"
          AS ENUM ('ACTIVE', 'PENDING');
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `CREATE TABLE "collabdocs_profiles" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "is_deleted" boolean NOT NULL DEFAULT false, "bio" character varying, "avatar_url" character varying, CONSTRAINT "pk_collabdocs_profiles_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_profiles_id_is_deleted" ON "collabdocs_profiles" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE TABLE "collabdocs_organisations" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "is_deleted" boolean NOT NULL DEFAULT false, "name" character varying NOT NULL, "slug" character varying NOT NULL, "description" character varying, CONSTRAINT "uq_collabdocs_organisations_name" UNIQUE ("name"), CONSTRAINT "uq_collabdocs_organisations_slug" UNIQUE ("slug"), CONSTRAINT "pk_collabdocs_organisations_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_organisations_id_is_deleted" ON "collabdocs_organisations" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE TABLE "collabdocs_permissions" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "is_deleted" boolean NOT NULL DEFAULT false, "name" character varying NOT NULL, "description" character varying, CONSTRAINT "uq_collabdocs_permissions_name" UNIQUE ("name"), CONSTRAINT "pk_collabdocs_permissions_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_permissions_id_is_deleted" ON "collabdocs_permissions" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE TABLE "collabdocs_roles" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "is_deleted" boolean NOT NULL DEFAULT false, "name" "public"."collabdocs_roles_name_enum" NOT NULL, "scope" "public"."collabdocs_roles_scope_enum" NOT NULL DEFAULT 'ORGANISATION', "description" character varying, CONSTRAINT "uq_collabdocs_roles_name" UNIQUE ("name"), CONSTRAINT "pk_collabdocs_roles_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_roles_id_is_deleted" ON "collabdocs_roles" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE TABLE "collabdocs_organisation_membership_suspension_histories" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "is_deleted" boolean NOT NULL DEFAULT false, "suspended_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "suspended_till" TIMESTAMP WITH TIME ZONE NOT NULL, "reason" text, "organisation_membership_id" uuid, CONSTRAINT "pk_collabdocs_organisation_membership_suspension_histories_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_organisation_membership_suspension_histories_id_is_deleted" ON "collabdocs_organisation_membership_suspension_histories" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE TABLE "collabdocs_organisation_membership_invitations" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "is_deleted" boolean NOT NULL DEFAULT false, "token" character varying NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "status" "public"."collabdocs_invitation_status_enum" NOT NULL DEFAULT 'PENDING', "organisation_membership_id" uuid, CONSTRAINT "uq_collabdocs_organisation_membership_invitations_token" UNIQUE ("token"), CONSTRAINT "pk_collabdocs_organisation_membership_invitations_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_organisation_membership_invitations_id_is_deleted" ON "collabdocs_organisation_membership_invitations" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE TABLE "collabdocs_organisation_memberships" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "is_deleted" boolean NOT NULL DEFAULT false, "status" "public"."collabdocs_org_membership_status_enum" NOT NULL DEFAULT 'PENDING', "suspended_till" TIMESTAMP WITH TIME ZONE, "user_id" uuid, "organisation_id" uuid, "role_id" uuid NOT NULL, CONSTRAINT "pk_collabdocs_organisation_memberships_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_organisation_memberships_id_is_deleted" ON "collabdocs_organisation_memberships" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_collabdocs_organisation_memberships_user_id_organisation_id" ON "collabdocs_organisation_memberships"  ("user_id", "organisation_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "collabdocs_role_permissions" ("role_id" uuid NOT NULL, "permission_id" uuid NOT NULL, CONSTRAINT "pk_collabdocs_role_permissions_role_id_permission_id" PRIMARY KEY ("role_id", "permission_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_role_permissions_role_id" ON "collabdocs_role_permissions"  ("role_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_role_permissions_permission_id" ON "collabdocs_role_permissions"  ("permission_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_users" ADD "is_deleted" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_users" ADD "profile_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_users" ADD CONSTRAINT "uq_collabdocs_users_profile_id" UNIQUE ("profile_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_users_id_is_deleted" ON "collabdocs_users" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_users" ADD CONSTRAINT "fk_collabdocs_users_profile_id_collabdocs_profiles" FOREIGN KEY ("profile_id") REFERENCES "collabdocs_profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_suspension_histories" ADD CONSTRAINT "fk_collabdocs_organisation_membership_suspension_histories_organisation_membership_id_collabdocs_organisation_memberships" FOREIGN KEY ("organisation_membership_id") REFERENCES "collabdocs_organisation_memberships"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" ADD CONSTRAINT "fk_collabdocs_organisation_membership_invitations_organisation_membership_id_collabdocs_organisation_memberships" FOREIGN KEY ("organisation_membership_id") REFERENCES "collabdocs_organisation_memberships"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" ADD CONSTRAINT "fk_collabdocs_organisation_memberships_user_id_collabdocs_users" FOREIGN KEY ("user_id") REFERENCES "collabdocs_users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" ADD CONSTRAINT "fk_collabdocs_organisation_memberships_organisation_id_collabdocs_organisations" FOREIGN KEY ("organisation_id") REFERENCES "collabdocs_organisations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" ADD CONSTRAINT "fk_collabdocs_organisation_memberships_role_id_collabdocs_roles" FOREIGN KEY ("role_id") REFERENCES "collabdocs_roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_role_permissions" ADD CONSTRAINT "fk_collabdocs_role_permissions_role_id_collabdocs_roles" FOREIGN KEY ("role_id") REFERENCES "collabdocs_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
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
      `ALTER TABLE "collabdocs_role_permissions" DROP CONSTRAINT "fk_collabdocs_role_permissions_role_id_collabdocs_roles"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" DROP CONSTRAINT "fk_collabdocs_organisation_memberships_role_id_collabdocs_roles"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" DROP CONSTRAINT "fk_collabdocs_organisation_memberships_organisation_id_collabdocs_organisations"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_memberships" DROP CONSTRAINT "fk_collabdocs_organisation_memberships_user_id_collabdocs_users"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" DROP CONSTRAINT "fk_collabdocs_organisation_membership_invitations_organisation_membership_id_collabdocs_organisation_memberships"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_suspension_histories" DROP CONSTRAINT "fk_collabdocs_organisation_membership_suspension_histories_organisation_membership_id_collabdocs_organisation_memberships"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_users" DROP CONSTRAINT "fk_collabdocs_users_profile_id_collabdocs_profiles"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_users_id_is_deleted"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_users" DROP CONSTRAINT "uq_collabdocs_users_profile_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_users" DROP COLUMN "profile_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_users" DROP COLUMN "is_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_role_permissions_permission_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_role_permissions_role_id"`,
    );
    await queryRunner.query(`DROP TABLE "collabdocs_role_permissions"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_organisation_memberships_user_id_organisation_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_organisation_memberships_id_is_deleted"`,
    );
    await queryRunner.query(`DROP TABLE "collabdocs_organisation_memberships"`);
    await queryRunner.query(
      `DROP TYPE "public"."collabdocs_org_membership_status_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_organisation_membership_invitations_id_is_deleted"`,
    );
    await queryRunner.query(
      `DROP TABLE "collabdocs_organisation_membership_invitations"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."collabdocs_invitation_status_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_organisation_membership_suspension_histories_id_is_deleted"`,
    );
    await queryRunner.query(
      `DROP TABLE "collabdocs_organisation_membership_suspension_histories"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_roles_id_is_deleted"`,
    );
    await queryRunner.query(`DROP TABLE "collabdocs_roles"`);
    await queryRunner.query(`DROP TYPE "public"."collabdocs_roles_scope_enum"`);
    await queryRunner.query(`DROP TYPE "public"."collabdocs_roles_name_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_permissions_id_is_deleted"`,
    );
    await queryRunner.query(`DROP TABLE "collabdocs_permissions"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_organisations_id_is_deleted"`,
    );
    await queryRunner.query(`DROP TABLE "collabdocs_organisations"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_profiles_id_is_deleted"`,
    );
    await queryRunner.query(`DROP TABLE "collabdocs_profiles"`);
  }
}
