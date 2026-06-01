import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateWarehouseEntriesTable1780340545580 implements MigrationInterface {
    name = 'CreateWarehouseEntriesTable1780340545580'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: "warehouse_entries",
            columns: [
                { name: "id", type: "uuid", isPrimary: true, default: "uuid_generate_v4()" },
                { name: "sn", type: "varchar", isUnique: true },
                { name: "direction", type: "enum", enum: ["inbound", "outbound"] },
                { name: "clients", type: "varchar" },
                { name: "awb", type: "varchar" },
                { name: "weight", type: "decimal", precision: 10, scale: 2, isNullable: true },
                { name: "pkgs", type: "integer", isNullable: true },
                { name: "description", type: "text", isNullable: true },
                { name: "date_in", type: "date" },
                { name: "date_out", type: "date", isNullable: true },
                { name: "remarks", type: "text", isNullable: true },
                { name: "created_by_id", type: "uuid" },
                { name: "is_deleted", type: "boolean", default: false },
                { name: "created_at", type: "timestamptz", default: "now()" },
                { name: "updated_at", type: "timestamptz", default: "now()" },
                { name: "deleted_at", type: "timestamptz", isNullable: true },
            ],
            foreignKeys: [
                {
                    columnNames: ["created_by_id"],
                    referencedTableName: "users",
                    referencedColumnNames: ["id"],
                    onDelete: "SET NULL",
                },
            ],
        }));

        await queryRunner.query(`CREATE INDEX "IDX_warehouse_entries_sn" ON "warehouse_entries" ("sn")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("warehouse_entries");
    }
}
