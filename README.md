# Dunya Family

A private family site for photos, birthdays, and gatherings. One shared family password, no personal accounts.

## What's built

- **Come in:** the family password, then "Which one is you?" Pick yourself from the family, or add your name. A device id cookie records who added what. Five wrong passwords from one place in 15 minutes means a 15-minute wait.
- **Account menu and You page:** your page, your details, your calendar, switch person (same device, someone else), and log out.
- **Home:** a polaroid of Mamaw, featured albums (Mamaw through the years, shared albums, then albums built from occasions and seasons), recently added, and a needs-tags nudge.
- **Browse:** sidebar filters for people, occasions, decades, and albums, shown as removable chips. Checking several people means photos with all of them. Free-text search turns names, occasions, years, and decades into filters. Select mode changes many photos at once: set a year or decade, add an occasion, a person, or an album, or remove.
- **Add photos:** drag in a batch, set a shared album, year, and occasion for all of them. The "scans or photos of old prints" switch ignores camera dates. Thumbnails are made in the browser. After upload, tagging opens for that batch.
- **Tag photos:** one photo at a time, with people as chips, year, occasion, and Previous, Skip, and Save & next.
- **Photo page:** who's here, year and occasion, a note, albums it's in, add to an album, use as a profile photo, download the original, and delete. Previous and next follow the view you came from.
- **Albums:** shared albums like "Memrie's wedding." Anyone can start one or add to one.
- **Family:** a tree growing from Dunya (children with partners, grandchildren, and deeper branches on request), earlier generations, find a person, groups for extended family, family friends, and people not in the tree yet, and everyone A to Z. Relationships are added on Edit a person or when adding someone.
- **Person pages:** profile photo, birthday, mailing address with copy, anniversary, coming up, family, often photographed with, and their photos. Edit a person covers name, birthday with optional year, address with a share switch, important dates, family, in memory, and removing them.
- **Birthdays and gatherings:** a month calendar with colored dots, upcoming birthday cards ("Turns 52" when a birth year is saved), gatherings with edit and delete, an address book, and a calendar feed for Google, Apple, and Outlook.
- **Admin (Mary):** Recently deleted with Restore, and changing the family password.

## Permissions

- Anyone with the family password can add photos, tags, people, birthdays, dates, gatherings, albums, and family relationships.
- People can edit or remove what their own device added. Filling in something blank (a year, a first profile photo) is open to everyone; changing what someone else set is not.
- Whoever started an album, or Mary, can rename or delete it. Taking a photo out of an album is for whoever put it there, whoever started the album, or Mary. The photo stays on the site.
- The admin password (Mary) can edit and remove anything, and sees the Admin section.
- Removals are soft deletes (deleted_at, deleted_by_name). Mary can restore anything from Recently deleted for 30 days, and older removals are still in the database. Photo files are never deleted from R2.

## Setup

1. Install: npm install
2. Database: create a Neon Postgres database. Put the URL in .env as DATABASE_URL, then run npm run db:setup
3. Photo storage: create a Cloudflare R2 bucket. Keep public access off. Create an R2 API token with read and write on that bucket. Add the CORS policy below so browsers can upload directly.
4. Passwords: run npm run hash-password -- "family password" and npm run hash-password -- "admin password". Paste the outputs into FAMILY_PASSWORD_HASH and ADMIN_PASSWORD_HASH. After that, Mary can change the family password from the site (Admin, Family password).
5. Secrets: SESSION_SECRET from openssl rand -base64 48, CALENDAR_TOKEN from openssl rand -hex 24
6. Run locally: npm run dev
7. Deploy: push to GitHub, import into Vercel, and add the same environment variables. Every production build runs the database setup first, so new tables and columns are added before the new code goes live. Make a Neon backup branch before publishing a change that touches db/schema.sql.

R2 CORS policy (replace the domain):

```json
[
  {
    "AllowedOrigins": ["https://dunyafamily-nine.vercel.app", "http://localhost:3000"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

## Privacy notes

- The R2 bucket is private. Images are only reachable through signed links that expire after an hour, and those links are only generated after the password check.
- Every page sends noindex headers and robots.txt disallows everything.
- The calendar feed is reachable without the password, so it uses a long random token and contains only names, dates, and optional times. Addresses and notes stay on the site.
- Changing the family password from the site signs out every family device. The admin stays signed in. Rotating SESSION_SECRET signs out everyone, admin included.
- Addresses marked not shared are visible only to Mary.
