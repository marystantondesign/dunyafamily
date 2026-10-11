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
export function ProfilePhotoPicker({ personId, name, photos, current, children }: {
  personId: number; name: string; photos: PickPhoto[]; current: number | null; children?: React.ReactNode;
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
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        {children ?? <><Icon name="camera" size={18} /> Change profile photo</>}
      </button>
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
