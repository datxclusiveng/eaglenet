import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1772187071000 implements MigrationInterface {
  name = "InitialSchema1772187071000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable uuid-ossp extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // ENUMS
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('SUPERADMIN', 'ADMIN', 'CUSTOMER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."shipments_status_enum" AS ENUM('PENDING', 'PROCESSING', 'TRANSIT', 'ARRIVED', 'DELAY', 'DELIVERED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payments_status_enum" AS ENUM('SUCCESS', 'PENDING', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum" AS ENUM('GENERIC', 'SHIPMENT', 'PAYMENT', 'ACCOUNT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."locations_type_enum" AS ENUM('AIRPORT', 'SEAPORT')`,
    );

    // TABLES
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "first_name" character varying NOT NULL,
        "last_name" character varying NOT NULL,
        "email" character varying NOT NULL,
        "password" character varying NOT NULL,
        "role" "public"."users_role_enum" NOT NULL DEFAULT 'CUSTOMER',
        "outstanding_balance" numeric(12,2) NOT NULL DEFAULT '0',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "services" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "service_name" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_services_service_name" UNIQUE ("service_name"),
        CONSTRAINT "PK_services" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "locations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "type" "public"."locations_type_enum" NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_locations" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "shipments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "shipping_id" character varying NOT NULL,
        "tracking_id" character varying NOT NULL,
        "full_name" character varying NOT NULL,
        "email" character varying NOT NULL,
        "phone_number" character varying NOT NULL,
        "pickup_address" character varying NOT NULL,
        "pickup_city" character varying NOT NULL,
        "delivery_address" character varying NOT NULL,
        "destination_city" character varying NOT NULL,
        "preferred_pickup_date" date NOT NULL,
        "preferred_pickup_time" character varying NOT NULL,
        "special_requirements" text,
        "package_details" text,
        "weight" numeric(8,2),
        "status" "public"."shipments_status_enum" NOT NULL DEFAULT 'PENDING',
        "amount" numeric(12,2) NOT NULL DEFAULT '0',
        "user_id" uuid,
        "service_id" uuid,
        "origin" character varying,
        "destination" character varying,
        "arrival_date" date,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_shipments_shipping_id" UNIQUE ("shipping_id"),
        CONSTRAINT "UQ_shipments_tracking_id" UNIQUE ("tracking_id"),
        CONSTRAINT "PK_shipments" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tracking" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "shipment_id" uuid NOT NULL,
        "checkpoint" character varying NOT NULL,
        "location" character varying,
        "status" character varying NOT NULL,
        "date" TIMESTAMP NOT NULL DEFAULT now(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tracking" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "payment_id" character varying NOT NULL,
        "reference" character varying NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "status" "public"."payments_status_enum" NOT NULL DEFAULT 'PENDING',
        "paystack_access_code" character varying,
        "paystack_auth_url" character varying,
        "user_id" uuid NOT NULL,
        "shipment_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_payments_payment_id" UNIQUE ("payment_id"),
        CONSTRAINT "UQ_payments_reference" UNIQUE ("reference"),
        CONSTRAINT "PK_payments" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" character varying NOT NULL,
        "actor_id" uuid,
        "type" "public"."notifications_type_enum" NOT NULL DEFAULT 'GENERIC',
        "title" character varying NOT NULL,
        "body" text NOT NULL,
        "payload" jsonb,
        "is_read" boolean NOT NULL DEFAULT false,
        "delivered_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id")
      )
    `);

    // FOREIGN KEYS
    await queryRunner.query(
      `ALTER TABLE "shipments" ADD CONSTRAINT "FK_shipments_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipments" ADD CONSTRAINT "FK_shipments_service" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tracking" ADD CONSTRAINT "FK_tracking_shipment" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_payments_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_payments_shipment" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_shipment"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tracking" DROP CONSTRAINT "FK_tracking_shipment"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipments" DROP CONSTRAINT "FK_shipments_service"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipments" DROP CONSTRAINT "FK_shipments_user"`,
    );

    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TABLE "tracking"`);
    await queryRunner.query(`DROP TABLE "shipments"`);
    await queryRunner.query(`DROP TABLE "locations"`);
    await queryRunner.query(`DROP TABLE "services"`);
    await queryRunner.query(`DROP TABLE "users"`);

    await queryRunner.query(`DROP TYPE "public"."locations_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."shipments_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
  }
}
