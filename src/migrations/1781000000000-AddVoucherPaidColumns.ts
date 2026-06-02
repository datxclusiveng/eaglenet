import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVoucherPaidColumns1781000000000 implements MigrationInterface {
    name = 'AddVoucherPaidColumns1781000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add PAID to the status enum
        await queryRunner.query(`ALTER TYPE "public"."finance_vouchers_status_enum" ADD VALUE 'PAID'`);

        // Add payment confirmation columns
        await queryRunner.query(`ALTER TABLE "finance_vouchers" ADD "paid_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "finance_vouchers" ADD "paid_by_id" uuid`);
        await queryRunner.query(`ALTER TABLE "finance_vouchers" ADD "paid_by_signature_url" text`);
        await queryRunner.query(`ALTER TABLE "finance_vouchers" ADD "payment_evidence_url" text`);
        await queryRunner.query(`ALTER TABLE "finance_vouchers" ADD "payment_method" character varying`);
        await queryRunner.query(`ALTER TABLE "finance_vouchers" ADD "payment_reference" character varying`);
        await queryRunner.query(`ALTER TABLE "finance_vouchers" ADD "payment_notes" text`);

        // Add foreign key constraint for paid_by_id → users
        await queryRunner.query(`ALTER TABLE "finance_vouchers" ADD CONSTRAINT "FK_finance_vouchers_paid_by" FOREIGN KEY ("paid_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop FK first
        await queryRunner.query(`ALTER TABLE "finance_vouchers" DROP CONSTRAINT "FK_finance_vouchers_paid_by"`);

        // Drop the columns
        await queryRunner.query(`ALTER TABLE "finance_vouchers" DROP COLUMN "payment_notes"`);
        await queryRunner.query(`ALTER TABLE "finance_vouchers" DROP COLUMN "payment_reference"`);
        await queryRunner.query(`ALTER TABLE "finance_vouchers" DROP COLUMN "payment_method"`);
        await queryRunner.query(`ALTER TABLE "finance_vouchers" DROP COLUMN "payment_evidence_url"`);
        await queryRunner.query(`ALTER TABLE "finance_vouchers" DROP COLUMN "paid_by_signature_url"`);
        await queryRunner.query(`ALTER TABLE "finance_vouchers" DROP COLUMN "paid_by_id"`);
        await queryRunner.query(`ALTER TABLE "finance_vouchers" DROP COLUMN "paid_at"`);

        // Note: PostgreSQL does not support removing a value from an enum type.
        // The PAID value remains in finance_vouchers_status_enum — this is harmless.
    }
}
