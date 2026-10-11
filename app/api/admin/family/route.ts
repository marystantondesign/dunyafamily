import { NextResponse } from "next/server";
import { badRequest, getSession, isAdmin, unauthorized } from "@/lib/auth";
import { connect, disconnect, ROLES, setBirth, setOrder, setRole, type Role } from "@/lib/familyAdmin";

type Body =
  | { action: "connect"; personId: number; other: number | string; role: Role; birth?: string }
  | { action: "role"; personId: number; otherId: number; role: Role }
  | { action: "birth"; personId: number; value: string }
  | { action: "order"; ids: number[] }
  | { action: "remove"; personId: number; otherId: number; kind: "parent" | "child" | "partner" | "sibling" };

/** The family tree editor (admin only). Every change saves right away. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!isAdmin(s)) return NextResponse.json({ error: "Only Mary can edit the family tree." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Body;
  let problem: string | null = null;
  switch (b.action) {
    case "connect":
      if (!ROLES.includes(b.role)) return badRequest("Choose how they're related.");
      problem = await connect(Number(b.personId), typeof b.other === "number" ? b.other : String(b.other ?? ""), b.role, b.birth ?? "", s);
      break;
    case "role":
      if (!ROLES.includes(b.role)) return badRequest("Choose how they're related.");
      await setRole(Number(b.personId), Number(b.otherId), b.role);
      break;
    case "birth": problem = await setBirth(Number(b.personId), String(b.value ?? ""), s); break;
    case "order": await setOrder((b.ids ?? []).map(Number).filter(Number.isInteger)); break;
    case "remove":
      if (!["parent", "child", "partner", "sibling"].includes(b.kind)) return badRequest("Unknown connection.");
      await disconnect(Number(b.personId), Number(b.otherId), b.kind, s);
      break;
    default: return badRequest("Unknown change.");
  }
  return problem ? badRequest(problem) : NextResponse.json({ ok: true });
}
