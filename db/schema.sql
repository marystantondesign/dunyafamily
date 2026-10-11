create table if not exists people (
  id serial primary key,
  name text not null,
  aliases text[] not null default '{}',
  avatar_photo_id int,
  created_by_device text,
  created_by_name text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists people_name_unique on people (lower(name)) where deleted_at is null;

create table if not exists occasions (
  id serial primary key,
  name text not null,
  kind text not null default 'occasion', -- holiday | season | occasion
  created_by_device text,
  created_at timestamptz not null default now()
);
create unique index if not exists occasions_name_unique on occasions (lower(name));

create table if not exists photos (
  id serial primary key,
  original_key text not null,
  thumb_key text not null,
  width int,
  height int,
  taken_on date,
  year int,
  month int check (month between 1 and 12),
  decade int,
  caption text,
  uploaded_by_device text not null,
  uploaded_by_name text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists photos_year on photos (year);
create index if not exists photos_month on photos (month);
create index if not exists photos_decade on photos (decade);
create index if not exists photos_created on photos (created_at desc);
-- Groups the photos from one upload so the batch can be found again (tagging mode).
alter table photos add column if not exists upload_batch uuid;
create index if not exists photos_upload_batch on photos (upload_batch);

create table if not exists photo_people (
  photo_id int not null references photos(id),
  person_id int not null references people(id),
  added_by_device text,
  primary key (photo_id, person_id)
);
create index if not exists photo_people_person on photo_people (person_id);
-- When a tag was added, so tagging mode can put the people you tagged most recently first.
alter table photo_people add column if not exists added_at timestamptz not null default now();

create table if not exists photo_occasions (
  photo_id int not null references photos(id),
  occasion_id int not null references occasions(id),
  added_by_device text,
  primary key (photo_id, occasion_id)
);
create index if not exists photo_occasions_occasion on photo_occasions (occasion_id);

create table if not exists birthdays (
  id serial primary key,
  person_id int not null references people(id),
  month int not null check (month between 1 and 12),
  day int not null check (day between 1 and 31),
  created_by_device text,
  created_by_name text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists birthdays_one_per_person on birthdays (person_id) where deleted_at is null;

create table if not exists gatherings (
  id serial primary key,
  title text not null,
  date date not null,
  time_note text,
  location text,
  notes text,
  created_by_device text,
  created_by_name text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists gatherings_date on gatherings (date);

insert into occasions (name, kind) values
  ('Christmas','holiday'), ('Thanksgiving','holiday'), ('Halloween','holiday'),
  ('New Year''s','holiday'), ('Easter','holiday'), ('Fourth of July','holiday'),
  ('Birthday','occasion'), ('Wedding','occasion'), ('Graduation','occasion'), ('Vacation','occasion'),
  ('Spring','season'), ('Summer','season'), ('Autumn','season'), ('Winter','season')
on conflict do nothing;

-- Person details (phase 4). Whoever adds a value owns it: anyone can fill in a blank,
-- and changing or clearing it is for that device or the admin.
alter table people add column if not exists address text;
alter table people add column if not exists address_updated_at timestamptz;
alter table people add column if not exists address_by_device text;
-- When false, the address is hidden from everyone except the admin.
alter table people add column if not exists share_address boolean not null default true;
alter table people add column if not exists in_memory boolean not null default false;
alter table people add column if not exists in_memory_by_device text;

-- Important dates besides birthdays: anniversaries, remembrances, and anything else worth marking.
create table if not exists person_dates (
  id serial primary key,
  person_id int not null references people(id),
  kind text not null default 'other', -- anniversary | remembrance | other
  label text not null,
  month int not null check (month between 1 and 12),
  day int not null check (day between 1 and 31),
  year int,
  created_by_device text,
  created_by_name text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists person_dates_person on person_dates (person_id);

-- Optional birth year. Only used to show "Turns 52" on birthday cards when it's saved.
alter table birthdays add column if not exists year int;

-- Site-wide settings, like which photo leads the homepage. One row per setting.
create table if not exists settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

-- Shared albums, like "Memrie's wedding". Separate from occasions. Anyone can add photos to any album.
create table if not exists albums (
  id serial primary key,
  title text not null,
  cover_photo_id int,
  created_by_device text,
  created_by_name text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table if not exists album_photos (
  album_id int not null references albums(id),
  photo_id int not null references photos(id),
  added_by_device text,
  added_at timestamptz not null default now(),
  primary key (album_id, photo_id)
);
create index if not exists album_photos_photo on album_photos (photo_id);

-- Family tree. kind 'parent': person_id is a parent of related_id. kind 'partner': a couple, saved with the lower id first.
create table if not exists relationships (
  id serial primary key,
  person_id int not null references people(id),
  related_id int not null references people(id),
  kind text not null,
  created_by_device text,
  created_by_name text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists relationships_person on relationships (person_id);
create index if not exists relationships_related on relationships (related_id);
create unique index if not exists relationships_unique on relationships (kind, person_id, related_id) where deleted_at is null;
-- Friends of the family have no relatives in the tree but still belong here.
alter table people add column if not exists family_friend boolean not null default false;
alter table people add column if not exists family_friend_by_device text;

-- Who removed something, for Recently deleted.
alter table photos add column if not exists deleted_by_name text;
alter table people add column if not exists deleted_by_name text;
alter table albums add column if not exists deleted_by_name text;
alter table birthdays add column if not exists deleted_by_name text;
alter table gatherings add column if not exists deleted_by_name text;
alter table person_dates add column if not exists deleted_by_name text;
alter table relationships add column if not exists deleted_by_name text;

-- Wrong family passwords in the last little while, so repeated guessing gets slowed down.
create table if not exists login_attempts (
  id serial primary key,
  key text not null,
  at timestamptz not null default now()
);
create index if not exists login_attempts_key on login_attempts (key, at);

-- The photos that fade through the Polaroid on Home, in order, each with a handwritten caption. Up to 10, admin only.
-- The speed lives in settings (homepage_interval, in seconds).
create table if not exists homepage_photos (
  photo_id int primary key references photos(id),
  caption text,
  position int not null default 0,
  created_by_device text,
  created_at timestamptz not null default now()
);

-- An optional name for a photo ("Afreen at the bead shop"). When blank, the occasion and year show instead.
alter table photos add column if not exists title text;

-- Comments on photos. Whoever wrote one, or Mary, can delete it (soft, restorable).
create table if not exists photo_comments (
  id serial primary key,
  photo_id int not null references photos(id),
  body text not null,
  author_name text,
  author_pid int,
  created_by_device text,
  from_note boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by_name text
);
create index if not exists photo_comments_photo on photo_comments (photo_id);

-- Notes written before comments existed become the first comment on their photo, from whoever uploaded it.
-- The note itself stays on the photo. This only ever copies a note once.
insert into photo_comments (photo_id, body, author_name, created_by_device, from_note, created_at)
select p.id, p.caption, p.uploaded_by_name, p.uploaded_by_device, true, p.created_at from photos p
 where coalesce(trim(p.caption), '') <> '' and not exists (select 1 from photo_comments c where c.photo_id = p.id and c.from_note);

-- One of each emoji per device per photo. Tapping it again takes it back.
create table if not exists photo_reactions (
  photo_id int not null references photos(id),
  emoji text not null,
  created_by_device text not null,
  author_name text,
  author_pid int,
  created_at timestamptz not null default now(),
  primary key (photo_id, emoji, created_by_device)
);

-- Family tree editing (admin). Gender only picks the word: mother or father, sister or brother, daughter or son.
alter table people add column if not exists gender text;
-- Birth year for ordering children and siblings oldest first; birth_order places anyone without a year.
alter table people add column if not exists birth_year int;
alter table people add column if not exists birth_order int;
-- 'spouse' or 'partner' on partner links. Sibling links (kind 'sibling', lower id first) cover brothers and sisters whose parents aren't in the tree.
alter table relationships add column if not exists label text;
