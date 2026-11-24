import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailOutboxEnum1795517955055 implements MigrationInterface {
  name = 'AddEmailOutboxEnum1795517955055';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."collabdocs_email_outbox_event_type_enum" ADD VALUE 'INFO'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."collabdocs_password_reset_tokens_purpose_enum" ADD VALUE 'INFO'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."collabdocs_password_reset_tokens_purpose_enum_old" AS ENUM('PASSWORD_RESET', 'EMAIL_VERIFICATION', 'ORGANISATION_INVITATION')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."collabdocs_email_outbox_event_type_enum_old" AS ENUM('PASSWORD_RESET', 'EMAIL_VERIFICATION', 'ORGANISATION_INVITATION')`,
    );
  }
}
