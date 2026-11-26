import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationModels1795687011904 implements MigrationInterface {
  name = 'AddNotificationModels1795687011904';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_type t
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE t.typname = 'collabdocs_notification_outbox_event_type_enum'
            AND n.nspname = 'public'
          ) THEN
            CREATE TYPE "public"."collabdocs_notification_outbox_event_type_enum"
            AS ENUM ('NOTIFICATION_PUBLISHED');
          END IF;
        END $$;
      `);

    await queryRunner.query(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_type t
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE t.typname = 'collabdocs_notification_outbox_status_enum'
            AND n.nspname = 'public'
          ) THEN
            CREATE TYPE "public"."collabdocs_notification_outbox_status_enum"
            AS ENUM ('PENDING', 'PROCESSING', 'DISPATCHED','FAILED');
          END IF;
        END $$;
      `);

    await queryRunner.query(
      `CREATE TABLE "collabdocs_notification_outbox" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "is_deleted" boolean NOT NULL DEFAULT false, "notification_id" uuid NOT NULL, "recipient_membership_id" uuid NOT NULL, "event_type" "public"."collabdocs_notification_outbox_event_type_enum" NOT NULL, "status" "public"."collabdocs_notification_outbox_status_enum" NOT NULL DEFAULT 'PENDING', "attempts" integer NOT NULL DEFAULT '0', "next_attempt_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(), "dispatched_at" TIMESTAMP WITH TIME ZONE, "last_error" text, CONSTRAINT "pk_notification_outbox_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notification_outbox_id_is_deleted" ON "collabdocs_notification_outbox" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_outbox_notification" ON "collabdocs_notification_outbox"  ("notification_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_outbox_dispatch" ON "collabdocs_notification_outbox"  ("status", "next_attempt_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "collabdocs_notification_recipients" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "is_deleted" boolean NOT NULL DEFAULT false, "notification_id" uuid NOT NULL, "membership_id" uuid NOT NULL, "read_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "uq_notification_recipient" UNIQUE ("notification_id", "membership_id"), CONSTRAINT "pk_notification_recipients_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notification_recipients_id_is_deleted" ON "collabdocs_notification_recipients" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_recipients_notification" ON "collabdocs_notification_recipients"  ("notification_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_recipients_membership_read" ON "collabdocs_notification_recipients"  ("membership_id", "read_at") `,
    );

    await queryRunner.query(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_type t
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE t.typname = 'collabdocs_notification_type_enum'
            AND n.nspname = 'public'
          ) THEN
            CREATE TYPE "public"."collabdocs_notification_type_enum"
            AS ENUM ('SYSTEM', 'ANNOUNCEMENT', 'REMINDER','ALERT');
          END IF;
        END $$;
      `);

    await queryRunner.query(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_type t
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE t.typname = 'collabdocs_notification_status_enum'
            AND n.nspname = 'public'
          ) THEN
            CREATE TYPE "public"."collabdocs_notification_status_enum"
            AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
          END IF;
        END $$;
      `);

    await queryRunner.query(
      `CREATE TABLE "collabdocs_notifications" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "is_deleted" boolean NOT NULL DEFAULT false, "organisation_id" uuid NOT NULL, "created_by_membership_id" uuid, "title" character varying(255) NOT NULL, "message" text NOT NULL, "type" "public"."collabdocs_notification_type_enum" NOT NULL DEFAULT 'ANNOUNCEMENT', "status" "public"."collabdocs_notification_status_enum" NOT NULL DEFAULT 'DRAFT', "draft_expires_at" TIMESTAMP WITH TIME ZONE, "published_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "pk_notifications_id" PRIMARY KEY ("id")); COMMENT ON COLUMN "collabdocs_notifications"."draft_expires_at" IS 'Only set while status = DRAFT. Cleared to NULL on publish. The cleanup job uses this column to find expired drafts.'; COMMENT ON COLUMN "collabdocs_notifications"."published_at" IS 'is nullable and only populated on publish'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_id_is_deleted" ON "collabdocs_notifications" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_published_at" ON "collabdocs_notifications"  ("published_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_draft_expiry" ON "collabdocs_notifications"  ("status", "draft_expires_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_org_status" ON "collabdocs_notifications"  ("organisation_id", "status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "collabdocs_notification_preferences" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "is_deleted" boolean NOT NULL DEFAULT false, "membership_id" uuid NOT NULL, "realtime_enabled" boolean NOT NULL DEFAULT true, "email_enabled" boolean NOT NULL DEFAULT false, "digest_frequency" character varying(32) NOT NULL DEFAULT 'NONE', CONSTRAINT "uq_notification_preference_membership" UNIQUE ("membership_id"), CONSTRAINT "REL_94fcf7c1b0784b08208bb59a28" UNIQUE ("membership_id"), CONSTRAINT "pk_notification_preferences_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notification_preferences_id_is_deleted" ON "collabdocs_notification_preferences" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_outbox_dispatch"`);
    await queryRunner.query(
      `CREATE INDEX "idx_outbox_dispatch" ON "collabdocs_notification_outbox"  ("status", "next_attempt_at") `,
    );

    await queryRunner.query(
      `ALTER TABLE "collabdocs_notification_outbox" ADD CONSTRAINT "fk_notification_outbox_notification_id_collabdocs_notifications" FOREIGN KEY ("notification_id") REFERENCES "collabdocs_notifications"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_notification_recipients" ADD CONSTRAINT "fk_notification_recipients_notification_id_collabdocs_notifications" FOREIGN KEY ("notification_id") REFERENCES "collabdocs_notifications"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_notification_recipients" ADD CONSTRAINT "fk_notification_recipients_membership_id_collabdocs_organisation_memberships" FOREIGN KEY ("membership_id") REFERENCES "collabdocs_organisation_memberships"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_notifications" ADD CONSTRAINT "fk_notifications_organisation_id_collabdocs_organisations" FOREIGN KEY ("organisation_id") REFERENCES "collabdocs_organisations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_notifications" ADD CONSTRAINT "fk_notifications_created_by_membership_id_collabdocs_organisation_memberships" FOREIGN KEY ("created_by_membership_id") REFERENCES "collabdocs_organisation_memberships"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_notification_preferences" ADD CONSTRAINT "fk_notification_preferences_membership_id_collabdocs_organisation_memberships" FOREIGN KEY ("membership_id") REFERENCES "collabdocs_organisation_memberships"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "collabdocs_notification_preferences" DROP CONSTRAINT "fk_notification_preferences_membership_id_collabdocs_organisation_memberships"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_notifications" DROP CONSTRAINT "fk_notifications_created_by_membership_id_collabdocs_organisation_memberships"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_notifications" DROP CONSTRAINT "fk_notifications_organisation_id_collabdocs_organisations"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_notification_recipients" DROP CONSTRAINT "fk_notification_recipients_membership_id_collabdocs_organisation_memberships"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_notification_recipients" DROP CONSTRAINT "fk_notification_recipients_notification_id_collabdocs_notifications"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_notification_outbox" DROP CONSTRAINT "fk_notification_outbox_notification_id_collabdocs_notifications"`,
    );

    await queryRunner.query(`DROP INDEX "public"."idx_outbox_dispatch"`);
    await queryRunner.query(
      `CREATE INDEX "idx_outbox_dispatch" ON "collabdocs_notification_outbox"  ("status", "next_attempt_at") `,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_notification_preferences_id_is_deleted"`,
    );
    await queryRunner.query(`DROP TABLE "collabdocs_notification_preferences"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_notifications_org_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_notifications_draft_expiry"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_notifications_published_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_notifications_id_is_deleted"`,
    );
    await queryRunner.query(`DROP TABLE "collabdocs_notifications"`);
    await queryRunner.query(
      `DROP TYPE "public"."collabdocs_notification_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."collabdocs_notification_type_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_recipients_membership_read"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_recipients_notification"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_notification_recipients_id_is_deleted"`,
    );
    await queryRunner.query(`DROP TABLE "collabdocs_notification_recipients"`);
    await queryRunner.query(`DROP INDEX "public"."idx_outbox_dispatch"`);
    await queryRunner.query(`DROP INDEX "public"."idx_outbox_notification"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_notification_outbox_id_is_deleted"`,
    );
    await queryRunner.query(`DROP TABLE "collabdocs_notification_outbox"`);
    await queryRunner.query(
      `DROP TYPE "public"."collabdocs_notification_outbox_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."collabdocs_notification_outbox_event_type_enum"`,
    );
  }
}
