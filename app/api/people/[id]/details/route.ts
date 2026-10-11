import { NextResponse } from "next/server";
import { badRequest, canRemove, forbidden, getSession, isAdmin, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";
import { validMonthDay } from "@/lib/people";
import { capitalizeName } from "@/lib/tags";

type Ctx = { params: Promise<{ id: string }> };
type Body = {
  name?: string;
  birthday?: { month: number; day: number; year?: number | null } | null;
  address?: string | null;
  shareAddress?: boolean;
  inMemory?: boolean;
};

const cleanAddress = (a: string | null | undefined) =>
  (a ?? "").replace(/\r\n/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean).join("\n").slice(0, 500) || null;

/**
 * Save the edit page in one go. Everything is checked before anything changes.
 * Anyone can fill in a blank. Changing or clearing a value is for whoever added it, or the admin.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return unauthorized();
  const id = Number((await params).id);
  const body = (await req.json()) as Body;
  const [p] = await q<{ name: string; created_by_device: string | null; address: string | null; address_by_device: string | null; share_address: boolean; in_memory: boolean; in_memory_by_device: string | null }>(
    `select name, created_by_device, address, address_by_device, share_address, in_memory, in_memory_by_device from people where id = $1 and deleted_at is null`, [id]);
  if (!p) return NextResponse.json({ error: "Person not found." }, { status: 404 });
  const [bday] = await q<{ id: number; month: number; day: number; year: number | null; created_by_device: string | null }>(
    `select id, month, day, year, created_by_device from birthdays where person_id = $1 and deleted_at is null`, [id]);

  const people: string[] = [];
  const vals: unknown[] = [];
  const set = (col: string, v: unknown) => { vals.push(v); people.push(`${col} = $${vals.length}`); };
  let birthday: "keep" | "remove" | { month: number; day: number; year: number | null } = "keep";

  if (body.name !== undefined) {
    const name = capitalizeName(body.name.trim().replace(/\s+/g, " ").slice(0, 80));
    if (!name) return badRequest("Name can't be empty.");
    if (name !== p.name) {
      if (!canRemove(s, p.created_by_device)) return forbidden();
      const [taken] = await q(`select 1 from people where deleted_at is null and id <> $1 and lower(name) = lower($2)`, [id, name]);
      if (taken) return NextResponse.json({ error: `Someone else is already named ${name}.` }, { status: 409 });
      set("name", name);
    }
  }

  if (body.birthday !== undefined) {
    if (body.birthday === null) {
      if (bday) { if (!canRemove(s, bday.created_by_device)) return forbidden(); birthday = "remove"; }
    } else {
      const m = Number(body.birthday.month), d = Number(body.birthday.day);
      const y = body.birthday.year ? Number(body.birthday.year) : null;
      if (!validMonthDay(m, d)) return badRequest("That birthday doesn't exist.");
      if (y !== null && (!Number.isInteger(y) || y < 1850 || y > new Date().getFullYear())) return badRequest("That birth year doesn't look right.");
      const changed = !bday || bday.month !== m || bday.day !== d || bday.year !== y;
      if (changed) {
        if (bday && !canRemove(s, bday.created_by_device)) return forbidden();
        birthday = { month: m, day: d, year: y };
      }
    }
  }

  const ownsAddress = !p.address || canRemove(s, p.address_by_device);
  const hidden = !!p.address && !p.share_address && !isAdmin(s);
  if (body.address !== undefined) {
    const next = cleanAddress(body.address);
    if (next !== p.address) {
      if (!ownsAddress || hidden) return forbidden();
      set("address", next);
      set("address_updated_at", next ? new Date().toISOString() : null);
      set("address_by_device", next ? (p.address ? p.address_by_device ?? s.did : s.did) : null);
    }
  }
  if (body.shareAddress !== undefined && body.shareAddress !== p.share_address) {
    if (!ownsAddress) return forbidden();
    set("share_address", !!body.shareAddress);
  }
  if (body.inMemory !== undefined && body.inMemory !== p.in_memory) {
    if (p.in_memory && !canRemove(s, p.in_memory_by_device)) return forbidden();
    set("in_memory", !!body.inMemory);
    set("in_memory_by_device", body.inMemory ? s.did : null);
  }

  if (people.length) {
    vals.push(id);
    await q(`update people set ${people.join(", ")} where id = $${vals.length}`, vals);
  }
  if (birthday === "remove") await q(`update birthdays set deleted_at = now(), deleted_by_name = $2 where id = $1`, [bday!.id, s?.name ?? null]);
  else if (birthday !== "keep") {
    if (bday) await q(`update birthdays set month = $1, day = $2, year = $3 where id = $4`, [birthday.month, birthday.day, birthday.year, bday.id]);
    else await q(`insert into birthdays (person_id, month, day, year, created_by_device, created_by_name) values ($1,$2,$3,$4,$5,$6)`,
      [id, birthday.month, birthday.day, birthday.year, s.did, s.name]);
  }
  return NextResponse.json({ ok: true });
}
