import "dotenv/config";
import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = neon(url);
  const statements = readFileSync("db/schema.sql", "utf8")
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const s of statements) await sql.query(s);
  console.log(`Ran ${statements.length} statements.`);
}
main();
