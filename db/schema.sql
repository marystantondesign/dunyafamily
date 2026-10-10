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
