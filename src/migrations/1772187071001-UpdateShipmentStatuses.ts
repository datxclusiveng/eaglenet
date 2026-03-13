import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateShipmentStatuses1772187071001 implements MigrationInterface {
  name = "UpdateShipmentStatuses1772187071001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create a temporary enum with the new values
    await queryRunner.query(
      `CREATE TYPE "public"."shipments_status_enum_new" AS ENUM('ORDER_PLACED', 'PENDING_CONFIRMATION', 'WAITING_TO_BE_SHIPPED', 'SHIPPED', 'AVAILABLE_FOR_PICKUP', 'DELIVERED', 'CANCELLED')`
    );

    // 2. Alter the shipments table status column to use the new enum
    // We use a CASE statement to map old values to new ones during the conversion
    await queryRunner.query(`
      ALTER TABLE "shipments" 
      ALTER COLUMN "status" DROP DEFAULT,
      ALTER COLUMN "status" TYPE "public"."shipments_status_enum_new" 
      USING (
        CASE "status"::text
          WHEN 'PENDING' THEN 'ORDER_PLACED'::"public"."shipments_status_enum_new"
          WHEN 'PROCESSING' THEN 'PENDING_CONFIRMATION'::"public"."shipments_status_enum_new"
          WHEN 'TRANSIT' THEN 'SHIPPED'::"public"."shipments_status_enum_new"
          WHEN 'ARRIVED' THEN 'AVAILABLE_FOR_PICKUP'::"public"."shipments_status_enum_new"
          WHEN 'DELAY' THEN 'ORDER_PLACED'::"public"."shipments_status_enum_new"
          WHEN 'DELIVERED' THEN 'DELIVERED'::"public"."shipments_status_enum_new"
          ELSE 'ORDER_PLACED'::"public"."shipments_status_enum_new"
        END
      ),
      ALTER COLUMN "status" SET DEFAULT 'ORDER_PLACED'
    `);

    // 3. Drop the old enum type
    await queryRunner.query(`DROP TYPE "public"."shipments_status_enum"`);

    // 4. Rename the new enum type to the original name
    await queryRunner.query(
      `ALTER TYPE "public"."shipments_status_enum_new" RENAME TO "shipments_status_enum"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert logic
    await queryRunner.query(
      `CREATE TYPE "public"."shipments_status_enum_old" AS ENUM('PENDING', 'PROCESSING', 'TRANSIT', 'ARRIVED', 'DELAY', 'DELIVERED')`
    );

    await queryRunner.query(`
      ALTER TABLE "shipments" 
      ALTER COLUMN "status" DROP DEFAULT,
      ALTER COLUMN "status" TYPE "public"."shipments_status_enum_old" 
      USING (
        CASE "status"::text
          WHEN 'ORDER_PLACED' THEN 'PENDING'::"public"."shipments_status_enum_old"
          WHEN 'PENDING_CONFIRMATION' THEN 'PROCESSING'::"public"."shipments_status_enum_old"
          WHEN 'WAITING_TO_BE_SHIPPED' THEN 'PROCESSING'::"public"."shipments_status_enum_old"
          WHEN 'SHIPPED' THEN 'TRANSIT'::"public"."shipments_status_enum_old"
          WHEN 'AVAILABLE_FOR_PICKUP' THEN 'ARRIVED'::"public"."shipments_status_enum_old"
          WHEN 'DELIVERED' THEN 'DELIVERED'::"public"."shipments_status_enum_old"
          ELSE 'PENDING'::"public"."shipments_status_enum_old"
        END
      ),
      ALTER COLUMN "status" SET DEFAULT 'PENDING'
    `);

    await queryRunner.query(`DROP TYPE "public"."shipments_status_enum"`);

    await queryRunner.query(
      `ALTER TYPE "public"."shipments_status_enum_old" RENAME TO "shipments_status_enum"`
    );
  }
}
