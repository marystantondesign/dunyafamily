import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { badRequest, getSession, unauthorized } from "@/lib/auth";
import { signGet } from "@/lib/r2";

export const maxDuration = 60;

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "The recipe's name, in sentence case. Empty if there isn't one." },
    servings: { type: "string", description: "How many it serves or makes, as written. Empty if not given." },
    from_hint: { type: "string", description: "Whose recipe it says it is (a name or 'Mama'), as written. Empty if not given." },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        properties: {
          qty: { type: "string", description: "The amount with its unit, like '2 cups' or '1 tbsp'. Empty if there is no amount." },
          item: { type: "string", description: "The ingredient, as written." },
        },
        required: ["qty", "item"],
        additionalProperties: false,
      },
    },
    steps: { type: "array", items: { type: "string" } },
  },
  required: ["title", "servings", "from_hint", "ingredients", "steps"],
  additionalProperties: false,
} as const;

const INSTRUCTIONS = `You are sorting a family recipe into fields for a private family website. The recipe was typed or pasted in by a relative, often copied from a handwritten card written decades ago.

Split and structure it. Do not rewrite it.
- Keep the cook's own wording, spelling, and voice in every ingredient and step. Don't modernize, correct, or tidy the instructions, and don't add steps, tips, temperatures, or amounts that aren't there.
- Each ingredient is one row. Put the amount and unit in qty (like "2 cups", "1 tbsp", "3/4 cup") and the rest in item. If there is no amount ("salt and pepper to taste"), leave qty empty.
- Break the method into steps at natural points, usually one sentence or one action each. A run-on paragraph becomes several steps using the same words.
- You may expand an abbreviation only when its meaning is certain from context (for example "b.p." next to flour and salt is baking powder). Otherwise leave it as written.
- title: the recipe's name in sentence case ("Chicken and dumplings"). If the text names whose recipe it is ("- Mama", "Aunt Helen's"), leave that out of the title and put it in from_hint.
- If something isn't in the text, return an empty string or empty list. Never invent content.`;

type Parsed = { title: string; servings: string; from_hint: string; ingredients: { qty: string; item: string }[]; steps: string[] };

/** "Sort it out for me": reads a pasted recipe with Claude and hands back the fields to check over. Nothing is saved here. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  const { text, photoKey } = (await req.json().catch(() => ({}))) as { text?: string; photoKey?: string };
  const pasted = typeof text === "string" ? text.trim().slice(0, 20000) : "";
  const key = typeof photoKey === "string" && /^originals\/[0-9a-f-]{36}\.jpg$/.test(photoKey) ? photoKey : null;
  if (!pasted && !key) return badRequest("Paste the recipe in first.");
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Sorting isn't set up yet. Fill in the form by hand for now." }, { status: 503 });

  // With nothing pasted, read the photo of the card instead.
  const content: Anthropic.ContentBlockParam[] = pasted
    ? [{ type: "text", text: `${INSTRUCTIONS}\n\nThe recipe:\n<recipe>\n${pasted}\n</recipe>` }]
    : [
        { type: "image", source: { type: "url", url: await signGet(key!, 600) } },
        { type: "text", text: `${INSTRUCTIONS}\n\nThe recipe is the handwritten or printed card in this photo. Read it exactly as written.` },
      ];

  try {
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content }],
    });
    if (msg.stop_reason === "refusal" || msg.stop_reason === "max_tokens") throw new Error(`stopped: ${msg.stop_reason}`);
    const block = msg.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") throw new Error("no text");
    const out = JSON.parse(block.text) as Parsed;
    return NextResponse.json({
      title: String(out.title ?? ""), servings: String(out.servings ?? ""), from_hint: String(out.from_hint ?? ""),
      ingredients: Array.isArray(out.ingredients) ? out.ingredients.map((i) => ({ qty: String(i.qty ?? ""), item: String(i.item ?? "") })) : [],
      steps: Array.isArray(out.steps) ? out.steps.map(String) : [],
    });
  } catch (e) {
    if (e instanceof Anthropic.APIError) console.error("recipe parse failed", e.status, e.message);
    else console.error("recipe parse failed", e);
    return NextResponse.json({ error: "That didn't sort itself out. Your text is still here, so fill in the form by hand." }, { status: 502 });
  }
}
