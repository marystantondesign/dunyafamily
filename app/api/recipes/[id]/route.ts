import { NextResponse } from "next/server";
import { badRequest, forbidden, getSession, unauthorized } from "@/lib/auth";
import { editRecipe, recipeEditable, removeRecipe, type RecipeInput } from "@/lib/recipes";

async function check(params: Promise<{ id: string }>) {
  const s = await getSession();
  if (!s) return { error: unauthorized() };
  const id = Number((await params).id);
  const ok = Number.isInteger(id) ? await recipeEditable(id, s) : "missing";
  if (ok === "missing") return { error: badRequest("That recipe isn't here anymore.") };
  if (ok === "forbidden") return { error: forbidden() };
  return { s, id };
}

/** Change a recipe. Whoever added it, or the admin. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await check(params);
  if ("error" in c) return c.error;
  const err = await editRecipe(c.id, (await req.json().catch(() => ({}))) as RecipeInput);
  return err ? badRequest(err) : NextResponse.json({ ok: true });
}

/** Take a recipe out of the box. It goes to Recently deleted. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await check(params);
  if ("error" in c) return c.error;
  await removeRecipe(c.id, c.s);
  return NextResponse.json({ ok: true });
}
