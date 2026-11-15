import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmailOutbox1794569540281 implements MigrationInterface {
  name = 'CreateEmailOutbox1794569540281';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'collabdocs_email_outbox_event_type_enum'
          AND n.nspname = 'public'
        ) THEN
          CREATE TYPE "public"."collabdocs_email_outbox_event_type_enum"
          AS ENUM ('PASSWORD_RESET', 'EMAIL_VERIFICATION');
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `CREATE TABLE "collabdocs_email_outbox" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "is_deleted" boolean NOT NULL DEFAULT false, "event_type" "public"."collabdocs_email_outbox_event_type_enum" NOT NULL, "encrypted_payload" text NOT NULL, "encryption_iv" character varying(32) NOT NULL, "encryption_auth_tag" character varying(32) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'PENDING', "attempts" integer NOT NULL DEFAULT '0', "available_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "sent_at" TIMESTAMP WITH TIME ZONE, "last_error" text, CONSTRAINT "pk_collabdocs_email_outbox_id" PRIMARY KEY ("id")); COMMENT ON COLUMN "collabdocs_email_outbox"."event_type" IS 'Identifies the type of email being delivered.'; COMMENT ON COLUMN "collabdocs_email_outbox"."encrypted_payload" IS 'contains the recipient, subject, email content and any sensitive values such as reset/verification tokens.'; COMMENT ON COLUMN "collabdocs_email_outbox"."encryption_iv" IS 'AES-256-GCM initialization vector.'; COMMENT ON COLUMN "collabdocs_email_outbox"."encryption_auth_tag" IS ' AES-256-GCM authentication tag.'; COMMENT ON COLUMN "collabdocs_email_outbox"."attempts" IS 'Number of times delivery has been attempted.'; COMMENT ON COLUMN "collabdocs_email_outbox"."available_at" IS 'Earliest time this record can be dispatched.'; COMMENT ON COLUMN "collabdocs_email_outbox"."last_error" IS 'Last delivery error, with sensitive values excluded.'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_email_outbox_id_is_deleted" ON "collabdocs_email_outbox" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_collabdocs_email_outbox_status_available_at" ON "collabdocs_email_outbox"  ("status", "available_at") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_collabdocs_email_outbox_status_available_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_email_outbox_id_is_deleted"`,
    );
    await queryRunner.query(`DROP TABLE "collabdocs_email_outbox"`);
    await queryRunner.query(
      `DROP TYPE "public"."collabdocs_email_outbox_event_type_enum"`,
    );
  }
}
