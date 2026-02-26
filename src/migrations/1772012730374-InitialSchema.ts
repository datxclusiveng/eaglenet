import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1772012730374 implements MigrationInterface {
    name = 'InitialSchema1772012730374'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "first_name" character varying NOT NULL, "last_name" character varying NOT NULL, "email" character varying NOT NULL, "password" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'CUSTOMER', "outstanding_balance" numeric(12,2) NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "shipments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "shipping_id" character varying NOT NULL, "tracking_id" character varying NOT NULL, "full_name" character varying NOT NULL, "email" character varying NOT NULL, "phone_number" character varying NOT NULL, "pickup_address" character varying NOT NULL, "pickup_city" character varying NOT NULL, "delivery_address" character varying NOT NULL, "destination_city" character varying NOT NULL, "preferred_pickup_date" date NOT NULL, "preferred_pickup_time" character varying NOT NULL, "special_requirements" text, "package_details" text, "weight" numeric(8,2), "status" "public"."shipments_status_enum" NOT NULL DEFAULT 'PENDING', "amount" numeric(12,2) NOT NULL DEFAULT '0', "user_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_d33a8898cfacff46c9f48d3f710" UNIQUE ("shipping_id"), CONSTRAINT "UQ_f3684afc1ec2f81184f9a274051" UNIQUE ("tracking_id"), CONSTRAINT "PK_6deda4532ac542a93eab214b564" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "payment_id" character varying NOT NULL, "reference" character varying NOT NULL, "amount" numeric(12,2) NOT NULL, "status" "public"."payments_status_enum" NOT NULL DEFAULT 'PENDING', "paystack_access_code" character varying, "paystack_auth_url" character varying, "user_id" uuid NOT NULL, "shipment_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_8866a3cfff96b8e17c2b204aae0" UNIQUE ("payment_id"), CONSTRAINT "UQ_866ddee0e17d9385b4e3b86851d" UNIQUE ("reference"), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" character varying NOT NULL, "actor_id" uuid, "type" "public"."notifications_type_enum" NOT NULL DEFAULT 'GENERIC', "title" character varying NOT NULL, "body" text NOT NULL, "payload" jsonb, "is_read" boolean NOT NULL DEFAULT false, "delivered_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "shipments" ADD CONSTRAINT "FK_f1c9dcb7617e93104b846b45a2c" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_427785468fb7d2733f59e7d7d39" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_a849de550997f732685b44ae71a" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_a849de550997f732685b44ae71a"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_427785468fb7d2733f59e7d7d39"`);
        await queryRunner.query(`ALTER TABLE "shipments" DROP CONSTRAINT "FK_f1c9dcb7617e93104b846b45a2c"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
        await queryRunner.query(`DROP TABLE "payments"`);
        await queryRunner.query(`DROP TABLE "shipments"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
