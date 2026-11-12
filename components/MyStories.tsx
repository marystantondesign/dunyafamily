"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MyStoryRow, StoryTab } from "@/lib/storyAdmin";
import type { SubmissionRow } from "@/lib/submissions";
import { Icon } from "./Icon";

type Tab = StoryTab | "submitted";
const TABS: [Tab, string][] = [["draft", "Drafts"], ["published", "Published"], ["submitted", "Submitted"], ["private", "Private"]];

/**
 * My stories (Mary only): Drafts, Published, Submitted and Private. Story rows open the story in the form; submitted
 * rows open what a family member sent, read-only.
 */
export function MyStories({ rows, submitted, start = "draft" }: { rows: Record<StoryTab, MyStoryRow[]>; submitted: SubmissionRow[]; start?: Tab }) {
  const [tab, setTab] = useState<Tab>(start);
  const count = (t: Tab) => (t === "submitted" ? submitted.length : rows[t].length);
  const pick = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, "", t === "draft" ? "/admin/stories" : `/admin/stories?tab=${t}`);
  };
  if (tab === "submitted") return (
    <>
      <Tabs tab={tab} count={count} pick={pick} />
      {submitted.length ? (
        <div className="ms-list" role="tabpanel">
          {submitted.map((r) => (
            <Link key={r.id} href={`/admin/stories/submitted/${r.id}`} className={`ms-row${r.unread ? " unread" : ""}`}>
              {r.thumbUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img className="ms-thumb" src={r.thumbUrl} alt="" />
                : <span className="ms-thumb empty" aria-hidden="true" />}
              <span className="ms-text">
                {r.title ? <span className="ms-title">{r.title}</span> : <span className="ms-question">{r.firstLine}</span>}
                <span className="ms-from">
                  <span className="ms-from-face" aria-hidden="true">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {r.fromAvatar ? <img src={r.fromAvatar} alt="" /> : r.from.charAt(0)}
                  </span>
                  From {r.from}{r.unread && <span className="ms-new">New</span>}
                </span>
                <span className="ms-meta">{[r.about.length ? `About ${r.about.join(", ")}` : "", r.received].filter(Boolean).join(" · ")}</span>
              </span>
            </Link>
          ))}
        </div>
      ) : <p className="ms-empty">No one has sent a story yet.</p>}
    </>
  );
  const list = rows[tab];
  return (
    <>
      <Tabs tab={tab} count={count} pick={pick} />
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

function Tabs({ tab, count, pick }: { tab: Tab; count: (t: Tab) => number; pick: (t: Tab) => void }) {
  return (
    <div role="tablist" aria-label="Story status" className="ms-tabs">
      {TABS.map(([key, label]) => (
        <button key={key} type="button" role="tab" aria-selected={tab === key} className={`ms-tab${tab === key ? " on" : ""}`} onClick={() => pick(key)}>
          {label}<span className="ms-count">{count(key)}</span>
        </button>
      ))}
    </div>
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
