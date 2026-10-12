import { notFound, redirect } from "next/navigation";
import { CookMode } from "@/components/CookMode";
import { getSession } from "@/lib/auth";
import { recipePage } from "@/lib/recipes";

export const dynamic = "force-dynamic";

export default async function CookPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const r = await recipePage(id, await getSession());
  if (!r) notFound();
  if (!r.steps.length) redirect(`/recipes/${id}`);
  return <CookMode id={r.id} title={r.title} steps={r.steps} ingredients={r.ingredients} />;
}
