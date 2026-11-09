import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrganisationEmail1794228663502 implements MigrationInterface {
  name = 'AddOrganisationEmail1794228663502';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisations" ADD "email" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisations" ADD CONSTRAINT "uq_collabdocs_organisations_email" UNIQUE ("email")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisations" DROP CONSTRAINT "uq_collabdocs_organisations_email"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisations" DROP COLUMN "email"`,
    );
  }
}
