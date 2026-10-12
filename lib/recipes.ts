import { canRemove } from "./auth";
import { q } from "./db";
import { displayName } from "./names";
import { signGet } from "./r2";
import type { Session } from "./session";

export type Ingredient = { qty: string; item: string };
export type RecipeFrom = { name: string; personId: number | null; avatarUrl: string | null };
export type RecipeCard = { id: number; title: string; from: RecipeFrom | null; photoUrl: string | null; notes: number };
export type RecipeNote = {
  id: number; author: string; avatarUrl: string | null; createdAt: string; text: string; photoUrl: string | null; canDelete: boolean;
};
export type RecipeView = RecipeCard & {
  intro: string | null; servings: string | null; ingredients: Ingredient[]; steps: string[];
  addedBy: string; createdAt: string; canEdit: boolean; personIdRaw: number | null; fromName: string | null; photoKey: string | null;
};
export type RecipeInput = {
  title?: string; personId?: number | null; fromName?: string | null; intro?: string | null; servings?: string | null;
  ingredients?: Ingredient[]; steps?: string[]; cardPhotoKey?: string | null;
};

const first = (name: string) => displayName(name).split(/\s+/)[0];

type Row = {
  id: number; title: string; person_id: number | null; from_name: string | null; card_photo_key: string | null; notes: number;
  pe_name: string | null; pe_thumb: string | null;
};
const CARD_SQL = `select r.id, r.title, r.person_id, r.from_name, r.card_photo_key,
    (select count(*)::int from recipe_notes n where n.recipe_id = r.id and n.deleted_at is null) as notes,
    pe.name as pe_name, ph.thumb_key as pe_thumb
  from recipes r
  left join people pe on pe.id = r.person_id and pe.deleted_at is null
  left join photos ph on ph.id = pe.avatar_photo_id and ph.deleted_at is null`;

async function card(r: Row): Promise<RecipeCard> {
  // "From Dunya": the tree name, first name only. Someone not in the tree keeps the name as it was typed.
  const from: RecipeFrom | null = r.pe_name
    ? { name: first(r.pe_name), personId: r.person_id, avatarUrl: r.pe_thumb ? await signGet(r.pe_thumb) : null }
    : r.from_name?.trim() ? { name: r.from_name.trim(), personId: null, avatarUrl: null } : null;
  return { id: r.id, title: r.title, from, photoUrl: r.card_photo_key ? await signGet(r.card_photo_key) : null, notes: r.notes };
}

/** Every recipe in the box, newest first. */
export async function recipeBox(): Promise<RecipeCard[]> {
  const rows = await q<Row>(`${CARD_SQL} where r.deleted_at is null order by r.created_at desc, r.id desc`);
  return Promise.all(rows.map(card));
}

export async function recipeCount() {
  const [r] = await q<{ n: number }>(`select count(*)::int as n from recipes where deleted_at is null`).catch(() => [{ n: 0 }]);
  return r?.n ?? 0;
}

/** One recipe with its notes from the family, oldest note first. */
export async function recipePage(id: number, s: Session | null): Promise<RecipeView | null> {
  const [r] = await q<Row & { intro: string | null; servings: string | null; ingredients: Ingredient[]; steps: string[];
    added_by_name: string | null; added_by_device: string | null; ad_name: string | null; created_at: string }>(
    `select x.*, r.intro, r.servings, r.ingredients, r.steps, r.added_by_name, r.added_by_device, r.created_at
       from (${CARD_SQL} where r.id = $1 and r.deleted_at is null) x join recipes r on r.id = x.id`, [id]);
  if (!r) return null;
  return {
    ...(await card(r)),
    intro: r.intro, servings: r.servings,
    ingredients: Array.isArray(r.ingredients) ? r.ingredients : [], steps: Array.isArray(r.steps) ? r.steps : [],
    addedBy: r.added_by_name ? first(r.added_by_name) : "someone", createdAt: r.created_at,
    canEdit: canRemove(s, r.added_by_device), personIdRaw: r.person_id, fromName: r.from_name, photoKey: r.card_photo_key,
  };
}

export async function recipeNotes(id: number, s: Session | null): Promise<RecipeNote[]> {
  const rows = await q<{ id: number; author_name: string | null; author_device: string | null; text: string; photo_key: string | null; created_at: string;
    pe_name: string | null; pe_thumb: string | null }>(
    `select n.id, n.author_name, n.author_device, n.text, n.photo_key, n.created_at, pe.name as pe_name, ph.thumb_key as pe_thumb
       from recipe_notes n
       left join people pe on pe.id = n.author_person_id and pe.deleted_at is null
       left join photos ph on ph.id = pe.avatar_photo_id and ph.deleted_at is null
      where n.recipe_id = $1 and n.deleted_at is null order by n.created_at, n.id`, [id]);
  return Promise.all(rows.map(async (n) => ({
    id: n.id, author: first(n.pe_name ?? n.author_name ?? "Someone"), avatarUrl: n.pe_thumb ? await signGet(n.pe_thumb) : null,
    createdAt: n.created_at, text: n.text, photoUrl: n.photo_key ? await signGet(n.photo_key) : null, canDelete: canRemove(s, n.author_device),
  })));
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const validKey = (k: unknown) => typeof k === "string" && /^originals\/[0-9a-f-]{36}\.(jpg|png|webp|heic|gif)$/.test(k);

/** Tidy what the form sent. Returns the reason when it can't be saved. */
async function tidy(input: RecipeInput) {
  const title = clean(input.title, 200);
  if (!title) return "Give the recipe a name.";
  const ingredients = (Array.isArray(input.ingredients) ? input.ingredients : [])
    .map((i) => ({ qty: clean(i?.qty, 60), item: clean(i?.item, 300) }))
    .filter((i) => i.qty || i.item)
    .slice(0, 100);
  const steps = (Array.isArray(input.steps) ? input.steps : []).map((x) => clean(x, 3000)).filter(Boolean).slice(0, 100);
  let personId = Number.isInteger(input.personId) ? Number(input.personId) : null;
  if (personId) {
    const [p] = await q(`select 1 from people where id = $1 and deleted_at is null`, [personId]);
    if (!p) personId = null;
  }
  return {
    title, personId, fromName: personId ? null : clean(input.fromName, 120) || null,
    intro: clean(input.intro, 500) || null, servings: clean(input.servings, 120) || null,
    ingredients, steps, cardPhotoKey: validKey(input.cardPhotoKey) ? (input.cardPhotoKey as string) : null,
  };
}

export async function addRecipe(input: RecipeInput, s: Session): Promise<number | string> {
  const t = await tidy(input);
  if (typeof t === "string") return t;
  const [r] = await q<{ id: number }>(
    `insert into recipes (title, person_id, from_name, intro, servings, ingredients, steps, card_photo_key, added_by_name, added_by_device)
     values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10) returning id`,
    [t.title, t.personId, t.fromName, t.intro, t.servings, JSON.stringify(t.ingredients), JSON.stringify(t.steps), t.cardPhotoKey, await whoName(s), s.did]);
  return r.id;
}

export async function editRecipe(id: number, input: RecipeInput): Promise<string | null> {
  const t = await tidy(input);
  if (typeof t === "string") return t;
  await q(
    `update recipes set title = $2, person_id = $3, from_name = $4, intro = $5, servings = $6, ingredients = $7::jsonb, steps = $8::jsonb,
            card_photo_key = $9, updated_at = now() where id = $1`,
    [id, t.title, t.personId, t.fromName, t.intro, t.servings, JSON.stringify(t.ingredients), JSON.stringify(t.steps), t.cardPhotoKey]);
  return null;
}

/** Whether this device (or the admin) may change a recipe. */
export async function recipeEditable(id: number, s: Session): Promise<"ok" | "missing" | "forbidden"> {
  const [r] = await q<{ added_by_device: string | null }>(`select added_by_device from recipes where id = $1 and deleted_at is null`, [id]);
  if (!r) return "missing";
  return canRemove(s, r.added_by_device) ? "ok" : "forbidden";
}

export async function removeRecipe(id: number, s: Session) {
  await q(`update recipes set deleted_at = now(), deleted_by_name = $2 where id = $1`, [id, s.name]);
}

/** The person's tree name when this device picked who they are, otherwise the name they typed. */
async function whoName(s: Session) {
  if (s.pid) {
    const [p] = await q<{ name: string }>(`select name from people where id = $1 and deleted_at is null`, [s.pid]);
    if (p) return displayName(p.name);
  }
  return displayName(s.name);
}

export async function addNote(recipeId: number, body: { text?: string; photoKey?: string | null }, s: Session): Promise<number | string> {
  const text = clean(body.text, 4000);
  if (!text) return "Write a note first.";
  const [r] = await q(`select 1 from recipes where id = $1 and deleted_at is null`, [recipeId]);
  if (!r) return "That recipe isn't here anymore.";
  const [n] = await q<{ id: number }>(
    `insert into recipe_notes (recipe_id, author_name, author_device, author_person_id, text, photo_key) values ($1, $2, $3, $4, $5, $6) returning id`,
    [recipeId, await whoName(s), s.did, s.pid ?? null, text, validKey(body.photoKey) ? body.photoKey : null]);
  return n.id;
}

export async function removeNote(id: number, s: Session): Promise<"ok" | "missing" | "forbidden"> {
  const [n] = await q<{ author_device: string | null }>(`select author_device from recipe_notes where id = $1 and deleted_at is null`, [id]);
  if (!n) return "missing";
  if (!canRemove(s, n.author_device)) return "forbidden";
  await q(`update recipe_notes set deleted_at = now(), deleted_by_name = $2 where id = $1`, [id, s.name]);
  return "ok";
}

/** People who can be picked under "Whose recipe": everyone in the tree, in memory too. */
export async function recipePeople() {
  const rows = await q<{ id: number; name: string }>(`select id, name from people where deleted_at is null order by lower(name)`);
  return rows.map((r) => ({ id: r.id, name: displayName(r.name) }));
}
