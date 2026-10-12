import type { Ingredient } from "./recipes";

const UNITS = /^(?:cups?|c\.|tbsps?\.?|tablespoons?|tsps?\.?|teaspoons?|oz\.?|ounces?|lbs?\.?|pounds?|cans?|pkgs?\.?|packages?|sticks?|pints?|quarts?|qts?\.?|gallons?|dash(?:es)?|pinch(?:es)?|cloves?|g|grams?|kg|ml|liters?|litres?|handfuls?|slices?|large|medium|small|whole|fresh|heaping|level|of)\s+/i;
const DESCRIBE = /\b(?:chopped|diced|minced|sliced|melted|softened|cold|warm|hot|room temperature|cooked|raw|large|small|medium|fresh|whole|ground|grated|shredded|packed|sifted|beaten|optional)\b/gi;

/** The part of an ingredient a step would name: "3 tbsp butter, cold" is "butter", "2 cups flour" is "flour". */
export function coreName(g: Ingredient) {
  let s = g.item.toLowerCase().replace(/\(.*?\)/g, "").split(/[,;]/)[0];
  for (let i = 0; i < 4; i++) s = s.trim().replace(UNITS, "");
  s = s.replace(DESCRIBE, " ").replace(/\bto taste\b/g, " ").replace(/\s+/g, " ").trim();
  return s.length >= 3 ? s : null;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Ingredients a step names outright. Only whole-word matches on the ingredient's own name, so it never guesses. */
export function ingredientsIn(step: string, ingredients: Ingredient[]): Ingredient[] {
  const text = step.toLowerCase();
  return ingredients.filter((g) => {
    const core = coreName(g);
    if (!core) return false;
    const base = core.replace(/(?:es|s)$/, "");
    return new RegExp(`\\b(?:${escape(core)}|${escape(base)}(?:s|es)?)\\b`).test(text);
  });
}

/** "2 cups flour", or "3 tbsp butter" from "3 tbsp" and "butter, cold". */
export const shortLine = (g: Ingredient) => [g.qty, g.item.split(",")[0]].filter(Boolean).join(" ").trim();
