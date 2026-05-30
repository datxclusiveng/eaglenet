import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateCashbookEntries1779970000000 implements MigrationInterface {
    name = 'CreateCashbookEntries1779970000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable("cashbook_entries");
        if (tableExists) return;

        await queryRunner.createTable(
            new Table({
                name: "cashbook_entries",
                columns: [
                    {
                        name: "id",
                        type: "uuid",
                        isPrimary: true,
                        generationStrategy: "uuid",
                        default: "uuid_generate_v4()",
                    },
                    {
                        name: "reference_number",
                        type: "varchar",
                        isUnique: true,
                    },
                    {
                        name: "date",
                        type: "date",
                    },
                    {
                        name: "nature_of_transaction",
                        type: "enum",
                        enum: ["cash", "bank"],
                    },
                    {
                        name: "entry_type",
                        type: "enum",
                        enum: ["debit", "credit"],
                    },
                    {
                        name: "amount",
                        type: "decimal",
                        precision: 12,
                        scale: 2,
                    },
                    {
                        name: "bank_name",
                        type: "varchar",
                        isNullable: true,
                    },
                    {
                        name: "bank_account_id",
                        type: "uuid",
                        isNullable: true,
                    },
                    {
                        name: "description",
                        type: "text",
                        isNullable: true,
                    },
                    {
                        name: "voucher_id",
                        type: "uuid",
                        isNullable: true,
                    },
                    {
                        name: "created_by_id",
                        type: "uuid",
                    },
                    {
                        name: "is_deleted",
                        type: "boolean",
                        default: false,
                    },
                    {
                        name: "created_at",
                        type: "timestamp",
                        default: "now()",
                    },
                    {
                        name: "updated_at",
                        type: "timestamp",
                        default: "now()",
                    },
                    {
                        name: "deleted_at",
                        type: "timestamp",
                        isNullable: true,
                    },
                ],
                foreignKeys: [
                    {
                        columnNames: ["bank_account_id"],
                        referencedTableName: "bank_accounts",
                        referencedColumnNames: ["id"],
                        onDelete: "SET NULL",
                    },
                    {
                        columnNames: ["voucher_id"],
                        referencedTableName: "finance_vouchers",
                        referencedColumnNames: ["id"],
                        onDelete: "SET NULL",
                    },
                    {
                        columnNames: ["created_by_id"],
                        referencedTableName: "users",
                        referencedColumnNames: ["id"],
                        onDelete: "SET NULL",
                    },
                ],
                indices: [
                    { columnNames: ["reference_number"] },
                    { columnNames: ["date"] },
                    { columnNames: ["nature_of_transaction"] },
                    { columnNames: ["created_by_id"] },
                ],
            }),
            true
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("cashbook_entries", true);
    }
}
