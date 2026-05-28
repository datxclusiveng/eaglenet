import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserSignatureUrlColumn1779966060694 implements MigrationInterface {
    name = 'AddUserSignatureUrlColumn1779966060694'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "signature_url" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "signature_url"`);
    }

}
