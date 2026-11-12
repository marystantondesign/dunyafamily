"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";

type P = { id: number; url: string; href: string; alt: string };
type Choice = "remove" | "keep" | "untag" | "upset";
const MIN = 400;
const OPTIONS: [Choice, string][] = [
  ["remove", "Please remove this photo."],
  ["keep", "You know what… never mind. On second thought, I am beautiful yesterday, today, and tomorrow. 🪞"],
  ["untag", "Just remove my tag from this photo."],
  ["upset", "It’s not personal, but this photo is upsetting to me."],
];
const NOTE: Record<Choice, string> = {
  remove: `Please write at least ${MIN} characters about why you want this photo removed.`,
  keep: "A note for Mary (optional)",
  untag: "Anything Mary should know? (optional)",
  upset: "Anything you’d like Mary to know? (optional)",
};

/**
 * Photos of you, on your own profile only: the usual grid, plus "Remove" (phone) or "Request to remove" (desktop)
 * to pick photos and ask Mary about each one.
 */
export function MyPhotos({ photos, variant, seeAll }: { photos: P[]; variant: "phone" | "desktop"; seeAll: string }) {
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [review, setReview] = useState(false);
  const phone = variant === "phone";
  const shown = phone && !selecting ? photos.slice(0, 9) : photos;
  const stop = () => { setSelecting(false); setPicked([]); };
  const toggle = (id: number) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const n = picked.length;

  return (
    <div className={`myp ${variant}${selecting ? " selecting" : ""}`}>
      <div className="myp-head">
        <h2>{selecting ? "Select" : "Photos of you"}</h2>
        {selecting
          ? <button type="button" className="myp-x" aria-label="Stop selecting" onClick={stop}><Icon name="x" size={20} stroke={2} /></button>
          : phone
            ? <button type="button" className="myp-remove" onClick={() => setSelecting(true)}>Remove</button>
            : <button type="button" className="myp-request" onClick={() => setSelecting(true)}><Icon name="photo" size={18} />Request to remove</button>}
      </div>
      <div className={phone ? "profile-grid myp-grid" : "photo-grid profile-desk-grid myp-grid"}>
        {shown.map((p) => selecting ? (
          <button key={p.id} type="button" className={`myp-tile${picked.includes(p.id) ? " on" : ""}`} aria-pressed={picked.includes(p.id)} aria-label={p.alt} onClick={() => toggle(p.id)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" loading="lazy" />
            <span className="myp-check" aria-hidden="true">{picked.includes(p.id) && <Icon name="check" size={14} stroke={3} />}</span>
          </button>
        ) : (
          <Link key={p.id} href={p.href}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.alt} loading="lazy" />
          </Link>
        ))}
      </div>
      {phone && !selecting && photos.length > 9 && <Link href={seeAll} className="small myp-all">See all {photos.length}</Link>}
      {selecting && (
        <div className="myp-bar" role="status">
          <span>{n === 0 ? "Tap photos to select them to remove." : `${n} ${n === 1 ? "photo" : "photos"} chosen`}</span>
          {n > 0 && <button type="button" className="myp-go" onClick={() => setReview(true)}>Request to remove</button>}
        </div>
      )}
      {review && (
        <Review photos={picked.map((id) => photos.find((p) => p.id === id)!).filter(Boolean)}
          onCancel={() => setReview(false)} onDone={() => { setReview(false); stop(); }} />
      )}
    </div>
  );
}

/** One photo at a time: what to do with it, and a note (400 characters when asking to remove it). */
function Review({ photos, onCancel, onDone }: { photos: P[]; onCancel: () => void; onDone: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<Choice[]>(() => photos.map(() => "keep"));
  const [text, setText] = useState<string[]>(() => photos.map(() => ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<number | null>(null);
  const total = photos.length;
  const ch = choice[step], tx = text[step];
  const ok = ch !== "remove" || tx.trim().length >= MIN;
  const last = step === total - 1;
  const set = <T,>(arr: T[], v: T) => arr.map((x, i) => (i === step ? v : x));

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => { if (e.key === "Escape" && sent === null) onCancel(); };
    document.addEventListener("keydown", key);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", key); };
  }, [onCancel, sent]);

  async function next() {
    if (!ok) return;
    if (!last) { setStep(step + 1); return; }
    const answers = photos.map((p, i) => ({ photoId: p.id, kind: choice[i], note: text[i] }));
    const asks = answers.filter((a) => a.kind !== "keep").length;
    if (!asks) { setSent(0); return; }
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/removals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error);
      setSent(asks);
      router.refresh();
    } catch (e) { setError(e instanceof Error && e.message ? e.message : "That didn't send. Try again."); }
    setBusy(false);
  }

  const p = photos[step];
  return (
    <div className="rr-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && sent === null) onCancel(); }}>
      <div className="rr-sheet" role="dialog" aria-modal="true" aria-labelledby="rr-title">
        <div className="rr-mhead phone-only">
          <h2>{sent === null ? <>Removal request <span>{step + 1}/{total}</span></> : "Request sent"}</h2>
          {sent === null && <button type="button" className="rr-cancel" onClick={onCancel}>Cancel</button>}
        </div>
        {sent === null ? (
          <>
            <div className="rr-body">
              <figure className="rr-fig">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.alt} />
                <figcaption className="desktop-only">Photo {step + 1} of {total}</figcaption>
              </figure>
              <div className="rr-form">
                <h2 id="rr-title" className="desktop-only">Request to remove</h2>
                <fieldset>
                  <legend>What would you like to do with this photo?</legend>
                  <div role="radiogroup" className="rr-options">
                    {OPTIONS.map(([key, label]) => (
                      <button key={key} type="button" role="radio" aria-checked={ch === key} className={`rr-opt${ch === key ? " on" : ""}`} onClick={() => setChoice(set(choice, key))}>
                        <span className="rr-dot" aria-hidden="true"><span /></span><span>{label}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label className="rr-note">
                  <span>{NOTE[ch]}</span>
                  <textarea value={tx} onChange={(e) => setText(set(text, e.target.value))} placeholder={ch === "remove" ? "Take your time…" : ""} />
                  {ch === "remove" && <span className={`rr-count${ok ? " ok" : ""}`}>{tx.trim().length} of {MIN} characters</span>}
                </label>
                {error && <p className="rr-error" role="alert">{error}</p>}
              </div>
            </div>
            <div className="rr-foot">
              <button type="button" className="rr-back" style={{ visibility: step === 0 ? "hidden" : undefined }} onClick={() => setStep(step - 1)}>Back</button>
              <div>
                <button type="button" className="rr-textcancel desktop-only" onClick={onCancel}>Cancel</button>
                <button type="button" className="rr-next" disabled={!ok || busy} onClick={next}>{last ? (busy ? "Sending" : "Send request") : "Next photo"}</button>
              </div>
            </div>
          </>
        ) : (
          <div className="rr-done">
            <h2>Sent to Mary</h2>
            <p>{sent ? `Mary will look at your request for ${sent} ${sent === 1 ? "photo" : "photos"}. Photos you kept stay as they are.` : "You kept every photo. Nothing was sent."}</p>
            <button type="button" className="rr-next" onClick={onDone}>Back to your profile</button>
          </div>
        )}
      </div>
    </div>
  );
}
