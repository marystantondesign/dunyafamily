"use client";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "./Icon";
import { MONTHS } from "./PeopleBits";
import { TagPicker, type Option, type Picked } from "./TagPicker";

type RelKind = "child" | "parent" | "partner" | "friend";
const REL_KINDS: { kind: RelKind; label: string }[] = [
  { kind: "child", label: "Child of" }, { kind: "parent", label: "Parent of" }, { kind: "partner", label: "Partner of" }, { kind: "friend", label: "Friend of the family" },
];

/** Add a family member (screen 19): name, how they're related, and optionally a birthday and mailing address. */
export function AddPersonForm({ people, start, canRelate }: { people: Option[]; start?: { kind: RelKind; other?: number }; canRelate: boolean }) {
  const [name, setName] = useState("");
  const [relKind, setRelKind] = useState<RelKind | null>(start?.kind ?? null);
  const [relTo, setRelTo] = useState<Picked[]>(start?.other ? [start.other] : []);
  const [bm, setBm] = useState("");
  const [bd, setBd] = useState("");
  const [by, setBy] = useState("");
  const [address, setAddress] = useState("");
  const [share, setShare] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [existing, setExisting] = useState<number | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setExisting(null);
    if (!name.trim()) return setError("Add a name.");
    if ((bm || bd) && !(bm && bd)) return setError("Add both the month and the day for the birthday, or leave both blank.");
    if (relKind && relKind !== "friend" && !relTo.length) return setError(`Choose who they're ${REL_KINDS.find((r) => r.kind === relKind)!.label.toLowerCase()}, or tap it again to skip.`);
    setBusy(true);
    const res = await fetch("/api/people", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, month: bm ? Number(bm) : null, day: bd ? Number(bd) : null, year: by ? Number(by) : null, address, shareAddress: share,
        relation: relKind === "friend" ? { kind: "friend" } : relKind && relTo.length ? { kind: relKind, other: relTo[0] } : null }),
    });
    const out = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(out.error ?? "That didn't save. Try again."); if (out.id) setExisting(out.id); return; }
    if (out.note) { setError(`${name.trim()} was added, but not linked: ${out.note}`); setExisting(out.id); return; }
    window.location.assign(`/people/${out.id}`);
  }

  const first = name.trim().split(" ")[0];
  return (
    <form className="add-person" onSubmit={submit}>
      <div className="add-person-head">
        <Link href="/people" className="icon-btn" aria-label="Close"><Icon name="x" size={22} /></Link>
        <h1>Add a family member</h1>
      </div>
      <div className="photo-later">
        <span className="photo-ring"><Icon name="photo" size={28} /></span>
        <p className="small">Pick a profile photo later from photos they&apos;re tagged in.</p>
      </div>
      <div className="field">
        <label htmlFor="np-name">Name</label>
        <input id="np-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" autoFocus />
      </div>
      {canRelate && (
      <div className="field">
        <span className="label" id="np-rel">How they&apos;re related <span className="opt">(optional)</span></span>
        <div className="rel-kinds" role="group" aria-labelledby="np-rel">
          {REL_KINDS.map((r) => (
            <button key={r.kind} type="button" className={`pill${relKind === r.kind ? " on" : ""}`} aria-pressed={relKind === r.kind}
              onClick={() => setRelKind(relKind === r.kind ? null : r.kind)}>{r.label}</button>
          ))}
        </div>
        {relKind && relKind !== "friend" && (
          <TagPicker label={`${REL_KINDS.find((r) => r.kind === relKind)!.label} who?`} hideLabel options={people} value={relTo}
            onChange={(v) => setRelTo(v.slice(-1))} placeholder="Start typing a name" />
        )}
      </div>
      )}
      <div className="field">
        <span className="label" id="np-bday">Birthday <span className="opt">(optional)</span></span>
        <div className="date-row" role="group" aria-labelledby="np-bday">
          <select aria-label="Birthday month" value={bm} onChange={(e) => setBm(e.target.value)}>
            <option value="">Month</option>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <input aria-label="Birthday day" inputMode="numeric" placeholder="Day" value={bd} onChange={(e) => setBd(e.target.value.replace(/\D/g, "").slice(0, 2))} />
          <input aria-label="Birth year (optional)" inputMode="numeric" placeholder="Year" value={by} onChange={(e) => setBy(e.target.value.replace(/\D/g, "").slice(0, 4))} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="np-address">Mailing address <span className="opt">(optional)</span></label>
        <textarea id="np-address" rows={3} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city, state, zip" />
      </div>
      {address.trim() && (
        <label className="switch-row">
          <input type="checkbox" role="switch" className="switch" checked={share} onChange={(e) => setShare(e.target.checked)} />
          Share this address with the family
        </label>
      )}
      {error && <p className="error" role="alert">{error} {existing && <Link href={`/people/${existing}`}>Go to their page</Link>}</p>}
      <button className="btn btn-primary add-person-go" disabled={busy}>{busy ? "Adding" : `Add ${first || "them"}`}</button>
    </form>
  );
}
