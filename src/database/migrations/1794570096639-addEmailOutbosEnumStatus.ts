import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailOutbosEnumStatus1794570096639 implements MigrationInterface {
  name = 'AddEmailOutbosEnumStatus1794570096639';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_collabdocs_email_outbox_status_available_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_email_outbox" DROP COLUMN "status"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."collabdocs_email_outbox_status_enum" AS ENUM('PENDING', 'QUEUED', 'SENT', 'FAILED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_email_outbox" ADD "status" "public"."collabdocs_email_outbox_status_enum" NOT NULL DEFAULT 'PENDING'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collabdocs_email_outbox_status_available_at" ON "collabdocs_email_outbox"  ("status", "available_at") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."idx_collabdocs_email_outbox_status_available_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_email_outbox" DROP COLUMN "status"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."collabdocs_email_outbox_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_email_outbox" ADD "status" character varying(20) NOT NULL DEFAULT 'PENDING'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_collabdocs_email_outbox_status_available_at" ON "collabdocs_email_outbox" USING btree ("available_at", "status") `,
    );
  }
}
