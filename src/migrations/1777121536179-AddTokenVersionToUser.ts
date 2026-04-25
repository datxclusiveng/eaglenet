import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTokenVersionToUser1777121536179 implements MigrationInterface {
    name = 'AddTokenVersionToUser1777121536179'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "token_version" integer NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "token_version"`);
    }

}
