import { canRemove, isAdmin } from "./auth";
import { q } from "./db";
import type { Session } from "./session";

export const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
export const DATE_KINDS = ["anniversary", "remembrance", "other"] as const;
export type DateKind = (typeof DATE_KINDS)[number];

/** "June 2", or "June 2, 1962" when the year is known. */
export const monthDay = (month: number, day: number, year?: number | null) =>
  `${MONTHS[month - 1]} ${day}${year ? `, ${year}` : ""}`;
export const shortMonthDay = (month: number, day: number) =>
  new Date(2000, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export const validMonthDay = (m: number, d: number) =>
  m >= 1 && m <= 12 && d >= 1 && d <= 31 && new Date(2000, m - 1, d).getMonth() === m - 1;

function nextOccurrence(month: number, day: number, now: Date) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(today.getFullYear(), month - 1, day);
  if (next < today) next = new Date(today.getFullYear() + 1, month - 1, day);
  return { next, inDays: Math.round((next.getTime() - today.getTime()) / 86_400_000) };
}

export type UpcomingDate = {
  id: number; person_id: number; name: string; in_memory: boolean; kind: DateKind; label: string;
  month: number; day: number; year: number | null; next: Date; inDays: number;
};

/** Anniversaries, remembrances, and other dates, soonest first. */
export async function importantDates(now = new Date()): Promise<UpcomingDate[]> {
  const rows = await q<Omit<UpcomingDate, "next" | "inDays">>(
    `select d.id, d.person_id, pe.name, pe.in_memory, d.kind, d.label, d.month, d.day, d.year
       from person_dates d join people pe on pe.id = d.person_id
      where d.deleted_at is null and pe.deleted_at is null`,
  );
  return rows.map((r) => ({ ...r, ...nextOccurrence(r.month, r.day, now) })).sort((a, b) => a.inDays - b.inDays);
}

export type PersonDetails = {
  id: number;
  name: string;
  avatarPhotoId: number | null;
  /** Rename and remove: whoever added the person, or the admin. */
  canRename: boolean;
  canRemovePerson: boolean;
  /** Anyone can pick a first profile photo; changing it is for whoever added the person, or the admin. */
  canChangePhoto: boolean;
  birthday: { id: number; month: number; day: number; year: number | null; removable: boolean } | null;
  /** Null when there is none, or when it isn't shared and the viewer isn't the admin. */
  address: string | null;
  addressHidden: boolean;
  addressUpdatedAt: string | null;
  canEditAddress: boolean;
  shareAddress: boolean;
  inMemory: boolean;
  canChangeMemory: boolean;
  dates: { id: number; kind: DateKind; label: string; month: number; day: number; year: number | null; removable: boolean }[];
};

export async function personDetails(id: number, s: Session | null): Promise<PersonDetails | null> {
  const [p] = await q<{ name: string; avatar_photo_id: number | null; created_by_device: string | null; address: string | null; address_updated_at: string | null; address_by_device: string | null; share_address: boolean; in_memory: boolean; in_memory_by_device: string | null }>(
    `select name, avatar_photo_id, created_by_device, address, address_updated_at, address_by_device, share_address, in_memory, in_memory_by_device
       from people where id = $1 and deleted_at is null`, [id]);
  if (!p) return null;
  const [[b], dates] = await Promise.all([
    q<{ id: number; month: number; day: number; year: number | null; created_by_device: string | null }>(
      `select id, month, day, year, created_by_device from birthdays where person_id = $1 and deleted_at is null`, [id]),
    q<{ id: number; kind: DateKind; label: string; month: number; day: number; year: number | null; created_by_device: string | null }>(
      `select id, kind, label, month, day, year, created_by_device from person_dates
        where person_id = $1 and deleted_at is null order by month, day`, [id]),
  ]);
  const hidden = !!p.address && !p.share_address && !isAdmin(s);
  const ownsPerson = canRemove(s, p.created_by_device);
  return {
    id,
    name: p.name,
    avatarPhotoId: p.avatar_photo_id,
    canRename: ownsPerson,
    canRemovePerson: ownsPerson,
    canChangePhoto: !p.avatar_photo_id || ownsPerson,
    birthday: b ? { id: b.id, month: b.month, day: b.day, year: b.year, removable: canRemove(s, b.created_by_device) } : null,
    address: hidden ? null : p.address,
    addressHidden: hidden,
    addressUpdatedAt: hidden ? null : p.address_updated_at,
    canEditAddress: !hidden && (!p.address || canRemove(s, p.address_by_device)),
    shareAddress: p.share_address,
    inMemory: p.in_memory,
    canChangeMemory: !p.in_memory || canRemove(s, p.in_memory_by_device),
    dates: dates.map(({ created_by_device, ...d }) => ({ ...d, removable: canRemove(s, created_by_device) })),
  };
}

/** The soonest of someone's birthday and important dates, within the next two months. */
export function comingUp(det: PersonDetails, now = new Date()) {
  const all = [
    ...(det.birthday ? [{ title: det.inMemory ? "Birthday, a day to remember" : "Birthday", month: det.birthday.month, day: det.birthday.day }] : []),
    ...det.dates.map((d) => ({ title: d.kind === "anniversary" ? "Anniversary" : d.label, month: d.month, day: d.day })),
  ].map((x) => ({ ...x, ...nextOccurrence(x.month, x.day, now) })).filter((x) => x.inDays <= 60).sort((a, b) => a.inDays - b.inDays);
  return all[0] ?? null;
}

export type AddressRow = { id: number; name: string; address: string | null; updated_at: string | null; shared: boolean };

/** Everyone with a mailing address, by name. Addresses that aren't shared show only to the admin. */
export async function addressBook(s: Session | null): Promise<AddressRow[]> {
  const rows = await q<{ id: number; name: string; address: string; address_updated_at: string | null; share_address: boolean }>(
    `select id, name, address, address_updated_at, share_address from people
      where deleted_at is null and not in_memory and coalesce(trim(address), '') <> '' order by lower(name)`,
  );
  return rows.map((r) => {
    const visible = r.share_address || isAdmin(s);
    return { id: r.id, name: r.name, address: visible ? r.address : null, updated_at: visible ? r.address_updated_at : null, shared: r.share_address };
  });
}

export const updatedLabel = (at: string | Date | null) =>
  at ? `Updated ${new Date(at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}` : null;
