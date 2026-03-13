import "reflect-metadata";
import { DataSource } from "typeorm";
import dotenv from "dotenv";
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  synchronize: false,
  logging: false,
  entities: ["src/entities/**/*.ts"],
});

async function checkDatabase() {
    try {
        await AppDataSource.initialize();
        console.log('Connected to DB');
        
        try {
            const tableExists = await AppDataSource.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE  table_schema = 'public'
                    AND    table_name   = 'shipments'
                );
            `);
            console.log('Table "shipments" exists:', tableExists);

            if (tableExists[0].exists) {
                const result = await AppDataSource.query('SELECT DISTINCT status FROM shipments');
                console.log('Unique statuses in shipments table:', result);
            }
        } catch (e) {
            console.log('Error querying shipments table (maybe it doesnt exist yet)');
        }

        const enumValues = await AppDataSource.query(`
            SELECT t.typname as type, e.enumlabel as value
            FROM pg_type t 
            JOIN pg_enum e ON t.oid = e.enumtypid  
            WHERE t.typname = 'shipments_status_enum'
        `);
        console.log('Current enum values in DB:', enumValues);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await AppDataSource.destroy();
    }
}

checkDatabase();
