import { NextResponse } from "next/server";
import { badRequest, canRemove, forbidden, getSession, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";
import { addRelation } from "@/lib/family";

type Body = { kind: "parent" | "child" | "partner"; other: number | string } | { kind: "friend"; on: boolean };

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return unauthorized();
  const id = Number((await params).id);
  const body = (await req.json().catch(() => ({}))) as Body;
  if (body.kind === "friend") {
    const [p] = await q<{ family_friend_by_device: string | null; created_by_device: string | null }>(
      `select family_friend_by_device, created_by_device from people where id = $1 and deleted_at is null`, [id]);
    if (!p) return badRequest("That person isn't in the family anymore.");
    // Anyone can mark a friend of the family. Taking it off is for whoever marked it, whoever added them, or Mary.
    if (!body.on && !canRemove(s, p.family_friend_by_device) && !canRemove(s, p.created_by_device)) return forbidden();
    await q(`update people set family_friend = $1, family_friend_by_device = $2 where id = $3`, [!!body.on, body.on ? s.did : null, id]);
    return NextResponse.json({ ok: true });
  }
  if (!["parent", "child", "partner"].includes(body.kind)) return badRequest("Unknown relationship.");
  const error = await addRelation(id, body.kind, body.other, s);
  return error ? badRequest(error) : NextResponse.json({ ok: true });
}
