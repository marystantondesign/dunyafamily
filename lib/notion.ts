import { q } from "./db";
import { signPut } from "./r2";

/**
 * Bringing Mary's stories over from her Notion database "Mammaw Stories". Each page's title is the question and its
 * body is the answer. New pages come in as drafts for Mary to title, theme, and tag before publishing. Pages already
 * brought over are never touched again, so edits made on the site stay.
 *
 * Needs NOTION_TOKEN (a Notion integration's secret) in the site's environment, and the database shared with that
 * integration in Notion. NOTION_STORIES_DB can name the database id directly; otherwise it's found by name.
 */
const API = "https://api.notion.com/v1";
const VERSION = "2022-06-28";

type RichText = { plain_text: string }[];
type NotionBlock = { id: string; type: string; has_children?: boolean } & Record<string, unknown>;

async function notion<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${process.env.NOTION_TOKEN}`, "Notion-Version": VERSION, "Content-Type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Notion said ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

const plain = (rt: RichText | undefined) => (rt ?? []).map((t) => t.plain_text).join("");

/** Pages that never come over: "dont share" ones, the prompt lists, and anything with no answer. */
export function skipTitle(title: string) {
  const t = title.trim().toLowerCase();
  const squashed = t.replace(/[\s'’`\-–—_]/g, "");
  return squashed.startsWith("dontshare") || t === "prompts unanswered" || t === "mammaw questions to ask";
}

async function findDatabase(): Promise<string> {
  if (process.env.NOTION_STORIES_DB) return process.env.NOTION_STORIES_DB;
  const out = await notion<{ results: { id: string; title?: RichText }[] }>("/search", {
    method: "POST", body: { query: "Mammaw Stories", filter: { property: "object", value: "database" } },
  });
  const db = out.results.find((d) => plain(d.title).trim().toLowerCase() === "mammaw stories") ?? out.results[0];
  if (!db) throw new Error("Couldn't find the Mammaw Stories database. In Notion, share it with the site's integration.");
  return db.id;
}

async function allPages(db: string) {
  const pages: { id: string; properties: Record<string, { type: string; title?: RichText }> }[] = [];
  let cursor: string | undefined;
  do {
    const out = await notion<{ results: typeof pages; has_more: boolean; next_cursor: string | null }>(`/databases/${db}/query`, {
      method: "POST", body: { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) },
    });
    pages.push(...out.results);
    cursor = out.has_more ? out.next_cursor ?? undefined : undefined;
  } while (cursor);
  return pages;
}

async function children(id: string): Promise<NotionBlock[]> {
  const out: NotionBlock[] = [];
  let cursor: string | undefined;
  do {
    const r = await notion<{ results: NotionBlock[]; has_more: boolean; next_cursor: string | null }>(
      `/blocks/${id}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`);
    out.push(...r.results);
    cursor = r.has_more ? r.next_cursor ?? undefined : undefined;
  } while (cursor);
  return out;
}

const TEXT = ["paragraph", "heading_1", "heading_2", "heading_3", "bulleted_list_item", "numbered_list_item", "quote", "callout", "to_do", "toggle"];

/** A Notion image copied into the site's storage (Notion's links expire after an hour). */
async function copyImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : type === "image/gif" ? "gif" : "jpg";
    const key = `stories/${crypto.randomUUID()}.${ext}`;
    const put = await fetch(await signPut(key, type), { method: "PUT", body: await res.arrayBuffer(), headers: { "Content-Type": type } });
    return put.ok ? key : null;
  } catch {
    return null;
  }
}

/** A page's body as the story text format (blank lines between paragraphs, image lines for pictures). */
async function bodyOf(pageId: string): Promise<string> {
  const parts: string[] = [];
  const walk = async (blocks: NotionBlock[]) => {
    for (const b of blocks) {
      const data = b[b.type] as { rich_text?: RichText; caption?: RichText; type?: string; file?: { url: string }; external?: { url: string } } | undefined;
      if (TEXT.includes(b.type)) {
        const text = plain(data?.rich_text).trim();
        if (text) parts.push(b.type === "bulleted_list_item" ? `• ${text}` : text);
      } else if (b.type === "image" && data) {
        const key = await copyImage(data.type === "file" ? data.file!.url : data.external!.url);
        if (key) parts.push(`[image ${key}] ${plain(data.caption).trim()}`.trim());
      }
      if (b.has_children && b.type !== "child_page") await walk(await children(b.id));
    }
  };
  await walk(await children(pageId));
  return parts.join("\n\n");
}

/** Adds any new answered pages as draft stories. Returns what happened. */
export async function importFromNotion(): Promise<{ added: number; skipped: number; existing: number }> {
  if (!process.env.NOTION_TOKEN) throw new Error("The Notion import isn't set up yet. Add NOTION_TOKEN to the site's settings on Vercel.");
  const db = await findDatabase();
  const pages = await allPages(db);
  const known = new Set((await q<{ notion_id: string }>(`select notion_id from stories where notion_id is not null`)).map((r) => r.notion_id));
  let added = 0, skipped = 0, existing = 0;
  for (const page of pages) {
    if (known.has(page.id)) { existing++; continue; }
    const title = plain(Object.values(page.properties).find((p) => p.type === "title")?.title).trim();
    if (!title || skipTitle(title)) { skipped++; continue; }
    const body = await bodyOf(page.id);
    if (!body.trim()) { skipped++; continue; }
    const rows = await q(`insert into stories (notion_id, question, body) values ($1, $2, $3) on conflict (notion_id) do nothing returning id`, [page.id, title, body]);
    if (rows.length) added++; else existing++;
  }
  return { added, skipped, existing };
}
