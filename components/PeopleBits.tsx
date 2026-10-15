"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";

export const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

/** Copies text, then says so for a moment. */
export function CopyButton({ text, label = "Copy", iconOnly = false }: { text: string; label?: string; iconOnly?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={iconOnly ? "icon-btn small-icon" : "btn"}
      aria-label={iconOnly ? (done ? "Copied" : label) : undefined}
      title={iconOnly ? (done ? "Copied" : label) : undefined}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800); } catch { /* clipboard blocked */ }
      }}
    >
      <Icon name={done ? "check" : "copy"} size={iconOnly ? 20 : 18} />
      {!iconOnly && (done ? "Copied" : label)}
    </button>
  );
}

type PickPhoto = { id: number; url: string };

/** Pick someone's profile photo from the photos they're tagged in. */
export function ProfilePhotoPicker({ personId, name, photos, current, children, badge = false }: {
  personId: number; name: string; photos: PickPhoto[]; current: number | null; children?: React.ReactNode;
  /** The small round camera button on the corner of the profile photo. */
  badge?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function choose(photoId: number) {
    setError("");
    const res = await fetch(`/api/people/${personId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avatarPhotoId: photoId }) });
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "That didn't save. Try again.");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      {badge ? (
        <button type="button" className="camera-badge" aria-label="Change profile photo" onClick={() => setOpen(true)}><Icon name="camera" size={17} /></button>
      ) : (
        <button type="button" className="btn" onClick={() => setOpen(true)}>
          {children ?? <><Icon name="camera" size={18} /> Change profile photo</>}
        </button>
      )}
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="pick-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2 id="pick-title">Choose a photo of {name}</h2>
              <button type="button" className="icon-btn" aria-label="Close" onClick={() => setOpen(false)}><Icon name="x" size={22} /></button>
            </div>
            {photos.length ? (
              <div className="pick-grid">
                {photos.map((p) => (
                  <button key={p.id} type="button" className={p.id === current ? "on" : undefined} aria-pressed={p.id === current} onClick={() => choose(p.id)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted">No photos of {name} yet. Tag {name} in a photo, then pick it here.</p>
            )}
            {error && <p className="error" role="alert">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}

export type DateDraft = { kind: "anniversary" | "remembrance" | "other"; label: string; month: string; day: string; year: string };

/** One important date: what kind, a few words, and the month and day (year optional). */
export function DateFields({ value, onChange, idPrefix }: { value: DateDraft; onChange: (v: DateDraft) => void; idPrefix: string }) {
  const set = (patch: Partial<DateDraft>) => onChange({ ...value, ...patch });
  const placeholder = value.kind === "anniversary" ? "With Rob" : value.kind === "remembrance" ? "Remembering Grandpa Sam" : "Graduation";
  return (
    <div className="form-grid date-fields">
      <div className="row-2">
        <div className="field">
          <label htmlFor={`${idPrefix}-kind`}>What kind of date</label>
          <select id={`${idPrefix}-kind`} value={value.kind} onChange={(e) => set({ kind: e.target.value as DateDraft["kind"] })}>
            <option value="anniversary">Anniversary</option>
            <option value="remembrance">A day of remembrance</option>
            <option value="other">Something else</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-label`}>{value.kind === "other" ? "What it is" : <>Details <span className="opt">(optional)</span></>}</label>
          <input id={`${idPrefix}-label`} value={value.label} onChange={(e) => set({ label: e.target.value })} placeholder={placeholder} />
        </div>
      </div>
      <div className="date-row">
        <div className="field">
          <label htmlFor={`${idPrefix}-m`}>Month</label>
          <select id={`${idPrefix}-m`} value={value.month} onChange={(e) => set({ month: e.target.value })}>
            <option value="">Month</option>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-d`}>Day</label>
          <input id={`${idPrefix}-d`} inputMode="numeric" value={value.day} onChange={(e) => set({ day: e.target.value.replace(/\D/g, "").slice(0, 2) })} placeholder="12" />
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-y`}>Year <span className="opt">(optional)</span></label>
          <input id={`${idPrefix}-y`} inputMode="numeric" value={value.year} onChange={(e) => set({ year: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="Year" />
        </div>
      </div>
    </div>
  );
}

export const dateBody = (d: DateDraft) => ({ kind: d.kind, label: d.label, month: Number(d.month), day: Number(d.day), year: d.year ? Number(d.year) : null });

/**
 * Add or edit a mailing address or anniversary right from someone's profile, without the whole Edit profile page.
 * `link` is the text that opens it ("Add an address", "Add a date", "Edit").
 */
export function QuickDetail({ personId, name, what, link, address = "", anniversary = null }: {
  personId: number; name: string; what: "address" | "anniversary"; link: string;
  address?: string; anniversary?: { id: number; label: string; month: number; day: number; year: number | null } | null;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(address);
  const [date, setDate] = useState<DateDraft>(anniversary
    ? { kind: "anniversary", label: anniversary.label, month: String(anniversary.month), day: String(anniversary.day), year: anniversary.year ? String(anniversary.year) : "" }
    : { kind: "anniversary", label: "", month: "", day: "", year: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (what === "anniversary" && (!date.month || !date.day)) return setError("Choose a month and day.");
    setBusy(true);
    const [url, method, body] = what === "address"
      ? [`/api/people/${personId}/details`, "PATCH", { address: text }]
      : anniversary ? [`/api/person-dates/${anniversary.id}`, "PATCH", dateBody({ ...date, kind: "anniversary" })]
      : [`/api/people/${personId}/dates`, "POST", dateBody({ ...date, kind: "anniversary" })];
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { setBusy(false); return setError((await res.json().catch(() => ({}))).error ?? "That didn't save. Try again."); }
    window.location.reload();
  }

  return (
    <>
      <button type="button" className="link-btn plum" onClick={() => setOpen(true)}>{link}</button>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <form className="modal quick-detail" role="dialog" aria-modal="true" aria-labelledby={`qd-${what}`} onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <div className="modal-head">
              <h2 id={`qd-${what}`}>{what === "address" ? `${name}'s mailing address` : `${name}'s anniversary`}</h2>
              <button type="button" className="icon-btn" aria-label="Close" onClick={() => setOpen(false)}><Icon name="x" size={22} /></button>
            </div>
            {what === "address" ? (
              <div className="field">
                <label htmlFor="qd-address">Street, then city, state, and ZIP</label>
                <textarea id="qd-address" rows={3} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
              </div>
            ) : (
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="qd-label">Details <span className="opt">(optional)</span></label>
                  <input id="qd-label" value={date.label} onChange={(e) => setDate({ ...date, label: e.target.value })} placeholder="With Rob" />
                </div>
                <div className="date-row">
                  <select aria-label="Month" value={date.month} onChange={(e) => setDate({ ...date, month: e.target.value })}>
                    <option value="">Month</option>
                    {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                  <input aria-label="Day" inputMode="numeric" placeholder="Day" value={date.day} onChange={(e) => setDate({ ...date, day: e.target.value.replace(/\D/g, "").slice(0, 2) })} />
                  <input aria-label="Year (optional)" inputMode="numeric" placeholder="Year" value={date.year} onChange={(e) => setDate({ ...date, year: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
                </div>
              </div>
            )}
            {error && <p className="error" role="alert">{error}</p>}
            <div className="actions">
              <button className="btn btn-primary" disabled={busy}>{busy ? "Saving" : "Save"}</button>
              <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
