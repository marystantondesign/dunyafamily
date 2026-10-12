import Link from "next/link";
import { AddRecipe } from "@/components/RecipeForm";
import { recipePeople } from "@/lib/recipes";

export const dynamic = "force-dynamic";

export default async function NewRecipePage() {
  const people = await recipePeople();
  return (
    <div className="ra">
      <Link href="/recipes" className="rb-back desktop-only">&larr; Recipes</Link>
      <h1>Add a recipe</h1>
      <AddRecipe people={people} />
    </div>
  );
}
