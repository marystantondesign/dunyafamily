import { NextResponse } from "next/server";
import { badRequest, getSession, unauthorized } from "@/lib/auth";
import { addRecipe, type RecipeInput } from "@/lib/recipes";

/** Save a new recipe. Anyone in the family can. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  const id = await addRecipe((await req.json().catch(() => ({}))) as RecipeInput, s);
  return typeof id === "number" ? NextResponse.json({ id }) : badRequest(id);
}
