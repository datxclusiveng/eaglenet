import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReceiptAndMetadataToPayment1776863885762 implements MigrationInterface {
    name = 'AddReceiptAndMetadataToPayment1776863885762'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" ADD "receipt_url" text`);
        await queryRunner.query(`ALTER TABLE "payments" ADD "metadata" jsonb DEFAULT '{}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "metadata"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "receipt_url"`);
    }

}
