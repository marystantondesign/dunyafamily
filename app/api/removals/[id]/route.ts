import { NextResponse } from "next/server";
import { badRequest, getSession } from "@/lib/auth";
import { decideRemoval } from "@/lib/removals";
import { adminOr404 } from "@/lib/storySave";

/** Mary only: decide a removal request ({ action: "remove" | "untag" | "keep" }). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const no = await adminOr404();
  if (no) return no;
  const s = (await getSession())!;
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  if (action !== "remove" && action !== "untag" && action !== "keep") return badRequest("Choose what to do.");
  const err = await decideRemoval(Number((await params).id), action, s);
  return err ? badRequest(err) : NextResponse.json({ ok: true });
}
