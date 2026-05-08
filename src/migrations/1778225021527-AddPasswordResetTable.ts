import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPasswordResetTable1778225021527 implements MigrationInterface {
    name = 'AddPasswordResetTable1778225021527'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "password_resets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "code" character varying NOT NULL, "expires_at" TIMESTAMP NOT NULL, "is_used" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4816377aa98211c1de34469e742" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7e57f540b334d522f9cf5b16ca" ON "password_resets" ("email") `);
        await queryRunner.query(`ALTER TABLE "password_resets" ADD CONSTRAINT "FK_7e57f540b334d522f9cf5b16ca5" FOREIGN KEY ("email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "password_resets" DROP CONSTRAINT "FK_7e57f540b334d522f9cf5b16ca5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7e57f540b334d522f9cf5b16ca"`);
        await queryRunner.query(`DROP TABLE "password_resets"`);
    }

}
