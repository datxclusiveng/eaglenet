import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserSignatureUrlColumn1779966060694 implements MigrationInterface {
    name = 'AddUserSignatureUrlColumn1779966060694'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'signature_url'
                ) THEN
                    ALTER TABLE "users" ADD "signature_url" text;
                END IF;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'signature_url'
                ) THEN
                    ALTER TABLE "users" DROP COLUMN "signature_url";
                END IF;
            END $$;
        `);
    }

}
