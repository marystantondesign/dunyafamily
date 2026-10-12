import { NextResponse } from "next/server";
import { badRequest, forbidden, getSession, unauthorized } from "@/lib/auth";
import { editable, editRequest, removeRequest, setAnswered, type PrayerInput } from "@/lib/prayer";

async function check(params: Promise<{ id: string }>) {
  const s = await getSession();
  if (!s) return { error: unauthorized() };
  const id = Number((await params).id);
  const ok = await editable(id, s);
  if (ok === "missing") return { error: badRequest("That request isn't here anymore.") };
  if (ok === "forbidden") return { error: forbidden() };
  return { s, id };
}

/** Edit, mark answered, or undo answered. Whoever posted it, or the admin. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await check(params);
  if ("error" in c) return c.error;
  const body = (await req.json().catch(() => ({}))) as PrayerInput & { answered?: boolean; update?: string };
  if (typeof body.answered === "boolean") {
    await setAnswered(c.id, body.answered, body.update);
    return NextResponse.json({ ok: true });
  }
  const err = await editRequest(c.id, body);
  return err ? badRequest(err) : NextResponse.json({ ok: true });
}

/** Remove a request. It goes to Recently deleted. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await check(params);
  if ("error" in c) return c.error;
  await removeRequest(c.id, c.s);
  return NextResponse.json({ ok: true });
}
