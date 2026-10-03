# Dunya Family

A private family site for photos, birthdays, and gatherings. One shared family password, no accounts.

## What's built

- Password gate with a name prompt. A device id cookie records who added what.
- Homepage: a seasonal lead section (upcoming holiday, then this month in past years, then this season), upcoming birthdays and gatherings, family row, browse pills, recently added, and a needs-tags nudge.
- Browse: combinable pills for people, occasions, and decades (AND logic). Free-text search turns names, occasions, years, and decades into pills.
- Person pages grouped by decade, with "Often photographed with."
- Photo pages: add people and occasions, fill in year or decade, add a note, set a profile photo.
- Bulk upload: drag in a batch, tag the whole batch at once. Camera dates are read automatically. Thumbnails are made in the browser.
- Birthdays (month and day only) and gatherings, plus a calendar subscription feed for Google, Apple, and Outlook.

## Permissions

- Anyone with the family password can add photos, tags, birthdays, and gatherings.
- People can remove only what their own device added.
- The admin password can edit and remove anything.
- Removals are soft deletes (deleted_at), so nothing is lost.

## Setup

1. Install: npm install
2. Database: create a Neon Postgres database (Vercel > Storage > Neon works). Put the URL in .env as DATABASE_URL, then run npm run db:setup
3. Photo storage: create a Cloudflare R2 bucket. Keep public access off. Create an R2 API token with read and write on that bucket. Add the CORS policy below so browsers can upload directly.
4. Passwords: run npm run hash-password -- "family password" and npm run hash-password -- "admin password". Paste the outputs into FAMILY_PASSWORD_HASH and ADMIN_PASSWORD_HASH.
5. Secrets: SESSION_SECRET from openssl rand -base64 48, CALENDAR_TOKEN from openssl rand -hex 24
6. Run locally: npm run dev
7. Deploy: push to GitHub, import into Vercel, and add the same environment variables.

R2 CORS policy (replace the domain):

```json
[
  {
    "AllowedOrigins": ["https://dunyafamily.com", "http://localhost:3000"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

## Privacy notes

- The R2 bucket is private. Images are only reachable through signed links that expire after an hour, and those links are only generated after the password check.
- Every page sends noindex headers and robots.txt disallows everything.
- The calendar feed is reachable without the password, so it uses a long random token and contains only names, dates, and optional times. Addresses and notes stay on the site.
- Changing the family password does not sign out existing devices. Rotate SESSION_SECRET to sign everyone out.
