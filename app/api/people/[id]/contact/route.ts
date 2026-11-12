import { NextResponse } from "next/server";
import { badRequest, forbidden, getSession, isAdmin, unauthorized } from "@/lib/auth";
import { addressText, normalizeState, phoneDigits, titleCase, validEmail } from "@/lib/contact";
import { q } from "@/lib/db";

type Body = {
  address?: { street?: string; apt?: string; city?: string; state?: string; zip?: string };
  email?: string; phone?: string; share?: boolean;
};

/**
 * Save someone's mailing address (in parts), email, and phone, and whether they're shared with the family. For the
 * person themselves or the admin. The one-block address column is rewritten from the parts so everything that
 * reads it keeps working.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return unauthorized();
  const id = Number((await params).id);
  if (!isAdmin(s) && s.pid !== id) return forbidden();
  const [p] = await q<{ in_memory: boolean }>(`select in_memory from people where id = $1 and deleted_at is null`, [id]);
  if (!p) return NextResponse.json({ error: "Person not found." }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as Body;

  const a = b.address ?? {};
  const street = titleCase(String(a.street ?? "").slice(0, 200));
  const apt = titleCase(String(a.apt ?? "").slice(0, 60));
  const city = titleCase(String(a.city ?? "").slice(0, 100));
  const stateIn = String(a.state ?? "").trim();
  const state = stateIn ? normalizeState(stateIn) : "";
  const zip = String(a.zip ?? "").trim();
  const any = !!(street || apt || city || stateIn || zip);
  if (any) {
    if (!street) return badRequest("Add the street address.");
    if (!city) return badRequest("Add the city.");
    if (!state) return badRequest("Use a two-letter state, like MS.");
    if (!/^\d{5}(-\d{4})?$/.test(zip)) return badRequest("ZIP should be 5 digits, like 39564.");
  }
  const email = String(b.email ?? "").trim().slice(0, 200);
  if (email && !validEmail(email)) return badRequest("That email doesn't look right.");
  const phone = phoneDigits(String(b.phone ?? "").slice(0, 40));
  if (phone === null) return badRequest("That phone number doesn't look right. Try (555) 555-5555.");

  const parts = { street, apt, city, state, zip };
  // No address in the request: the address fields weren't touched, so whatever is stored (even an old address that
  // couldn't be read into parts) stays exactly as it is.
  const touch = b.address !== undefined;
  await q(
    `update people set
            addr_street = case when $12 then $2 else addr_street end, addr_apt = case when $12 then $3 else addr_apt end,
            addr_city = case when $12 then $4 else addr_city end, addr_state = case when $12 then $5 else addr_state end,
            addr_zip = case when $12 then $6 else addr_zip end, address = case when $12 then $7 else address end,
            email = $8, phone = $9, share_address = coalesce($10, share_address),
            address_updated_at = now(), address_by_device = coalesce(address_by_device, $11)
      where id = $1`,
    [id, street || null, apt || null, city || null, state || null, zip || null, any ? addressText(parts) : null,
      email || null, phone || null, typeof b.share === "boolean" ? b.share : null, s.did, touch]);
  return NextResponse.json({ ok: true });
}
