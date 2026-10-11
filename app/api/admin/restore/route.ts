import { NextResponse } from "next/server";
import { badRequest, getSession, isAdmin, unauthorized } from "@/lib/auth";
import { restore, RESTORABLE, type DeletedType } from "@/lib/deleted";

/** Recently deleted: put something back. Mary only. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!isAdmin(s)) return NextResponse.json({ error: "Only Mary can restore things." }, { status: 403 });
  const { type, id } = (await req.json().catch(() => ({}))) as { type?: string; id?: number };
  if (!RESTORABLE.includes(type as DeletedType) || !Number.isInteger(Number(id))) return badRequest("Unknown item.");
  const problem = await restore(type as DeletedType, Number(id));
  return problem ? badRequest(problem) : NextResponse.json({ ok: true });
}
