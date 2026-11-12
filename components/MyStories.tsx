"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MyStoryRow, StoryTab } from "@/lib/storyAdmin";
import { Icon } from "./Icon";

const TABS: [StoryTab, string][] = [["draft", "Drafts"], ["published", "Published"], ["private", "Private"]];

/** My stories (Mary only): Drafts, Published and Private, each row opening the story in the form. */
export function MyStories({ rows }: { rows: Record<StoryTab, MyStoryRow[]> }) {
  const [tab, setTab] = useState<StoryTab>("draft");
  const list = rows[tab];
  return (
    <>
      <div role="tablist" aria-label="Story status" className="ms-tabs">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={`ms-tab${tab === key ? " on" : ""}`} onClick={() => setTab(key)}>
            {label}<span className="ms-count">{rows[key].length}</span>
          </button>
        ))}
      </div>
      {list.length ? (
        <div className="ms-list" role="tabpanel">
          {list.map((r) => (
            <Link key={r.id} href={`/admin/stories/${r.id}`} className="ms-row">
              {r.thumbUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img className="ms-thumb" src={r.thumbUrl} alt="" />
                : <span className="ms-thumb empty" aria-hidden="true" />}
              <span className="ms-text">
                {r.title.trim()
                  ? <span className="ms-title">{r.title}</span>
                  : <span className="ms-question">{r.question || "No question yet"}</span>}
                <span className="ms-meta">{r.meta}</span>
                {r.needs.length > 0 && <span className="ms-needs">Needs {r.needs.join(", ")}</span>}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="ms-empty">{tab === "draft" ? "No drafts. Add a story or bring them over from Notion." : tab === "published" ? "Nothing published yet." : "No private stories."}</p>
      )}
    </>
  );
}

/** Import from Notion, under the list. */
export function NotionImport() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  return (
    <div className="ms-import">
      <button type="button" className="btn" disabled={busy} onClick={async () => {
        setBusy(true); setNote("Bringing stories over. This can take a minute.");
        try { const r = await (await fetch("/api/admin/stories/import", { method: "POST" })).json(); setNote(r.message ?? r.error); router.refresh(); }
        catch { setNote("The import didn't work. Try again."); }
        setBusy(false);
      }}><Icon name="download" size={16} stroke={2} />{busy ? "Importing" : "Import from Notion"}</button>
      {note && <span className="small muted" role="status">{note}</span>}
    </div>
  );
}
