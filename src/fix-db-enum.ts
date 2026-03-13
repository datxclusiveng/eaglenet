import "reflect-metadata";
import { DataSource } from "typeorm";
import dotenv from "dotenv";
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  synchronize: false,
  logging: true,
  entities: ["src/entities/**/*.ts"],
});

async function runFix() {
    try {
        await AppDataSource.initialize();
        console.log('Connected to DB');

        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        
        console.log('Starting data migration...');

        // 1. Create a temporary enum with the new values
        await queryRunner.query(
          `CREATE TYPE "public"."shipments_status_enum_new" AS ENUM('ORDER_PLACED', 'PENDING_CONFIRMATION', 'WAITING_TO_BE_SHIPPED', 'SHIPPED', 'AVAILABLE_FOR_PICKUP', 'DELIVERED', 'CANCELLED')`
        );

        // 2. Alter the shipments table status column to use the new enum
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

        console.log('Data migration completed successfully!');
        
        await queryRunner.release();

    } catch (error) {
        console.error('Error during fix:', error);
    } finally {
        await AppDataSource.destroy();
    }
}

runFix();
