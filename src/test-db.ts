import { Client } from "pg";
import dotenv from "dotenv";
dotenv.config();

async function test() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  try {
    await client.connect();
    console.log("Connected successfully");
    const res = await client.query("SELECT datname FROM pg_database");
    console.log(
      "Databases:",
      res.rows.map((r: { datname: string }) => r.datname),
    );
    await client.end();
  } catch (err: any) {
    console.error("Connection failed:", err.message);
    process.exit(1);
  }
}

test();
