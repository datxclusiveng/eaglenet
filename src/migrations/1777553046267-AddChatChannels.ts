import { MigrationInterface, QueryRunner } from "typeorm";

export class AddChatChannels1777553046267 implements MigrationInterface {
    name = 'AddChatChannels1777553046267'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."channel_members_role_enum" AS ENUM('admin', 'member')`);
        await queryRunner.query(`CREATE TABLE "channel_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "channel_id" uuid NOT NULL, "user_id" uuid NOT NULL, "role" "public"."channel_members_role_enum" NOT NULL DEFAULT 'member', "joined_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_95976b619edca48aed364c70c36" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_71a10831469775a1effdd85f24" ON "channel_members" ("channel_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_2211e70107e1663e0ea61d70de" ON "channel_members" ("user_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f25be699d4039301684128a7a8" ON "channel_members" ("channel_id", "user_id") `);
        await queryRunner.query(`CREATE TYPE "public"."channel_messages_message_type_enum" AS ENUM('text', 'file')`);
        await queryRunner.query(`CREATE TABLE "channel_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "channel_id" uuid NOT NULL, "sender_id" uuid NOT NULL, "content" text NOT NULL, "message_type" "public"."channel_messages_message_type_enum" NOT NULL DEFAULT 'text', "attachment_url" character varying, "attachment_name" character varying, "is_deleted" boolean NOT NULL DEFAULT false, "sent_at" TIMESTAMP NOT NULL DEFAULT now(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_78c08df85633e14659b3bfcd3b7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1fe2ce70d148150a26b64cf1ca" ON "channel_messages" ("channel_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_335d86ec29fe835ff1be83a470" ON "channel_messages" ("sender_id") `);
        await queryRunner.query(`CREATE TABLE "chat_channels" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" text, "is_private" boolean NOT NULL DEFAULT false, "created_by_id" uuid NOT NULL, "department_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_b00068412a118393208d739987b" UNIQUE ("name"), CONSTRAINT "PK_efecd102855fb96e1428306ec6f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b00068412a118393208d739987" ON "chat_channels" ("name") `);
        await queryRunner.query(`ALTER TABLE "channel_members" ADD CONSTRAINT "FK_71a10831469775a1effdd85f240" FOREIGN KEY ("channel_id") REFERENCES "chat_channels"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "channel_members" ADD CONSTRAINT "FK_2211e70107e1663e0ea61d70de6" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "channel_messages" ADD CONSTRAINT "FK_1fe2ce70d148150a26b64cf1cad" FOREIGN KEY ("channel_id") REFERENCES "chat_channels"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "channel_messages" ADD CONSTRAINT "FK_335d86ec29fe835ff1be83a4701" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat_channels" ADD CONSTRAINT "FK_06d99f91323dcb208617c21ce3d" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat_channels" ADD CONSTRAINT "FK_7dfc520509e46a4a28c66617551" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_channels" DROP CONSTRAINT "FK_7dfc520509e46a4a28c66617551"`);
        await queryRunner.query(`ALTER TABLE "chat_channels" DROP CONSTRAINT "FK_06d99f91323dcb208617c21ce3d"`);
        await queryRunner.query(`ALTER TABLE "channel_messages" DROP CONSTRAINT "FK_335d86ec29fe835ff1be83a4701"`);
        await queryRunner.query(`ALTER TABLE "channel_messages" DROP CONSTRAINT "FK_1fe2ce70d148150a26b64cf1cad"`);
        await queryRunner.query(`ALTER TABLE "channel_members" DROP CONSTRAINT "FK_2211e70107e1663e0ea61d70de6"`);
        await queryRunner.query(`ALTER TABLE "channel_members" DROP CONSTRAINT "FK_71a10831469775a1effdd85f240"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b00068412a118393208d739987"`);
        await queryRunner.query(`DROP TABLE "chat_channels"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_335d86ec29fe835ff1be83a470"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1fe2ce70d148150a26b64cf1ca"`);
        await queryRunner.query(`DROP TABLE "channel_messages"`);
        await queryRunner.query(`DROP TYPE "public"."channel_messages_message_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f25be699d4039301684128a7a8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2211e70107e1663e0ea61d70de"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_71a10831469775a1effdd85f24"`);
        await queryRunner.query(`DROP TABLE "channel_members"`);
        await queryRunner.query(`DROP TYPE "public"."channel_members_role_enum"`);
    }

}
