# Dunya Family: context for Claude Code

Private family photo site named after Mary's mom, Dunya. Built by Mary (senior product designer). Read README.md for setup and the full permission model. Live at https://dunyafamily-nine.vercel.app.

## Working with Mary

- Explain what you're doing in plain language. Never ask her to paste secret keys into chat; tell her which line in .env to paste them into.
- Work on a branch, then publish (push to main; Vercel deploys main automatically) once a change is built and tested. Mary asked (October 2026) for everything to be published automatically, without waiting for her OK or a Neon backup each time. Tell her afterward what changed and what to click.
- Database changes: migrations only add tables and columns or copy data. Never drop, rename, or rewrite existing data without asking her first; that rule still stands. Neon's restore history is the safety net.
- Mary wants to see visual mockups before big UI changes. The approved designs live outside the repo (DESIGN.md and screens 01 to 24 from the dunya-design zip, then round 2: round2-changes.md with mockups 1 to 12). Follow them closely and don't invent layouts.

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
- Show names through displayName or byName (lib/names). Stored names can be lowercase ("mary"); the site always shows them capitalized.
- On phones, inputs stay 16px so iOS doesn't zoom. Use the .desktop-only and .phone-only classes (760px breakpoint) for layout differences.

## Sessions and coming in

- Come in is the family password, then "Who are you?" (components/PersonPicker WhoPicker): pick yourself from the people who can sign in. There is no self-signup; only Mary adds people. The session is { role, did, name, pid, v }: did is the device id (also kept in the df_device cookie across logouts), pid the person this device picked.
- Who can sign in (lib/signin): people.can_sign_in when the admin set it (Edit profile, admin only), otherwise on for living blood relatives of Dunya (her, her descendants, her siblings; only the admin edits the tree) and off for everyone else. In memory is always off, and marking someone in memory sets it off. Abe was switched on once (settings can_sign_in_seeded). /api/enter and /api/enter/switch reject anyone else, and a family session for someone who can't sign in is signed out (sessionState stale "who").
- The Dunya prom Polaroid on Who are you? (lib/promPhoto, a data URI) is only sent after the password checks out, never as a public file. Signed out, there's no header at all, so more of the family fits on screen.
- The family password hash lives in settings (family_password_hash), falling back to FAMILY_PASSWORD_HASH. Changing it bumps family_password_version; family sessions with an older v are signed out (lib/auth sessionState, and the root layout redirects to /api/logout). The admin password is only ADMIN_PASSWORD_HASH.
- /api/enter allows five wrong passwords per IP per 15 minutes (login_attempts table).
- Browse with no filters is shuffled with a seed from the df_shuffle session cookie (set in middleware, replaced by Shuffle again), ordered by md5(id || seed) so paging, Previous and Next, and slideshows agree. lib/filters resolveOrder picks the order for every view.

## Data model

See db/schema.sql.

- people: name, aliases, avatar_photo_id, address with share_address, in_memory, family_friend.
- photos: year, month, decade, taken_on, caption, upload_batch. photo_people and photo_occasions are the tags. occasions have kind (holiday, season, occasion).
- birthdays (month, day, optional year), person_dates (anniversary, remembrance, other), gatherings.
- albums and album_photos: shared albums, separate from occasions. Anyone can add; whoever started one, or the admin, can rename or delete it.
- relationships: kind 'parent' (person_id is the parent of related_id) or 'partner' (lower id first). The tree grows from Dunya (lib/featured findDunya); lib/family builds it and blocks someone becoming their own ancestor.
- photos.title: an optional photo name. Without one, the occasion and year show. (photos.caption is the old note; notes were copied into comments.)
- photo_comments (soft delete, restorable) and photo_reactions (any single emoji, one of each per device; removing one is a hard delete of that row).
- homepage_photos: up to 10 photos with captions and positions for the Home Polaroid; settings.homepage_interval is the speed.
- recipes and recipe_notes (round 11, soft delete, restorable): the recipe box. Not a nav tab; the way in is the Home card. person_id links to the tree, from_name is anyone else. "Sort it out for me" (app/api/recipes/parse) uses the Anthropic SDK on the server with ANTHROPIC_API_KEY; without the key people fill the form by hand.
- favorites (person_id, photo_id): each person's starred photos, tied to the person picked under "who are you" (session pid), never the device. Only that person ever sees them; the API never takes a person id from the client. Shown through Browse ?favorites=1 (lib/filters favoritesOf), sort order=favorited.
- photos.tagging_needed (+ _by person, _by_device, _at): "Tagging needed", someone in the photo nobody has named yet. Set from Tag photos ("I'm not sure who this is!") or Edit details; cleared by the flagger, the admin, or anyone answering "Yes, that's everyone" after tagging. Browse ?tagging=1. Separate from the older untagged ("Needs tags") filter.
- In memory (lib/inMemory): isInMemory/livingSql, and inUpcoming/upcomingSql for anything forward-looking (Coming up, calendar upcoming and feed, reminders). Someone in memory has no address or Coming up; remembrance days still work.
- people.is_coparent: had a child with a family member but isn't family. Small on the tree on the drop line to the children they share (each child has both parent links), no partner label, under Partners and extended family on Home's list, left out of suggestions order and reminders. Admin, Family tree has the Co-parent switch.
- Tree (tune-up): no relationship labels. One partner with children together, or a partner with none, stands beside the family member, small (26px). Children by more than one other parent (or some with none recorded): each other parent goes small (20px) on their own drop line, and children with no second parent hang straight off the family member. A second parent is optional (Edit details shows Parents for the admin).
- Desktop tree (lib/treeLayout + components/TreeCanvas): laid out bottom-up with a contour per row, absolutely positioned with SVG lines, spread to the full page width with Dunya's boxes sized to their contents. Shrinks to 90% at most; narrower than that, the phone list shows instead (.tree.narrow). Partners and co-parents are one small size (22px).
- Tree spacing: boxes spread to fill the page with 20px padding (gaps only grow), partner dash 26px, a couple's children drop from the dash middle, below the parent's name.
- Earlier generations (desktop, "Show earlier generations", or /people?earlier=1): in one light box above Dunya, who doesn't move. Parents as a couple over her (mother left), each parent's parents above them (father left), siblings oldest to youngest with Dunya in place. Stops at grandparents. lib/family earlierTree + treeLayout layoutEarlier.
- Sibling trees: /family/[slug] (first name, lowercased; -id added if two share one) is a sibling's own tree built like Dunya's (lib/family siblingFamily, treeLayout layoutBranch). The pill under a sibling shows only when their tree has people.
- Family order (lib/familyOrder): Mary's list in settings family_order ({ main, earlier }), first filled from the names she sent in round 15 and changed in Admin, Family order. Blood relatives not placed yet go at the end of main. Used by Home's Everyone list (Family order or A to Z, remembered per device in localStorage df_everyone_order; everyone else under "Partners and extended family"), the sign-in picker, and Who's here? when tagging.
- Profiles (round 15): Edit profile and the camera badge on the profile photo (also on Settings) are for the person themselves (session pid) or the admin; so is the birthday year. Anyone signed in can add or change an address, and add or change an anniversary, from the profile (components/PeopleBits QuickDetail); on phones only adding an address is offered. No Coming up; a rose pill ("in 18 days", "tomorrow", "today") sits beside a birthday or anniversary within 30 days. Phone shows no family links; desktop shows Partner, Children, Often photographed with.
- Phone tree: the chevron shows only for someone with children ("3 children" while closed) and only opens their branch.
- Who's here? when tagging: tag_recent (tagger_id, person_id, at) is updated whenever a photo is saved with tags; chips go recent first, then family order, then everyone else A to Z. Three rows, or six that scroll after Show more.
- Photos with no name show "Untitled"; the occasion and year show beside "Added by" (photo page) and under the title (slideshow).
- settings: key and value (home_photo_id from before homepage_photos, homepage_interval, family password hash and version).

## Roadmap

In progress, one phase at a time with Mary's OK: Manage people (rename, merge duplicates, aliases), a birthday takeover and "On this day" on Home, HEIC photos from iPhones, importing Mary's existing photos (depends on how they're organized), and prayer requests (not designed yet).

Old scan dates: npm run migrate:scan-dates shows how many early uploads still carry a camera date from scanning. Run with --apply only after Mary's OK.

- Don't end updates with a "still open" list or re-ask past questions (starter family links, tree placements, Keep in prayer, person-page prayers, photo import). Mary will raise anything she wants.
