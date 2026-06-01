import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAttachmentColumnsToEmailLog1780316336777 implements MigrationInterface {
    name = 'AddAttachmentColumnsToEmailLog1780316336777'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "email_logs" ADD "attachment_count" integer`);
        await queryRunner.query(`ALTER TABLE "email_logs" ADD "attachment_urls" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "email_logs" DROP COLUMN "attachment_urls"`);
        await queryRunner.query(`ALTER TABLE "email_logs" DROP COLUMN "attachment_count"`);
    }

}
