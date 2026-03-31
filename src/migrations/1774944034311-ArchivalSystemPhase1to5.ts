import { MigrationInterface, QueryRunner } from "typeorm";

export class ArchivalSystemPhase1to51774944034311 implements MigrationInterface {
    name = 'ArchivalSystemPhase1to51774944034311'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."documents_visibility_scope_enum" AS ENUM('GLOBAL', 'DEPARTMENT', 'PRIVATE')`);
        await queryRunner.query(`ALTER TABLE "documents" ADD "visibility_scope" "public"."documents_visibility_scope_enum" NOT NULL DEFAULT 'GLOBAL'`);
        await queryRunner.query(`ALTER TABLE "documents" ADD "is_archived" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "documents" ADD "admin_tags" jsonb DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "documents" ADD "commit_message" text`);
        await queryRunner.query(`ALTER TABLE "documents" ADD "extracted_text" text`);
        await queryRunner.query(`ALTER TABLE "documents" ADD "department_id" uuid`);
        await queryRunner.query(`CREATE TYPE "public"."shipments_creation_source_enum" AS ENUM('CUSTOMER', 'STAFF')`);
        await queryRunner.query(`ALTER TABLE "shipments" ADD "creation_source" "public"."shipments_creation_source_enum" NOT NULL DEFAULT 'CUSTOMER'`);
        await queryRunner.query(`ALTER TABLE "shipments" ADD "is_external" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "documents" ADD CONSTRAINT "FK_24a226d1434cd9a9748d5f11959" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

        // ── Full-Text Search Schema ──────────────────────────────────────────
        await queryRunner.query(`ALTER TABLE "documents" ADD "text_search_vector" tsvector`);
        await queryRunner.query(`CREATE INDEX "documents_fts_idx" ON "documents" USING GIN("text_search_vector")`);
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION documents_fts_trigger() RETURNS trigger AS $$
            begin
              new.text_search_vector :=
                setweight(to_tsvector('english', coalesce(new.name, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(new.extracted_text, '')), 'B');
              return new;
            end
            $$ LANGUAGE plpgsql;
        `);
        await queryRunner.query(`
            CREATE TRIGGER tsvectorupdate BEFORE INSERT OR UPDATE
            ON "documents" FOR EACH ROW EXECUTE FUNCTION documents_fts_trigger();
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // ── Full-Text Search Rollback ────────────────────────────────────────
        await queryRunner.query(`DROP TRIGGER IF EXISTS tsvectorupdate ON "documents"`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS documents_fts_trigger()`);
        await queryRunner.query(`DROP INDEX IF EXISTS "documents_fts_idx"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "text_search_vector"`);

        await queryRunner.query(`ALTER TABLE "documents" DROP CONSTRAINT "FK_24a226d1434cd9a9748d5f11959"`);
        await queryRunner.query(`ALTER TABLE "shipments" DROP COLUMN "is_external"`);
        await queryRunner.query(`ALTER TABLE "shipments" DROP COLUMN "creation_source"`);
        await queryRunner.query(`DROP TYPE "public"."shipments_creation_source_enum"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "department_id"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "extracted_text"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "commit_message"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "admin_tags"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "is_archived"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "visibility_scope"`);
        await queryRunner.query(`DROP TYPE "public"."documents_visibility_scope_enum"`);
    }

}
