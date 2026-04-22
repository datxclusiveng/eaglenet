import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCustomerTableV21776881452000 implements MigrationInterface {
    name = 'CreateCustomerTableV21776881452000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if table exists first to avoid errors if partially synced
        const tableExists = await queryRunner.hasTable("customers");
        if (!tableExists) {
            await queryRunner.query(`CREATE TABLE "customers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fullName" character varying NOT NULL, "email" character varying NOT NULL, "phoneNumber" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_8536b8b85c06969f84f0c098b03" UNIQUE ("email"), CONSTRAINT "PK_133ec679a801fab5e070f73d3ea" PRIMARY KEY ("id"))`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "customers"`);
    }

}
