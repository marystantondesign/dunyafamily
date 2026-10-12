import Link from "next/link";
import { notFound } from "next/navigation";
import { EditRecipe } from "@/components/RecipeForm";
import { getSession } from "@/lib/auth";
import { recipePage, recipePeople } from "@/lib/recipes";

export const dynamic = "force-dynamic";

/** Edit a recipe: only whoever added it, or the admin. */
export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const s = await getSession();
  const [r, people] = await Promise.all([recipePage(id, s), recipePeople()]);
  if (!r || !r.canEdit) notFound();
  return (
    <div className="ra">
      <Link href={`/recipes/${id}`} className="rb-back desktop-only">&larr; {r.title}</Link>
      <h1>Edit recipe</h1>
      <EditRecipe id={id} people={people} initial={{
        title: r.title, personId: r.personIdRaw, fromName: r.fromName ?? "", intro: r.intro ?? "", servings: r.servings ?? "",
        ingredients: r.ingredients, steps: r.steps, cardPhotoKey: r.photoKey, cardPhotoUrl: r.photoUrl,
      }} />
    </div>
  );
}
