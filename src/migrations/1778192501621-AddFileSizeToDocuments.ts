import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFileSizeToDocuments1778192501621 implements MigrationInterface {
    name = 'AddFileSizeToDocuments1778192501621'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "documents" ADD "file_size" bigint`);
        await queryRunner.query(`ALTER TABLE "document_versions" ADD "file_size" bigint`);
        await queryRunner.query(`ALTER TYPE "public"."document_activity_action_enum" RENAME TO "document_activity_action_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."document_activity_action_enum" AS ENUM('UPLOADED', 'VIEWED', 'DOWNLOADED', 'APPROVED', 'REJECTED', 'NEW_VERSION', 'DELETED')`);
        await queryRunner.query(`ALTER TABLE "document_activity" ALTER COLUMN "action" TYPE "public"."document_activity_action_enum" USING "action"::"text"::"public"."document_activity_action_enum"`);
        await queryRunner.query(`DROP TYPE "public"."document_activity_action_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."document_activity_action_enum_old" AS ENUM('UPLOADED', 'VIEWED', 'APPROVED', 'REJECTED', 'NEW_VERSION', 'DELETED')`);
        await queryRunner.query(`ALTER TABLE "document_activity" ALTER COLUMN "action" TYPE "public"."document_activity_action_enum_old" USING "action"::"text"::"public"."document_activity_action_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."document_activity_action_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."document_activity_action_enum_old" RENAME TO "document_activity_action_enum"`);
        await queryRunner.query(`ALTER TABLE "document_versions" DROP COLUMN "file_size"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "file_size"`);
    }

}
