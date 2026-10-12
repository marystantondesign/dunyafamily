import Link from "next/link";
import { notFound } from "next/navigation";
import { Face } from "@/components/RecipeBox";
import { RecipeBody, RecipeMenu, RecipeNotes } from "@/components/RecipeParts";
import { RecipeCardImage } from "@/components/Sketches";
import { getSession } from "@/lib/auth";
import { recipeNotes, recipePage } from "@/lib/recipes";

export const dynamic = "force-dynamic";

const fullDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });

/** One recipe: the card, who it's from, ingredients and method, and notes from the family. */
export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const s = await getSession();
  const [r, notes] = await Promise.all([recipePage(id, s), recipeNotes(id, s)]);
  if (!r) notFound();
  return (
    <div className="rd">
      <Link href="/recipes" className="rb-back desktop-only">&larr; Recipes</Link>
      <div className="rd-top">
        <div className="rd-card">
          <RecipeCardImage url={r.photoUrl} title={r.title} className="big" />
          <p className="rd-added">Added by {r.addedBy}, {fullDate(r.createdAt)}</p>
        </div>
        <div className="rd-info">
          <div className="rd-title-row">
            <h1>{r.title}</h1>
            {r.canEdit && <RecipeMenu id={r.id} title={r.title} />}
          </div>
          {r.from && (r.from.personId ? (
            <Link href={`/people/${r.from.personId}`} className="rd-from"><Face from={r.from} size={36} /><span>From {r.from.name}</span></Link>
          ) : (
            <span className="rd-from"><Face from={r.from} size={36} /><span>From {r.from.name}</span></span>
          ))}
          {r.intro && <p className="rd-intro">&ldquo;{r.intro.replace(/^["“]|["”]$/g, "")}&rdquo;</p>}
          {r.steps.length > 0 && (
            <div className="rd-start">
              <Link href={`/recipes/${r.id}/cook`} className="btn btn-primary"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M8 5l11 7-11 7z" /></svg>Start cooking</Link>
              <span className="desktop-only">One step at a time, screen stays on</span>
            </div>
          )}
          {r.servings && <p className="rd-serves">{r.servings}</p>}
        </div>
      </div>
      <RecipeBody id={r.id} ingredients={r.ingredients} steps={r.steps} />
      <RecipeNotes recipeId={r.id} notes={notes} />
    </div>
  );
}
