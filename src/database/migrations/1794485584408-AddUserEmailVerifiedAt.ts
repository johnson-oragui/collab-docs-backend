import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserEmailVerifiedAt1794485584408 implements MigrationInterface {
  name = 'AddUserEmailVerifiedAt1794485584408';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "collabdocs_users" ADD "email_verified_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "collabdocs_users" DROP COLUMN "email_verified_at"`,
    );
  }
}
