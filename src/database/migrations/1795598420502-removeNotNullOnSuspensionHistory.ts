import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveNotNullOnSuspensionHistory1795598420502 implements MigrationInterface {
  name = 'RemoveNotNullOnSuspensionHistory1795598420502';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_suspension_histories" DROP CONSTRAINT "fk_organisation_membership_suspension_histories_organisation_me"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_suspension_histories" ADD CONSTRAINT "fk_organisation_membership_suspension_histories_organisation_membership_id_collabdocs_organisation_memberships" FOREIGN KEY ("organisation_membership_id") REFERENCES "collabdocs_organisation_memberships"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_suspension_histories" DROP CONSTRAINT "fk_organisation_membership_suspension_histories_organisation_membership_id_collabdocs_organisation_memberships"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_suspension_histories" ADD CONSTRAINT "fk_organisation_membership_suspension_histories_organisation_me" FOREIGN KEY ("organisation_membership_id") REFERENCES "collabdocs_organisation_memberships"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }
}
