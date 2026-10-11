import "dotenv/config";
import { neon } from "@neondatabase/serverless";

/**
 * Photos uploaded before the "scans or photos of old prints" checkbox took their date from the camera,
 * which for scans is the day the print was copied. This clears those dates.
 *
 *   npm run migrate:scan-dates            shows what would change, changes nothing
 *   npm run migrate:scan-dates -- --apply makes the change
 *
 * Only photos uploaded before the scans switch went live (October 7, 2026) are touched. Anything uploaded since then
 * already chose: scans ignored the camera date, and real phone photos kept theirs. --before=YYYY-MM-DD changes the cutoff.
 *
 * If someone later typed a year by hand on the photo page, that year is kept. Only the camera date and month are cleared.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = neon(url);
  const apply = process.argv.includes("--apply");
  const before = process.argv.find((a) => a.startsWith("--before="))?.slice(9) ?? "2026-10-07";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(before)) throw new Error("--before needs a date like 2026-10-07");
  const [later] = (await sql.query(
    `select count(*)::int as n from photos where taken_on is not null and created_at >= $1::date`, [before])) as { n: number }[];

  const [counts] = (await sql.query(
    `select count(*)::int as total,
            count(*) filter (where year is null or year = extract(year from taken_on)::int)::int as camera_year,
            count(*) filter (where year is not null and year <> extract(year from taken_on)::int)::int as typed_year,
            count(*) filter (where deleted_at is not null)::int as removed
       from photos where taken_on is not null and created_at < $1::date`, [before],
  )) as { total: number; camera_year: number; typed_year: number; removed: number }[];

  const byYear = (await sql.query(
    `select extract(year from taken_on)::int as y, count(*)::int as n
       from photos where taken_on is not null and created_at < $1::date group by 1 order by 1`, [before],
  )) as { y: number; n: number }[];

  console.log(`Uploaded before ${before} with a camera date: ${counts.total}${counts.removed ? ` (${counts.removed} of them already removed from the site)` : ""}`);
  if (later?.n) console.log(`(${later.n} uploaded since then keep their dates either way.)`);
  if (counts.total === 0) return console.log("Nothing to change.");
  console.log(`  ${counts.camera_year} will lose their year, month, and decade and show as undated.`);
  if (counts.typed_year) console.log(`  ${counts.typed_year} have a year someone typed by hand. They keep that year and lose only the camera date and month.`);
  console.log("Camera dates by year:");
  for (const r of byYear) console.log(`  ${r.y}: ${r.n}`);

  if (!apply) return console.log("\nNothing was changed. Run again with -- --apply to make the change.");

  const rows = (await sql.query(
    `update photos set
        year   = case when year is null or year = extract(year from taken_on)::int then null else year end,
        decade = case when year is null or year = extract(year from taken_on)::int then null else decade end,
        month = null,
        taken_on = null
      where taken_on is not null and created_at < $1::date
      returning id`, [before],
  )) as { id: number }[];
  console.log(`\nDone. Updated ${rows.length} photos.`);
}
main();
