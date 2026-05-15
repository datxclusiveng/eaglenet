import { MigrationInterface, QueryRunner } from "typeorm";

export class EnhanceInvoicesAndBankAccounts1779000000000 implements MigrationInterface {
    name = 'EnhanceInvoicesAndBankAccounts1779000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ─── bank_accounts table ──────────────────────────────────────────
        await queryRunner.query(`CREATE TYPE "public"."bank_accounts_account_type_enum" AS ENUM('local', 'foreign')`);
        await queryRunner.query(`
            CREATE TABLE "bank_accounts" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "account_name" character varying NOT NULL,
                "account_number" character varying NOT NULL,
                "bank_name" character varying NOT NULL,
                "bank_address" text,
                "sort_code" character varying,
                "swift_code" character varying,
                "intermediary_bank" character varying,
                "intermediary_swift" character varying,
                "tin" character varying,
                "additional_info" text,
                "currency" character varying NOT NULL DEFAULT 'NGN',
                "account_type" "public"."bank_accounts_account_type_enum" NOT NULL DEFAULT 'local',
                "is_active" boolean NOT NULL DEFAULT true,
                "is_default" boolean NOT NULL DEFAULT false,
                "created_by_id" uuid,
                "is_deleted" boolean NOT NULL DEFAULT false,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                CONSTRAINT "PK_bank_accounts" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_bank_accounts_account_type" ON "bank_accounts" ("account_type") `);
        await queryRunner.query(`CREATE INDEX "IDX_bank_accounts_currency" ON "bank_accounts" ("currency") `);
        await queryRunner.query(`ALTER TABLE "bank_accounts" ADD CONSTRAINT "FK_bank_accounts_created_by" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

        // ─── Extend invoices status enum ───────────────────────────────────
        // PG rename-old/create-new/update-column/drop-old pattern
        await queryRunner.query(`ALTER TYPE "public"."invoices_status_enum" RENAME TO "invoices_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."invoices_status_enum" AS ENUM('draft', 'pending_verification', 'pending_approval', 'approved', 'sent', 'paid', 'overdue', 'cancelled')`);
        await queryRunner.query(`ALTER TABLE "invoices" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "invoices" ALTER COLUMN "status" TYPE "public"."invoices_status_enum" USING status::text::"public"."invoices_status_enum"`);
        await queryRunner.query(`ALTER TABLE "invoices" ALTER COLUMN "status" SET DEFAULT 'draft'`);
        await queryRunner.query(`DROP TYPE "public"."invoices_status_enum_old"`);

        // ─── Add new columns to invoices ──────────────────────────────────
        await queryRunner.query(`ALTER TABLE "invoices" ADD "file_number" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD "your_ref" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD "awb_bl_number" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD "number_of_packages" integer`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD "gross_weight" numeric(10,2)`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD "chargeable_weight" numeric(10,2)`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD "cubit" numeric(10,2)`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD "job_description" text`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD "invoice_format" character varying(10) NOT NULL DEFAULT 'naira'`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD "bank_account_id" uuid`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD "bank_details" jsonb DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD "prepared_by_id" uuid`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD "verified_by_id" uuid`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD "approved_by_id" uuid`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD "prepared_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD "verified_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD "approved_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD "issued_at" TIMESTAMP`);

        // ─── Indexes ──────────────────────────────────────────────────────
        await queryRunner.query(`CREATE INDEX "IDX_invoices_prepared_by_id" ON "invoices" ("prepared_by_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_invoices_verified_by_id" ON "invoices" ("verified_by_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_invoices_approved_by_id" ON "invoices" ("approved_by_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_invoices_bank_account_id" ON "invoices" ("bank_account_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_invoices_invoice_format" ON "invoices" ("invoice_format") `);

        // ─── Foreign Keys ─────────────────────────────────────────────────
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_bank_account" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_prepared_by" FOREIGN KEY ("prepared_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_verified_by" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_approved_by" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // ─── Drop FKs ─────────────────────────────────────────────────────
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_approved_by"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_verified_by"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_prepared_by"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_bank_account"`);

        // ─── Drop indexes ─────────────────────────────────────────────────
        await queryRunner.query(`DROP INDEX "public"."IDX_invoices_invoice_format"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_invoices_bank_account_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_invoices_approved_by_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_invoices_verified_by_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_invoices_prepared_by_id"`);

        // ─── Drop new columns ─────────────────────────────────────────────
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "issued_at"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "approved_at"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "verified_at"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "prepared_at"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "approved_by_id"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "verified_by_id"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "prepared_by_id"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "bank_details"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "bank_account_id"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "invoice_format"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "job_description"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "cubit"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "chargeable_weight"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "gross_weight"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "number_of_packages"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "awb_bl_number"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "your_ref"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "file_number"`);

        // ─── Revert invoices status enum ──────────────────────────────────
        // First revert any rows using new statuses back to draft
        await queryRunner.query(`UPDATE "invoices" SET "status" = 'draft' WHERE "status" IN ('pending_verification', 'pending_approval', 'approved')`);
        await queryRunner.query(`ALTER TYPE "public"."invoices_status_enum" RENAME TO "invoices_status_enum_new"`);
        await queryRunner.query(`CREATE TYPE "public"."invoices_status_enum" AS ENUM('draft', 'sent', 'paid', 'overdue', 'cancelled')`);
        await queryRunner.query(`ALTER TABLE "invoices" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "invoices" ALTER COLUMN "status" TYPE "public"."invoices_status_enum" USING status::text::"public"."invoices_status_enum"`);
        await queryRunner.query(`ALTER TABLE "invoices" ALTER COLUMN "status" SET DEFAULT 'draft'`);
        await queryRunner.query(`DROP TYPE "public"."invoices_status_enum_new"`);

        // ─── Drop bank_accounts ───────────────────────────────────────────
        await queryRunner.query(`ALTER TABLE "bank_accounts" DROP CONSTRAINT "FK_bank_accounts_created_by"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bank_accounts_currency"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bank_accounts_account_type"`);
        await queryRunner.query(`DROP TABLE "bank_accounts"`);
        await queryRunner.query(`DROP TYPE "public"."bank_accounts_account_type_enum"`);
    }
}
