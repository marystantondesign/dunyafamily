# Dunya Family: context for Claude Code

Private family photo site named after Mary's mom, Dunya. Built by Mary (senior product designer). Read README.md for setup and the full permission model. Live at https://dunyafamily-nine.vercel.app.

## Working with Mary

- Explain what you're doing in plain language. Never ask her to paste secret keys into chat; tell her which line in .env to paste them into.
- Work on a branch. Pushing to main publishes (Vercel deploys main automatically), so only push to main when she says publish.
- After each change: typecheck, commit, tell her what to click, and wait for her OK.
- Database changes: before publishing anything that changes the database, tell her exactly what it adds and wait for her to make a Neon backup branch and say OK. Migrations only add tables and columns or copy data. Never drop or rename.
- Mary wants to see visual mockups before big UI changes. The approved design lives outside the repo (DESIGN.md and screens 01 to 24 from the dunya-design zip).

## Stack

Next.js 15 App Router, TypeScript, plain CSS in app/globals.css (design tokens on :root, no Tailwind). Neon Postgres through lib/db.ts (q(text, params)). Cloudflare R2 through lib/r2.ts with presigned PUT and GET. Sessions are signed JWT cookies (jose) in lib/session.ts. Middleware gates everything except /enter, /api/enter, and /api/calendar.

npm run build runs scripts/setup-db.ts first, which applies db/schema.sql (idempotent). It skips non-production Vercel builds so previews never touch the live database.

## Conventions

- Every write checks getSession() from lib/auth. Removal checks canRemove(session, created_by_device). Admin can do everything. isAdmin(session) for admin pages, which return notFound() for everyone else.
- Never hard delete. Set deleted_at and deleted_by_name. Everything removed shows in Recently deleted for 30 days.
- Never delete anything from R2.
- Never expose R2 object URLs directly. Always signGet.
- Route files may only export handlers. Shared helpers go in lib/ (Next fails the build otherwise).
- After a save that changes server data, client components use window.location.assign or router.refresh so pages aren't stale.
- UI copy: sentence case, plain verbs, no em dashes, no exclamation points.

## Sessions and coming in

- Come in is the family password, then "Which one is you?" (pick yourself from the family, or "I'm not on the list yet"). The session is { role, did, name, pid, v }: did is the device id (also kept in the df_device cookie across logouts), pid the person this device picked.
- The family password hash lives in settings (family_password_hash), falling back to FAMILY_PASSWORD_HASH. Changing it bumps family_password_version; family sessions with an older v are signed out (lib/auth sessionState, and the root layout redirects to /api/logout). The admin password is only ADMIN_PASSWORD_HASH.
- /api/enter allows five wrong passwords per IP per 15 minutes (login_attempts table).

## Data model

See db/schema.sql.

- people: name, aliases, avatar_photo_id, address with share_address, in_memory, family_friend.
- photos: year, month, decade, taken_on, caption, upload_batch. photo_people and photo_occasions are the tags. occasions have kind (holiday, season, occasion).
- birthdays (month, day, optional year), person_dates (anniversary, remembrance, other), gatherings.
- albums and album_photos: shared albums, separate from occasions. Anyone can add; whoever started one, or the admin, can rename or delete it.
- relationships: kind 'parent' (person_id is the parent of related_id) or 'partner' (lower id first). The tree grows from Dunya (lib/featured findDunya); lib/family builds it and blocks someone becoming their own ancestor.
- settings: key and value (home_photo_id, family password hash and version).

## Roadmap

1. Import script for Mary's existing 500 to 2,000 photos. Depends on how they are organized now (folders, filenames). Should upload originals plus 800px thumbnails to R2 and create rows with tags parsed from folder names.
2. Manage people screen: rename, merge duplicates (move photo_people rows, add the old name as an alias), and manage occasions. Mary cleaned up names by hand for now.
3. Homepage: birthday takeover ("Happy birthday, Lena" with photos through the years) and an "On this day" row for exact-dated photos.
4. HEIC: iPhone Safari converts to JPEG on upload. Chrome on desktop can't decode HEIC; consider server-side conversion if relatives hit this.
5. Old scan dates: npm run migrate:scan-dates shows how many early uploads still carry a camera date from scanning. Run with --apply only after Mary's OK.
6. Maybe later: prayer requests. A place for the family to share what they'd like prayer for. Not designed yet.
