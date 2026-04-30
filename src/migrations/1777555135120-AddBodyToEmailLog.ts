import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBodyToEmailLog1777555135120 implements MigrationInterface {
    name = 'AddBodyToEmailLog1777555135120'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "email_logs" ADD "body" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "email_logs" DROP COLUMN "body"`);
    }

}
