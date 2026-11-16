import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPurposeToPasswordResetTokens1794756165674 implements MigrationInterface {
  name = 'AddPurposeToPasswordResetTokens1794756165674';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."idx_password_reset_tokens_user_status"`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'collabdocs_password_reset_tokens_purpose_enum'
          AND n.nspname = 'public'
        ) THEN
          CREATE TYPE "public"."collabdocs_password_reset_tokens_purpose_enum"
          AS ENUM ('PASSWORD_RESET', 'EMAIL_VERIFICATION');
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `ALTER TABLE "collabdocs_password_reset_tokens" ADD "purpose" "public"."collabdocs_password_reset_tokens_purpose_enum" NOT NULL DEFAULT 'PASSWORD_RESET'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_password_reset_tokens_user_status" ON "collabdocs_password_reset_tokens"  ("user_id", "purpose", "used_at", "revoked_at") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."idx_password_reset_tokens_user_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_password_reset_tokens" DROP COLUMN "purpose"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."collabdocs_password_reset_tokens_purpose_enum"`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_password_reset_tokens_user_status" ON "collabdocs_password_reset_tokens" USING btree ("revoked_at", "used_at", "user_id") `,
    );
  }
}
