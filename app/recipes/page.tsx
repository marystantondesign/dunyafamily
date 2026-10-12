import Link from "next/link";
import { Icon } from "@/components/Icon";
import { RecipeGrid } from "@/components/RecipeBox";
import { RecipeBoxSketch } from "@/components/Sketches";
import { recipeBox } from "@/lib/recipes";

export const dynamic = "force-dynamic";

/** The recipe box. Not in the nav: the way in is the card on the home page. */
export default async function RecipesPage() {
  const recipes = await recipeBox();
  return (
    <div className="rb">
      <Link href="/" className="rb-back desktop-only">&larr; Home</Link>
      <div className="rb-head">
        <RecipeBoxSketch height={120} />
        <div className="rb-head-text">
          <h1>Recipes</h1>
          <p>The dishes we grew up on, in the words they were written in.</p>
        </div>
        <Link href="/recipes/new" className="btn btn-primary rb-add"><Icon name="plus" size={16} stroke={2} />Add a recipe</Link>
      </div>
      {recipes.length > 0 ? <RecipeGrid recipes={recipes} /> : (
        <div className="rb-empty">
          <h2>The box is empty so far</h2>
          <p>Add the first recipe. Paste it in however it&apos;s written, or snap a photo of the card.</p>
          <Link href="/recipes/new" className="btn btn-primary"><Icon name="plus" size={16} stroke={2} />Add a recipe</Link>
        </div>
      )}
    </div>
  );
}
