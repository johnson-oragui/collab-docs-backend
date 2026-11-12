import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordReset1794470330944 implements MigrationInterface {
  name = 'AddPasswordReset1794470330944';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "collabdocs_password_reset_tokens" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "is_deleted" boolean NOT NULL DEFAULT false, "token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "revoked_at" TIMESTAMP WITH TIME ZONE, "requested_from_ip" character varying(45), "user_id" uuid NOT NULL, CONSTRAINT "pk_collabdocs_password_reset_tokens_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_password_reset_tokens_id_is_deleted" ON "collabdocs_password_reset_tokens" USING btree ("id", "is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_password_reset_tokens_expires_at" ON "collabdocs_password_reset_tokens"  ("expires_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_password_reset_tokens_user_status" ON "collabdocs_password_reset_tokens"  ("user_id", "used_at", "revoked_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_password_reset_tokens_user_id" ON "collabdocs_password_reset_tokens"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_password_reset_tokens_token_hash" ON "collabdocs_password_reset_tokens"  ("token_hash") `,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_password_reset_tokens" ADD CONSTRAINT "fk_collabdocs_password_reset_tokens_user_id_collabdocs_users" FOREIGN KEY ("user_id") REFERENCES "collabdocs_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "collabdocs_password_reset_tokens" DROP CONSTRAINT "fk_collabdocs_password_reset_tokens_user_id_collabdocs_users"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_password_reset_tokens_token_hash"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_password_reset_tokens_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_password_reset_tokens_user_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_password_reset_tokens_expires_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_password_reset_tokens_id_is_deleted"`,
    );
    await queryRunner.query(`DROP TABLE "collabdocs_password_reset_tokens"`);
  }
}
