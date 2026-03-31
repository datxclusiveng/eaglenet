import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialFullSchema1711735000000 implements MigrationInterface {
  name = "InitialFullSchema1711735000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    // ── 1. DROP EXISTING SCHEMA (HARD RESET) ───────────────────────────────────
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "documents" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payments" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tracking" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "shipment_logs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "shipment_collaborators" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "shipments" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_department_roles" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permissions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "departments" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "services" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "locations" CASCADE`);

    // DROP ENUMS
    await queryRunner.query(`DROP TYPE IF EXISTS "users_role_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "shipments_status_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "permissions_scope_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payments_status_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "documents_status_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "locations_type_enum" CASCADE`);

    // ── 2. CREATE SCHEMAS ──────────────────────────────────────────────────────

    // URSERS
    await queryRunner.query(`CREATE TYPE "users_role_enum" AS ENUM('CUSTOMER', 'ADMIN', 'SUPERADMIN')`);
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "first_name" character varying NOT NULL,
        "last_name" character varying NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "email" character varying NOT NULL,
        "password" character varying NOT NULL,
        "role" "users_role_enum" NOT NULL DEFAULT 'CUSTOMER',
        "phone_number" character varying,
        "outstanding_balance" numeric(12,2) NOT NULL DEFAULT '0',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_users_email" ON "users" ("email")`);

    // DEPARTMENTS
    await queryRunner.query(`
      CREATE TABLE "departments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "metadata" jsonb DEFAULT '{}',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_departments_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_departments_name" UNIQUE ("name")
      )
    `);

    // ROLES & PERMISSIONS
    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "description" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_roles_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_roles_name" UNIQUE ("name")
      )
    `);

    await queryRunner.query(`CREATE TYPE "permissions_scope_enum" AS ENUM('own', 'department', 'all')`);
    await queryRunner.query(`
      CREATE TABLE "permissions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "resource" character varying NOT NULL,
        "action" character varying NOT NULL,
        "scope" "permissions_scope_enum" NOT NULL DEFAULT 'own',
        "conditions" jsonb DEFAULT '{}',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_permissions_id" PRIMARY KEY ("id")
      )
    `);

    // Role Permissions (Join)
    await queryRunner.query(`
      CREATE TABLE "role_permissions" (
        "role_id" uuid NOT NULL,
        "permission_id" uuid NOT NULL,
        CONSTRAINT "PK_role_permissions" PRIMARY KEY ("role_id", "permission_id"),
        CONSTRAINT "FK_role_permissions_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_role_permissions_permission" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE
      )
    `);

    // User Department Role (Junction)
    await queryRunner.query(`
      CREATE TABLE "user_department_roles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "department_id" uuid NOT NULL,
        "role_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_department_roles_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_udr_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_udr_dept" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_udr_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE
      )
    `);

    // SERVICES & LOCATIONS
    await queryRunner.query(`
      CREATE TABLE "services" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "service_name" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_services_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_services_name" UNIQUE ("service_name")
      )
    `);

    await queryRunner.query(`CREATE TYPE "locations_type_enum" AS ENUM('AIRPORT', 'SEAPORT')`);
    await queryRunner.query(`
      CREATE TABLE "locations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "type" "locations_type_enum" NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_locations_id" PRIMARY KEY ("id")
      )
    `);

    // SHIPMENTS
    await queryRunner.query(`
      CREATE TYPE "shipments_status_enum" AS ENUM(
        'ORDER_PLACED', 'PENDING_CONFIRMATION', 'WAITING_TO_BE_SHIPPED',
        'SHIPPED', 'AVAILABLE_FOR_PICKUP', 'DELIVERED', 'CANCELLED'
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
        "status" "shipments_status_enum" NOT NULL DEFAULT 'ORDER_PLACED',
        "amount" numeric(12,2) NOT NULL DEFAULT '0',
        "dynamicFields" jsonb DEFAULT '{}',
        "user_id" uuid,
        "department_id" uuid,
        "service_id" uuid,
        "origin" character varying,
        "destination" character varying,
        "arrival_date" date,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_shipments_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_shipments_shipping_id" UNIQUE ("shipping_id"),
        CONSTRAINT "UQ_shipments_tracking_id" UNIQUE ("tracking_id"),
        CONSTRAINT "FK_shipments_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_shipments_dept" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_shipments_service" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_shipments_shipping_id" ON "shipments" ("shipping_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_shipments_tracking_id" ON "shipments" ("tracking_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_shipments_status" ON "shipments" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_shipments_dept" ON "shipments" ("department_id")`);

    // TRACKING
    await queryRunner.query(`
      CREATE TABLE "tracking" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "shipment_id" uuid NOT NULL,
        "checkpoint" character varying NOT NULL,
        "location" character varying,
        "status" character varying NOT NULL,
        "date" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tracking_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tracking_shipment" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE
      )
    `);

    // PAYMENTS
    await queryRunner.query(`CREATE TYPE "payments_status_enum" AS ENUM('PENDING', 'SUCCESS', 'FAILED')`);
    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "payment_id" character varying NOT NULL,
        "reference" character varying NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "status" "payments_status_enum" NOT NULL DEFAULT 'PENDING',
        "paystack_access_code" character varying,
        "paystack_auth_url" character varying,
        "user_id" uuid NOT NULL,
        "shipment_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payments_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_payments_payment_id" UNIQUE ("payment_id"),
        CONSTRAINT "UQ_payments_reference" UNIQUE ("reference"),
        CONSTRAINT "FK_payments_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_payments_shipment" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_payments_payment_id" ON "payments" ("payment_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_payments_reference" ON "payments" ("reference")`);

    // DOCUMENTS
    await queryRunner.query(`CREATE TYPE "documents_status_enum" AS ENUM('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED')`);
    await queryRunner.query(`
      CREATE TABLE "documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "file_url" character varying NOT NULL,
        "file_key" character varying NOT NULL,
        "content_type" character varying NOT NULL,
        "document_type" character varying NOT NULL,
        "status" "documents_status_enum" NOT NULL DEFAULT 'PENDING',
        "metadata" jsonb DEFAULT '{}',
        "shipment_id" uuid,
        "uploader_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_documents_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_documents_shipment" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_documents_user" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // NOTIFICATIONS
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "title" character varying NOT NULL,
        "message" text NOT NULL,
        "is_read" boolean NOT NULL DEFAULT false,
        "action_url" character varying,
        "type" character varying NOT NULL DEFAULT 'SYSTEM',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notifications_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // LOGS & COLLABORATORS
    await queryRunner.query(`
      CREATE TABLE "shipment_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "shipment_id" uuid NOT NULL,
        "user_id" uuid,
        "action" character varying NOT NULL,
        "metadata" jsonb DEFAULT '{}',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_shipment_logs_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_logs_shipment" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_logs_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "shipment_collaborators" (
        "shipment_id" uuid NOT NULL,
        "department_id" uuid NOT NULL,
        CONSTRAINT "PK_shipment_collaborators" PRIMARY KEY ("shipment_id", "department_id"),
        CONSTRAINT "FK_collab_shipment" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_collab_dept" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse drop
    await queryRunner.query(`DROP TABLE "shipment_collaborators"`);
    await queryRunner.query(`DROP TABLE "shipment_logs"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TABLE "documents"`);
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TABLE "tracking"`);
    await queryRunner.query(`DROP TABLE "shipments"`);
    await queryRunner.query(`DROP TABLE "user_department_roles"`);
    await queryRunner.query(`DROP TABLE "role_permissions"`);
    await queryRunner.query(`DROP TABLE "permissions"`);
    await queryRunner.query(`DROP TABLE "roles"`);
    await queryRunner.query(`DROP TABLE "departments"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "services"`);
    await queryRunner.query(`DROP TABLE "locations"`);
  }
}
