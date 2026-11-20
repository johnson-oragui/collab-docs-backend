import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserSentInvitations1794932285462 implements MigrationInterface {
  name = 'AddUserSentInvitations1794932285462';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" ADD "invited_by_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" ADD CONSTRAINT "fk_collabdocs_organisation_membership_invitations_invited_by_id_collabdocs_users" FOREIGN KEY ("invited_by_id") REFERENCES "collabdocs_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" DROP CONSTRAINT "fk_collabdocs_organisation_membership_invitations_invited_by_id_collabdocs_users"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collabdocs_organisation_membership_invitations" DROP COLUMN "invited_by_id"`,
    );
  }
}
