# Dunya Family: context for Claude Code

Private family photo site named after Mary's mom, Dunya. Built by Mary (senior product designer). Read README.md for setup and the permission model.

## Stack

Next.js 15 App Router, TypeScript, plain CSS in app/globals.css (no Tailwind). Neon Postgres through lib/db.ts (q(text, params)). Cloudflare R2 through lib/r2.ts with presigned PUT and GET. Sessions are signed JWT cookies (jose) in lib/session.ts. Middleware gates everything except /enter, /api/enter, and /api/calendar.

## Conventions

- Every write checks getSession(). Removal checks canRemove(session, created_by_device). Admin role can do everything.
- Never hard delete. Use deleted_at.
- Never expose R2 object URLs directly. Always signGet.
- UI copy: sentence case, plain verbs, no em dashes, no exclamation points.
- Mary wants to see visual mockups before big UI changes.

## Data model

people, occasions (kind: holiday, season, occasion), photos (year, month, decade, taken_on), photo_people, photo_occasions, birthdays (month and day only), gatherings. See db/schema.sql.

## Roadmap

1. Import script for Mary's existing 500 to 2,000 photos. Depends on how they are organized now (folders, filenames). Should upload originals plus 800px thumbnails to R2 and create rows with tags parsed from folder names.
2. Admin page: restore removed items, rename and merge people (merge = move photo_people rows, add old name as alias), manage occasions.
3. Upload step two: optional per-photo pass after the batch tags (add or remove people on individual photos before saving).
4. Homepage: birthday takeover ("Happy birthday, Lena" with photos through the years) and an "On this day" row for exact-dated photos.
5. Rate limit /api/enter.
6. HEIC: iPhone Safari converts to JPEG on upload. Chrome on desktop can't decode HEIC; consider server-side conversion if relatives hit this.
7. Photo page: previous and next within the current browse filters.
