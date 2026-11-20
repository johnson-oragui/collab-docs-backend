import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrgSubAdminToRoleEnum1794902628195 implements MigrationInterface {
  name = 'AddOrgSubAdminToRoleEnum1794902628195';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."collabdocs_roles_name_enum" ADD VALUE IF NOT EXISTS 'ORG_SUB_ADMIN'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."collabdocs_roles_name_enum_old" AS ENUM('APP_SUPER_ADMIN', 'ORG_ADMIN', 'ORG_MEMBER')`,
    );
  }
}
