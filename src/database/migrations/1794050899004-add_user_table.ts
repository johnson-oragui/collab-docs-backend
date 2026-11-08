import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserTable1794050899004 implements MigrationInterface {
    name = 'AddUserTable1794050899004'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "collabdocs_users" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "email" character varying NOT NULL, "first_name" character varying, "password" character varying, "last_name" character varying, "is_active" boolean NOT NULL DEFAULT true, "accept_terms" boolean NOT NULL DEFAULT true, CONSTRAINT "uq_collabdocs_users_email" UNIQUE ("email"), CONSTRAINT "pk_collabdocs_users_id" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "collabdocs_users"`);
    }

}
