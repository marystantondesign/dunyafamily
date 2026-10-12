"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PrayerView, Praying, Remembering } from "@/lib/prayer";
import { Avatar } from "./Avatar";
import { ConfirmDialog } from "./ConfirmDialog";
import { Halo } from "./Halo";
import { Icon } from "./Icon";

type Person = { id: number; name: string; aliases: string[]; avatarUrl: string | null };
type Me = { name: string; avatarUrl: string | null };

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "That didn't work. Try again.");
}

/** "2 days ago", "yesterday", "3 weeks ago". */
function ago(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} ${mins === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
  const months = Math.floor(days / 30);
  if (days < 365) return `${months} ${months === 1 ? "month" : "months"} ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
const dayOf = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", ...(d.getFullYear() !== new Date().getFullYear() && { year: "numeric" }) });
};

/** "Scott and Nadia", "Cindy and 4 others", or "You, Cindy, and 4 others" (you always come first). */
function summary(list: Praying[]) {
  const n = list.length;
  if (!n) return "";
  const names = list.map((p) => (p.me ? "You" : p.name));
  if (n === 1) return names[0];
  if (n === 2) return `${names[0]} and ${names[1]}`;
  const others = (k: number) => `${k} ${k === 1 ? "other" : "others"}`;
  return list[0].me ? `You, ${names[1]}, and ${others(n - 2)}` : `${names[0]} and ${others(n - 1)}`;
}

function Faces({ list }: { list: Praying[] }) {
  if (!list.length) return null;
  return (
    <span className="pr-faces" aria-hidden="true">
      {list.slice(0, 3).map((p, i) => <Avatar key={i} name={p.me ? "You" : p.name.split(/\s+/)[0]} url={p.avatarUrl} />)}
    </span>
  );
}

/** Add to my prayers (maroon), then I'm praying (gold, softly shimmering). Tapping again takes it back. Shows the change right away. */
function PrayButton({ url, mine, onChange }: { url: string; mine: boolean; onChange: (on: boolean) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" className={`pr-pray${mine ? " on" : ""}`} aria-pressed={mine} disabled={busy}
      onClick={async () => {
        setBusy(true);
        onChange(!mine);
        try { await call(url, "POST"); } catch { onChange(mine); }
        router.refresh();
        setBusy(false);
      }}>
      {mine ? <><span aria-hidden="true">🙏</span> I&apos;m praying</> : <><Icon name="plus" size={16} stroke={2.4} /> Add to my prayers</>}
    </button>
  );
}

/** Praying avatars, the count or summary line, and the list of everyone when it's tapped. */
function useOptimistic(list: Praying[], mine: boolean, me: Me) {
  const [shown, setShown] = useState({ list, mine });
  useEffect(() => setShown({ list, mine }), [list, mine]);
  const set = (on: boolean) => setShown((s) => ({
    mine: on,
    list: on ? [{ name: me.name, avatarUrl: me.avatarUrl, me: true }, ...s.list.filter((p) => !p.me)] : s.list.filter((p) => !p.me),
  }));
  return [shown, set] as const;
}

function WhoList({ list, title, onClose }: { list: Praying[]; title: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop pr-backdrop" onClick={onClose}>
      <div className="pr-modal pr-who" role="dialog" aria-modal="true" aria-labelledby="pr-who-title" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip phone-only" aria-hidden="true" />
        <div className="pr-modal-head">
          <h2 id="pr-who-title">{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><Icon name="x" size={22} /></button>
        </div>
        <ul className="pr-who-list">
          {list.map((p, i) => <li key={i}><Avatar name={p.me ? "You" : p.name} url={p.avatarUrl} /> {p.me ? `You (${p.name})` : p.name}</li>)}
        </ul>
      </div>
    </div>
  );
}

function RememberCard({ r, me }: { r: Remembering; me: Me }) {
  const [shown, set] = useOptimistic(r.praying, r.mine, me);
  const [who, setWho] = useState(false);
  return (
    <section className="pr-remember" aria-label={`Remembering ${r.name}`}>
      <Halo on name={r.name}><Avatar name={r.name} url={r.avatarUrl} size="lg" /></Halo>
      <div className="pr-remember-text">
        <h2>Remembering {r.name} today</h2>
        <p>Pray for those of us who miss {r.pronoun}.</p>
      </div>
      <div className="pr-remember-pray">
        {shown.list.length > 0 && (
          <button type="button" className="pr-count" onClick={() => setWho(true)}>
            <Faces list={shown.list} /> {shown.list.length} praying
          </button>
        )}
        <PrayButton url={`/api/prayer/remember/${r.personId}`} mine={shown.mine} onChange={set} />
      </div>
      {who && <WhoList list={shown.list} title={`Praying, remembering ${r.name}`} onClose={() => setWho(false)} />}
    </section>
  );
}

function RequestCard({ r, me, onEdit, onAnswer }: { r: PrayerView; me: Me; onEdit: () => void; onAnswer: () => void }) {
  const router = useRouter();
  const [shown, set] = useOptimistic(r.praying, r.mine, me);
  const [who, setWho] = useState(false);
  const [menu, setMenu] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setMenu(false); };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menu]);
  const answered = !!r.answeredAt;
  const act = async (fn: () => Promise<void>) => { setMenu(false); setError(""); try { await fn(); router.refresh(); } catch (e) { setError((e as Error).message); } };

  return (
    <article className={`pr-card${answered ? " answered" : ""}`}>
      <div className="pr-top">
        <p className="pr-meta">
          {r.forPerson ? (
            <><span>For</span> <Link href={`/people/${r.forPerson.id}`} className="pr-for"><Avatar name={r.forPerson.name} url={r.forPerson.avatarUrl} /> {r.forPerson.name}</Link> <span className="pr-dot" aria-hidden="true">·</span> </>
          ) : r.forName ? (
            <><span>For</span> <strong className="pr-for">{r.forName}</strong> <span className="pr-dot" aria-hidden="true">·</span> </>
          ) : null}
          <span suppressHydrationWarning>From {r.from}, {ago(r.createdAt)}</span>
        </p>
        {r.canEdit && (
          <div className="pr-tools" ref={box}>
            {!answered && <button type="button" className="btn pr-answer" onClick={onAnswer}>Mark answered</button>}
            <button type="button" className="icon-btn pr-more" aria-label="More options" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}><Icon name="more" size={20} /></button>
            {menu && (
              <>
                <div className="ss-backdrop phone-only" onClick={() => setMenu(false)} aria-hidden="true" />
                <div className="pv-menu pr-menu" role="menu">
                  <div className="sheet-grip phone-only" aria-hidden="true" />
                  <ul className="pv-menu-list">
                    <li><button type="button" onClick={() => { setMenu(false); onEdit(); }}><Icon name="pencil" size={20} /> Edit request</button></li>
                    {answered && <li><button type="button" onClick={() => act(() => call(`/api/prayer/${r.id}`, "PATCH", { answered: false }))}><Icon name="swap" size={20} /> Move back to praying now</button></li>}
                    <li><button type="button" className="danger" onClick={() => { setMenu(false); setRemoving(true); }}><Icon name="trash" size={20} /> Remove request</button></li>
                  </ul>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <h3 className="pr-about">{r.about}</h3>
      {r.howToPray && (
        <div className="pr-how">
          <p className="pr-label">How to pray</p>
          <p>{r.howToPray}</p>
        </div>
      )}
      {answered && (
        <div className="pr-answered">
          <p className="pr-answered-when">Answered · {dayOf(r.answeredAt!)}</p>
          {r.answerUpdate && <p>{r.answerUpdate}</p>}
        </div>
      )}
      <div className="pr-foot">
        {!answered && <PrayButton url={`/api/prayer/${r.id}/praying`} mine={shown.mine} onChange={set} />}
        {shown.list.length > 0 && (
          <button type="button" className="pr-count" onClick={() => setWho(true)}>
            <Faces list={shown.list} /> <span>{answered ? `${shown.list.length} prayed` : summary(shown.list)}</span>
          </button>
        )}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {who && <WhoList list={shown.list} title={answered ? `${shown.list.length} prayed` : `${shown.list.length} praying`} onClose={() => setWho(false)} />}
      {removing && (
        <ConfirmDialog title="Remove this request?" body="It comes off the page for everyone. It stays in Recently deleted for 30 days in case you change your mind."
          keep="Keep it" confirm="Remove request" onKeep={() => setRemoving(false)}
          onConfirm={() => { setRemoving(false); act(() => call(`/api/prayer/${r.id}`, "DELETE")); }} />
      )}
    </article>
  );
}

/** Who is it for: search the family as you type, or use any name. */
function ForField({ people, value, onChange }: { people: Person[]; value: { id: number | null; text: string }; onChange: (v: { id: number | null; text: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const t = value.text.trim().toLowerCase();
  const matches = useMemo(() => !t ? [] : people.filter((p) => [p.name, ...p.aliases].some((n) => n.toLowerCase().includes(t)))
    .sort((a, b) => Number(!a.name.toLowerCase().startsWith(t)) - Number(!b.name.toLowerCase().startsWith(t))).slice(0, 6), [people, t]);
  const exact = matches.some((p) => p.name.toLowerCase() === t);
  const options: ({ kind: "person"; p: Person } | { kind: "use" })[] = [...matches.map((p) => ({ kind: "person" as const, p })), ...(t && !exact && !matches.length ? [{ kind: "use" as const }] : [])];
  const choose = (o: (typeof options)[number]) => {
    if (o.kind === "person") onChange({ id: o.p.id, text: o.p.name });
    else onChange({ id: null, text: value.text.trim() });
    setOpen(false);
  };
  const showList = open && !!t && value.id === null;
  return (
    <div className="field pr-for-field">
      <label htmlFor="pr-for">Who is it for? <span className="opt">Optional</span></label>
      <input id="pr-for" autoComplete="off" role="combobox" aria-expanded={showList} aria-controls="pr-for-list" value={value.text}
        onChange={(e) => { onChange({ id: null, text: e.target.value }); setOpen(true); setHi(0); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!showList || !options.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, options.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          if (e.key === "Enter") { e.preventDefault(); choose(options[hi]); }
          if (e.key === "Escape") { e.stopPropagation(); setOpen(false); }
        }} />
      {showList && (
        <ul className="pr-for-list" id="pr-for-list" role="listbox">
          {!matches.length && <li className="pr-for-none" aria-hidden="true">No one on the site named &quot;{value.text.trim()}&quot;</li>}
          {options.map((o, i) => (
            <li key={o.kind === "person" ? o.p.id : "use"} role="option" aria-selected={i === hi} className={i === hi ? "on" : undefined}
              onMouseDown={(e) => { e.preventDefault(); choose(o); }} onMouseEnter={() => setHi(i)}>
              {o.kind === "person" ? <><Avatar name={o.p.name} url={o.p.avatarUrl} /> {o.p.name}</> : <>Use &quot;{value.text.trim()}&quot;</>}
            </li>
          ))}
        </ul>
      )}
      <p className="hint">Pick someone from the family, type any name, or leave it blank.</p>
    </div>
  );
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

/** Ask for prayer, or edit a request. A modal on desktop and a sheet on phones. */
function AskForm({ people, me, editing, onClose }: { people: Person[]; me: Me; editing: PrayerView | null; onClose: () => void }) {
  const router = useRouter();
  const [forWho, setForWho] = useState<{ id: number | null; text: string }>(
    editing?.forPerson ? { id: editing.forPerson.id, text: editing.forPerson.name } : { id: null, text: editing?.forName ?? "" });
  const [about, setAbout] = useState(editing?.about ?? "");
  const [how, setHow] = useState(editing?.howToPray ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEscape(onClose);
  const title = editing ? "Edit request" : "Ask for prayer";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!about.trim()) return;
    setBusy(true);
    setError("");
    // A typed name that matches someone on the site links to them.
    const typed = forWho.text.trim();
    const match = forWho.id ?? people.find((p) => p.name.toLowerCase() === typed.toLowerCase())?.id ?? null;
    const body = { forPersonId: match, forName: match ? null : typed || null, about, howToPray: how };
    try {
      await call(editing ? `/api/prayer/${editing.id}` : "/api/prayer", editing ? "PATCH" : "POST", body);
      router.refresh();
      onClose();
    } catch (err) { setError((err as Error).message); setBusy(false); }
  }

  return (
    <div className="modal-backdrop pr-backdrop" onClick={onClose}>
      <form className="pr-modal pr-ask" role="dialog" aria-modal="true" aria-labelledby="pr-ask-title" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="sheet-grip phone-only" aria-hidden="true" />
        <div className="pr-modal-head">
          <button type="button" className="text-btn pr-cancel phone-only" onClick={onClose}>Cancel</button>
          <h2 id="pr-ask-title">{title}</h2>
          <button type="button" className="icon-btn desktop-only" aria-label="Close" onClick={onClose}><Icon name="x" size={22} /></button>
        </div>
        <div className="pr-fields">
          <ForField people={people} value={forWho} onChange={setForWho} />
          <div className="field">
            <label htmlFor="pr-about">What&apos;s going on?</label>
            <textarea id="pr-about" rows={2} value={about} onChange={(e) => setAbout(e.target.value)} autoFocus={!!editing} />
          </div>
          <div className="field">
            <label htmlFor="pr-how">How should we pray? <span className="opt">Optional</span></label>
            <textarea id="pr-how" rows={3} value={how} onChange={(e) => setHow(e.target.value)} />
            <p className="hint">Be as specific as you like, so people know what to pray for.</p>
          </div>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="pr-modal-foot">
          <span className="pr-posting"><Avatar name={me.name} url={me.avatarUrl} /> Posting as {me.name}</span>
          <button type="button" className="btn desktop-only" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy || !about.trim()}>{editing ? (busy ? "Saving" : "Save") : busy ? "Posting" : "Post request"}</button>
        </div>
      </form>
    </div>
  );
}

function AnswerForm({ r, onClose }: { r: PrayerView; onClose: () => void }) {
  const router = useRouter();
  const [update, setUpdate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEscape(onClose);
  return (
    <div className="modal-backdrop pr-backdrop" onClick={onClose}>
      <form className="pr-modal pr-answer-form" role="dialog" aria-modal="true" aria-labelledby="pr-answer-title" onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try { await call(`/api/prayer/${r.id}`, "PATCH", { answered: true, update }); router.refresh(); onClose(); }
          catch (err) { setError((err as Error).message); setBusy(false); }
        }}>
        <div className="sheet-grip phone-only" aria-hidden="true" />
        <h2 id="pr-answer-title">Mark as answered</h2>
        <p className="pr-quote">{r.about}</p>
        <div className="field">
          <label htmlFor="pr-update">Share an update <span className="opt">Optional</span></label>
          <textarea id="pr-update" rows={3} placeholder="What happened?" value={update} onChange={(e) => setUpdate(e.target.value)} autoFocus />
          <p className="hint">Everyone who prayed will see it in the Answered section.</p>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="pr-modal-foot end">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Saving" : "Mark answered"}</button>
        </div>
      </form>
    </div>
  );
}

/** A compact card for My prayers: who it's for, what's going on, and the gold I'm praying button. */
function MyCard({ r, me }: { r: PrayerView; me: Me }) {
  const [shown, set] = useOptimistic(r.praying, r.mine, me);
  const forName = r.forPerson?.name ?? r.forName;
  return (
    <article className="pr-card pr-mine">
      {forName && <p className="pr-meta"><span>For</span> <strong className="pr-for">{forName}</strong></p>}
      <h3 className="pr-about">{r.about}</h3>
      <div className="pr-foot"><PrayButton url={`/api/prayer/${r.id}/praying`} mine={shown.mine} onChange={set} /></div>
    </article>
  );
}

export function PrayerBoard({ remembering, active, answered, moreAnswered, earlier, people, me, tab: startTab }: {
  remembering: Remembering[]; active: PrayerView[]; answered: PrayerView[]; moreAnswered: number; earlier: boolean; people: Person[]; me: Me;
  tab: "all" | "mine";
}) {
  const [tab, setTab] = useState(startTab);
  const choose = (t: "all" | "mine") => {
    setTab(t);
    window.history.replaceState(null, "", t === "mine" ? "/prayer?tab=mine" : "/prayer");
  };
  const mine = active.filter((r) => r.mine);
  const [asking, setAsking] = useState(false);
  const [editing, setEditing] = useState<PrayerView | null>(null);
  const [answering, setAnswering] = useState<PrayerView | null>(null);
  const card = (r: PrayerView) => <RequestCard key={r.id} r={r} me={me} onEdit={() => setEditing(r)} onAnswer={() => setAnswering(r)} />;

  return (
    <div className="prayer">
      <div className={`pr-head${tab === "mine" ? " mine" : ""}`}>
        <div>
          <h1 className="display desktop-only">Prayer requests</h1>
          {tab === "all" && <p className="pr-tagline">Tap the &ldquo;Add to my prayers&rdquo; button so they can see your support.</p>}
        </div>
        <button type="button" className={`btn btn-primary${tab === "mine" ? " desktop-only" : ""}`} onClick={() => setAsking(true)}>
          <span className="desktop-only">+ Ask for prayer</span><span className="phone-only">+ Ask</span>
        </button>
      </div>

      <div className="pr-tabs" role="tablist" aria-label="Prayer requests">
        <button type="button" role="tab" aria-selected={tab === "all"} onClick={() => choose("all")}>All requests</button>
        <button type="button" role="tab" aria-selected={tab === "mine"} onClick={() => choose("mine")}>My prayers · {mine.length}</button>
      </div>

      {tab === "mine" ? (
        <div role="tabpanel" aria-label="My prayers">
          {mine.length > 0 ? (
            <>
              <Link href="/prayer/through" className="pr-through">
                <span className="pr-through-icon" aria-hidden="true">🙏</span>
                <span><strong>Pray through these</strong><span>One at a time, about {mine.length} {mine.length === 1 ? "minute" : "minutes"}</span></span>
                <Icon name="chevronRight" size={22} />
              </Link>
              {mine.map((r) => <MyCard key={r.id} r={r} me={me} />)}
            </>
          ) : (
            <p className="muted pr-empty pr-mine-empty">Tap Add to my prayers on any request and it will show up here.</p>
          )}
          <Link href="/you/reminders" className="pr-remind-link">Text me these reminders</Link>
        </div>
      ) : (
      <div role="tabpanel" aria-label="All requests">
      {remembering.map((r) => <RememberCard key={r.personId} r={r} me={me} />)}

      <h2 className="pr-section">Praying now</h2>
      {active.length ? active.map(card) : <p className="muted pr-empty">Nothing here right now. Ask for prayer when something is on your heart.</p>}

      {answered.length > 0 && (
        <>
          <h2 className="pr-section">Answered</h2>
          {answered.map(card)}
          {moreAnswered > 0 && <Link href="/prayer?earlier=1" className="pr-earlier">See earlier requests</Link>}
          {earlier && <Link href="/prayer" className="pr-earlier">Show fewer</Link>}
        </>
      )}
      </div>
      )}

      {(asking || editing) && <AskForm people={people} me={me} editing={editing} onClose={() => { setAsking(false); setEditing(null); }} />}
      {answering && <AnswerForm r={answering} onClose={() => setAnswering(null)} />}
    </div>
  );
}
