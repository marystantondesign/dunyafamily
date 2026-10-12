import { NextResponse } from "next/server";
import { badRequest, forbidden, getSession, unauthorized } from "@/lib/auth";
import { removeNote } from "@/lib/recipes";

/** Delete a note. Whoever wrote it, or the admin. It goes to Recently deleted. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return unauthorized();
  const r = await removeNote(Number((await params).id), s);
  if (r === "missing") return badRequest("That note isn't here anymore.");
  if (r === "forbidden") return forbidden();
  return NextResponse.json({ ok: true });
}
