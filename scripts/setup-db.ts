import "dotenv/config";
import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";

async function main() {
  // Vercel also builds preview copies of other branches, and they share the live database.
  // Only a real publish (or running this yourself) may change the database.
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    console.log(`Skipping database setup for a ${process.env.VERCEL_ENV} build.`);
    return;
  }
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
// Runs before every build (see package.json), so a deploy can't go out on an out-of-date database.
// If this fails, the build fails and the site that's already live stays as it is.
main().catch((e) => {
  console.error("Database setup failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
