import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateFinanceVouchers1779961083636 implements MigrationInterface {
    name = 'CreateFinanceVouchers1779961083636'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bank_accounts" DROP CONSTRAINT "FK_bank_accounts_created_by"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_approved_by"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_verified_by"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_prepared_by"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_bank_account"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bank_accounts_account_type"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bank_accounts_currency"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_invoices_prepared_by_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_invoices_verified_by_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_invoices_approved_by_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_invoices_bank_account_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_invoices_invoice_format"`);
        await queryRunner.query(`CREATE TYPE "public"."finance_vouchers_voucher_type_enum" AS ENUM('REQUEST_FOR_CASH', 'PAYMENT_AUTHORITY', 'CASH_PAYMENT_VOUCHER')`);
        await queryRunner.query(`CREATE TYPE "public"."finance_vouchers_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`);
        await queryRunner.query(`CREATE TABLE "finance_vouchers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "voucher_number" character varying NOT NULL, "voucher_type" "public"."finance_vouchers_voucher_type_enum" NOT NULL, "date" date NOT NULL, "purpose" text, "amount" numeric(12,2) NOT NULL, "totalAmount" numeric(12,2), "status" "public"."finance_vouchers_status_enum" NOT NULL DEFAULT 'PENDING', "receipt_url" text, "staff_id" uuid, "staff_signature_url" text, "bank_transfer_date" date, "beneficiary_name" character varying, "particulars" jsonb DEFAULT '[]', "amount_in_words" character varying, "items_description" text, "items_count" integer, "received_by_id" uuid, "received_by_name" character varying, "received_by_signature_url" text, "issued_by_id" uuid, "issued_by_signature_url" text, "authorized_by_id" uuid, "authorized_at" TIMESTAMP, "authorized_signature_url" text, "rejection_reason" text, "created_by_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_9e8fdc6a19583235dabf5feedc0" UNIQUE ("voucher_number"), CONSTRAINT "PK_c5b0fdec7bccd7dcb617eaeb76d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9e8fdc6a19583235dabf5feedc" ON "finance_vouchers" ("voucher_number") `);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "file_number"`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD "file_number" character varying`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "your_ref"`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD "your_ref" character varying`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "awb_bl_number"`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD "awb_bl_number" character varying`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "invoice_format"`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD "invoice_format" character varying NOT NULL DEFAULT 'naira'`);
        await queryRunner.query(`CREATE INDEX "IDX_83c5d54cbeef45047b8070f326" ON "bank_accounts" ("account_type") `);
        await queryRunner.query(`CREATE INDEX "IDX_132312782095723061a48a47ae" ON "invoices" ("invoice_format") `);
        await queryRunner.query(`CREATE INDEX "IDX_c89d024eb70e2e3ef77c902430" ON "invoices" ("bank_account_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_69b61d300809f6899b8681d623" ON "invoices" ("prepared_by_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_6a359c4ba5e7c6eadf2feeddbd" ON "invoices" ("verified_by_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_9fe85211b14a3e4ac6073d7b95" ON "invoices" ("approved_by_id") `);
        await queryRunner.query(`ALTER TABLE "bank_accounts" ADD CONSTRAINT "FK_3390466650902b942a6947862ce" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "FK_c89d024eb70e2e3ef77c902430d" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "FK_69b61d300809f6899b8681d6233" FOREIGN KEY ("prepared_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "FK_6a359c4ba5e7c6eadf2feeddbd0" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "FK_9fe85211b14a3e4ac6073d7b958" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "finance_vouchers" ADD CONSTRAINT "FK_f492211fb99804e072561279443" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "finance_vouchers" ADD CONSTRAINT "FK_3276c74be86e04e24d6a458d4ea" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "finance_vouchers" ADD CONSTRAINT "FK_a40ac96fed61e9e97f9e6fab727" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "finance_vouchers" ADD CONSTRAINT "FK_c010904845a2cf54f6cf3c97a1b" FOREIGN KEY ("authorized_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "finance_vouchers" ADD CONSTRAINT "FK_6d0dd0a2615fd12282638211603" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "finance_vouchers" DROP CONSTRAINT "FK_6d0dd0a2615fd12282638211603"`);
        await queryRunner.query(`ALTER TABLE "finance_vouchers" DROP CONSTRAINT "FK_c010904845a2cf54f6cf3c97a1b"`);
        await queryRunner.query(`ALTER TABLE "finance_vouchers" DROP CONSTRAINT "FK_a40ac96fed61e9e97f9e6fab727"`);
        await queryRunner.query(`ALTER TABLE "finance_vouchers" DROP CONSTRAINT "FK_3276c74be86e04e24d6a458d4ea"`);
        await queryRunner.query(`ALTER TABLE "finance_vouchers" DROP CONSTRAINT "FK_f492211fb99804e072561279443"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_9fe85211b14a3e4ac6073d7b958"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_6a359c4ba5e7c6eadf2feeddbd0"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_69b61d300809f6899b8681d6233"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_c89d024eb70e2e3ef77c902430d"`);
        await queryRunner.query(`ALTER TABLE "bank_accounts" DROP CONSTRAINT "FK_3390466650902b942a6947862ce"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9fe85211b14a3e4ac6073d7b95"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6a359c4ba5e7c6eadf2feeddbd"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_69b61d300809f6899b8681d623"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c89d024eb70e2e3ef77c902430"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_132312782095723061a48a47ae"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_83c5d54cbeef45047b8070f326"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "invoice_format"`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD "invoice_format" character varying(10) NOT NULL DEFAULT 'naira'`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "awb_bl_number"`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD "awb_bl_number" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "your_ref"`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD "your_ref" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "file_number"`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD "file_number" character varying(50)`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9e8fdc6a19583235dabf5feedc"`);
        await queryRunner.query(`DROP TABLE "finance_vouchers"`);
        await queryRunner.query(`DROP TYPE "public"."finance_vouchers_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."finance_vouchers_voucher_type_enum"`);
        await queryRunner.query(`CREATE INDEX "IDX_invoices_invoice_format" ON "invoices" ("invoice_format") `);
        await queryRunner.query(`CREATE INDEX "IDX_invoices_bank_account_id" ON "invoices" ("bank_account_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_invoices_approved_by_id" ON "invoices" ("approved_by_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_invoices_verified_by_id" ON "invoices" ("verified_by_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_invoices_prepared_by_id" ON "invoices" ("prepared_by_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_bank_accounts_currency" ON "bank_accounts" ("currency") `);
        await queryRunner.query(`CREATE INDEX "IDX_bank_accounts_account_type" ON "bank_accounts" ("account_type") `);
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_bank_account" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_prepared_by" FOREIGN KEY ("prepared_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_verified_by" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_approved_by" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bank_accounts" ADD CONSTRAINT "FK_bank_accounts_created_by" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

}
