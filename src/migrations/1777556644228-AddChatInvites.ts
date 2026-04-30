import { MigrationInterface, QueryRunner } from "typeorm";

export class AddChatInvites1777556644228 implements MigrationInterface {
    name = 'AddChatInvites1777556644228'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."chat_invites_status_enum" AS ENUM('pending', 'accepted', 'rejected')`);
        await queryRunner.query(`CREATE TABLE "chat_invites" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sender_id" uuid NOT NULL, "recipient_id" uuid NOT NULL, "status" "public"."chat_invites_status_enum" NOT NULL DEFAULT 'pending', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_87ba0a32949f247fd05e3a6c57c" UNIQUE ("sender_id", "recipient_id"), CONSTRAINT "PK_2bb111c041c01a600d6a0def77d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9a9ff8814f4e61b8e05f4a4f0e" ON "chat_invites" ("sender_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_82d05983c7bfe3a26fa9357aa2" ON "chat_invites" ("recipient_id") `);
        await queryRunner.query(`ALTER TABLE "chat_invites" ADD CONSTRAINT "FK_9a9ff8814f4e61b8e05f4a4f0e1" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat_invites" ADD CONSTRAINT "FK_82d05983c7bfe3a26fa9357aa23" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_invites" DROP CONSTRAINT "FK_82d05983c7bfe3a26fa9357aa23"`);
        await queryRunner.query(`ALTER TABLE "chat_invites" DROP CONSTRAINT "FK_9a9ff8814f4e61b8e05f4a4f0e1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_82d05983c7bfe3a26fa9357aa2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9a9ff8814f4e61b8e05f4a4f0e"`);
        await queryRunner.query(`DROP TABLE "chat_invites"`);
        await queryRunner.query(`DROP TYPE "public"."chat_invites_status_enum"`);
    }

}
