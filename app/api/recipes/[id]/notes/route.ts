import { NextResponse } from "next/server";
import { badRequest, getSession, unauthorized } from "@/lib/auth";
import { addNote } from "@/lib/recipes";

/** Add a note under a recipe. Anyone in the family can. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return unauthorized();
  const id = await addNote(Number((await params).id), (await req.json().catch(() => ({}))) as { text?: string; photoKey?: string }, s);
  return typeof id === "number" ? NextResponse.json({ id }) : badRequest(id);
}
