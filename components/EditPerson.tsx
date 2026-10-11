"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PersonDetails } from "@/lib/people";
import { Icon } from "./Icon";
import { DateFields, dateBody, MONTHS, ProfilePhotoPicker, type DateDraft } from "./PeopleBits";

const blankDate: DateDraft = { kind: "anniversary", label: "", month: "", day: "", year: "" };
const shortDate = (m: number, d: number) => new Date(2000, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "That didn't save. Try again.");
}

/** Edit a person: about, mailing address, important dates, family (passed in), in memory, and removing them. */
export function EditPerson({ det, avatarUrl, photos, children }: { det: PersonDetails; avatarUrl: string | null; photos: { id: number; url: string }[]; children?: React.ReactNode }) {
  const router = useRouter();
  const back = `/people/${det.id}`;
  const [name, setName] = useState(det.name);
  const [bm, setBm] = useState(det.birthday ? String(det.birthday.month) : "");
  const [bd, setBd] = useState(det.birthday ? String(det.birthday.day) : "");
  const [by, setBy] = useState(det.birthday?.year ? String(det.birthday.year) : "");
  const [address, setAddress] = useState(det.address ?? "");
  const [share, setShare] = useState(det.shareAddress);
  const [inMemory, setInMemory] = useState(det.inMemory);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dateOpen, setDateOpen] = useState<number | "new" | null>(null);
  const [dateDraft, setDateDraft] = useState<DateDraft>(blankDate);
  const [dateError, setDateError] = useState("");
  const bdayLocked = !!det.birthday && !det.birthday.removable;

  async function save() {
    setError("");
    const body: Record<string, unknown> = {};
    if (det.canRename && name.trim() !== det.name) body.name = name;
    if (!bdayLocked) {
      if (bm || bd) {
        if (!bm || !bd) return setError("Add both the month and the day for the birthday, or leave both blank.");
        body.birthday = { month: Number(bm), day: Number(bd), year: by ? Number(by) : null };
      } else if (det.birthday) body.birthday = null;
    }
    if (det.canEditAddress) { body.address = address; body.shareAddress = share; }
    if (det.canChangeMemory) body.inMemory = inMemory;
    setBusy(true);
    try {
      await send(`/api/people/${det.id}/details`, "PATCH", body);
      window.location.assign(back);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function saveDate() {
    setDateError("");
    if (!dateDraft.month || !dateDraft.day) return setDateError("Choose a month and day.");
    try {
      if (dateOpen === "new") await send(`/api/people/${det.id}/dates`, "POST", dateBody(dateDraft));
      else await send(`/api/person-dates/${dateOpen}`, "PATCH", dateBody(dateDraft));
      setDateOpen(null);
      router.refresh();
    } catch (e) { setDateError((e as Error).message); }
  }

  async function removeDate(id: number, title: string) {
    if (!confirm(`Remove ${title}?`)) return;
    try { await send(`/api/person-dates/${id}`, "DELETE"); router.refresh(); } catch (e) { setDateError((e as Error).message); }
  }

  async function removePerson() {
    if (!confirm(`Remove ${det.name} from the family? Their photos stay on the site, and Mary can restore them.`)) return;
    try { await send(`/api/people/${det.id}`, "DELETE"); window.location.assign("/people"); } catch (e) { setError((e as Error).message); }
  }

  const dateForm = (
    <div className="date-editor">
      <DateFields value={dateDraft} onChange={setDateDraft} idPrefix="date" />
      {dateError && <p className="error" role="alert">{dateError}</p>}
      <div className="actions" style={{ marginTop: 12 }}>
        <button type="button" className="btn btn-primary" onClick={saveDate}>{dateOpen === "new" ? "Add date" : "Save date"}</button>
        <button type="button" className="btn" onClick={() => { setDateOpen(null); setDateError(""); }}>Cancel</button>
      </div>
    </div>
  );

  return (
    <div className="edit-person">
      <Link href={back} className="back-link"><Icon name="chevronLeft" size={16} /> Back to {det.name}</Link>
      <div className="edit-head">
        <h1 className="display">Edit {det.name}</h1>
        <div className="actions" style={{ marginTop: 0 }}>
          <Link href={back} className="btn">Cancel</Link>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "Saving" : "Save changes"}</button>
        </div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}

      <div className="edit-layout">
        <aside className="edit-side">
          <div className="portrait portrait-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {avatarUrl ? <img src={avatarUrl} alt="" /> : <span aria-hidden="true">{det.name.charAt(0)}</span>}
          </div>
          {det.canChangePhoto
            ? <ProfilePhotoPicker personId={det.id} name={det.name} photos={photos} current={det.avatarPhotoId}>Change profile photo</ProfilePhotoPicker>
            : <p className="hint">Only the person who added {det.name}, or Mary, can change this photo.</p>}
          <label className="switch-row">
            <input type="checkbox" role="switch" className="switch" checked={inMemory} disabled={!det.canChangeMemory} onChange={(e) => setInMemory(e.target.checked)} />
            In memory
          </label>
          <p className="hint">For family who have passed. Their page shows &quot;In memory&quot; and their dates are marked as days to remember.</p>
        </aside>

        <div className="edit-cards">
          <section className="edit-card">
            <h2>About</h2>
            <div className="field">
              <label htmlFor="ep-name">Name</label>
              <input id="ep-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!det.canRename} />
              {!det.canRename && <span className="hint">Only the person who added {det.name}, or Mary, can rename them.</span>}
            </div>
            <div className="field">
              <span className="label" id="ep-bday">Birthday</span>
              <div className="date-row" role="group" aria-labelledby="ep-bday">
                <select aria-label="Birthday month" value={bm} onChange={(e) => setBm(e.target.value)} disabled={bdayLocked}>
                  <option value="">Month</option>
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                <input aria-label="Birthday day" inputMode="numeric" placeholder="Day" value={bd} onChange={(e) => setBd(e.target.value.replace(/\D/g, "").slice(0, 2))} disabled={bdayLocked} />
                <input aria-label="Birth year (optional)" inputMode="numeric" placeholder="Year" value={by} onChange={(e) => setBy(e.target.value.replace(/\D/g, "").slice(0, 4))} disabled={bdayLocked} />
              </div>
              <span className="hint">{bdayLocked ? "Only the person who added this birthday, or Mary, can change it." : "Year is optional. It's only used to show ages on birthday cards."}</span>
            </div>
          </section>

          <section className="edit-card" id="address">
            <h2>Mailing address</h2>
            {det.addressHidden ? (
              <p className="muted">{det.name}&apos;s address isn&apos;t shared with the family.</p>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="ep-address" className="sr-only">Mailing address</label>
                  <textarea id="ep-address" rows={3} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city, state, zip" disabled={!det.canEditAddress} />
                </div>
                <label className="switch-row">
                  <input type="checkbox" role="switch" className="switch" checked={share} disabled={!det.canEditAddress} onChange={(e) => setShare(e.target.checked)} />
                  Share this address with the family
                </label>
                {!share && <p className="hint">Only Mary will see it.</p>}
                {!det.canEditAddress && <p className="hint">Only the person who added this address, or Mary, can change it.</p>}
              </>
            )}
          </section>

          <section className="edit-card" id="dates">
            <h2>Important dates</h2>
            <ul className="date-list">
              {det.dates.map((d) => {
                const title = d.kind === "anniversary" ? `Anniversary, ${MONTHS[d.month - 1]} ${d.day}` : `${d.label || "A day to remember"}, ${shortDate(d.month, d.day)}`;
                const sub = d.kind === "anniversary" ? d.label : d.kind === "remembrance" ? "A day to remember" : d.year ? String(d.year) : "";
                return (
                  <li key={d.id}>
                    {dateOpen === d.id ? dateForm : (
                      <>
                        <Icon name={d.kind === "anniversary" ? "heart" : d.kind === "remembrance" ? "moon" : "calendar"} size={20} className="date-icon" />
                        <span className="date-text"><span>{title}</span>{sub && <span className="small muted">{sub}</span>}</span>
                        {d.removable && (
                          <span className="date-actions">
                            <button type="button" className="text-btn" onClick={() => { setDateOpen(d.id); setDateError(""); setDateDraft({ kind: d.kind, label: d.label, month: String(d.month), day: String(d.day), year: d.year ? String(d.year) : "" }); }}>Edit</button>
                            <button type="button" className="text-btn quiet" onClick={() => removeDate(d.id, title)}>Remove</button>
                          </span>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            {dateOpen === "new" ? dateForm : (
              <button type="button" className="btn dashed" onClick={() => { setDateOpen("new"); setDateError(""); setDateDraft({ ...blankDate, kind: inMemory ? "remembrance" : "anniversary", label: inMemory ? `Remembering ${det.name}` : "" }); }}>+ Add a date</button>
            )}
          </section>

          {children}

          {det.canRemovePerson && (
            <section className="edit-card danger-card">
              <div>
                <h3>Remove {det.name} from the family</h3>
                <p className="small">Their photos stay on the site. Their name comes off photo tags. Mary can restore them.</p>
              </div>
              <button type="button" className="btn danger-btn" onClick={removePerson}>Remove {det.name}</button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
