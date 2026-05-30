import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterCashbookTransactionNatureEnum1779971000000 implements MigrationInterface {
    name = 'AlterCashbookTransactionNatureEnum1779971000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if the old enum type exists and has the old values
        const result = await queryRunner.query(`
            SELECT e.enumlabel
            FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            WHERE t.typname = 'cashbook_entries_nature_of_transaction_enum'
        `) as { enumlabel: string }[];

        const labels = result.map(r => r.enumlabel);

        // Only migrate if the old values are still present
        if (labels.includes('receipt') || labels.includes('payment') || labels.includes('other')) {
            // Rename old enum, create new one, alter column, drop old
            await queryRunner.query(`ALTER TYPE "cashbook_entries_nature_of_transaction_enum" RENAME TO "cashbook_entries_nature_of_transaction_enum_old"`);
            await queryRunner.query(`CREATE TYPE "cashbook_entries_nature_of_transaction_enum" AS ENUM ('cash', 'bank')`);
            await queryRunner.query(`ALTER TABLE "cashbook_entries" ALTER COLUMN "nature_of_transaction" DROP DEFAULT`);
            await queryRunner.query(`ALTER TABLE "cashbook_entries" ALTER COLUMN "nature_of_transaction" TYPE "cashbook_entries_nature_of_transaction_enum" USING 'cash'::text::"cashbook_entries_nature_of_transaction_enum"`);
            await queryRunner.query(`DROP TYPE "cashbook_entries_nature_of_transaction_enum_old"`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const result = await queryRunner.query(`
            SELECT e.enumlabel
            FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            WHERE t.typname = 'cashbook_entries_nature_of_transaction_enum'
        `) as { enumlabel: string }[];

        const labels = result.map(r => r.enumlabel);

        if (labels.includes('cash') || labels.includes('bank')) {
            await queryRunner.query(`ALTER TYPE "cashbook_entries_nature_of_transaction_enum" RENAME TO "cashbook_entries_nature_of_transaction_enum_old"`);
            await queryRunner.query(`CREATE TYPE "cashbook_entries_nature_of_transaction_enum" AS ENUM ('receipt', 'payment', 'transfer', 'deposit', 'withdrawal', 'bank_charge', 'other')`);
            await queryRunner.query(`ALTER TABLE "cashbook_entries" ALTER COLUMN "nature_of_transaction" DROP DEFAULT`);
            await queryRunner.query(`ALTER TABLE "cashbook_entries" ALTER COLUMN "nature_of_transaction" TYPE "cashbook_entries_nature_of_transaction_enum" USING 'other'::text::"cashbook_entries_nature_of_transaction_enum"`);
            await queryRunner.query(`DROP TYPE "cashbook_entries_nature_of_transaction_enum_old"`);
        }
    }
}
