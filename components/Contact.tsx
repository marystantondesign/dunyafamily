"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { addressLines, formatPhone, phoneHref, validEmail, type Address } from "@/lib/contact";
import { Icon } from "./Icon";

export type ContactView = { address: Address | null; flagged: boolean; raw: string | null; email: string | null; phone: string | null };
export type AnniversaryView = { id: number; month: number; day: number; year: number | null; label: string; onCalendar: boolean };

const first = (n: string) => n.split(/\s+/)[0];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const dateText = (a: { month: number; day: number; year: number | null }) => `${MONTHS[a.month - 1]} ${a.day}${a.year ? `, ${a.year}` : ""}`;

/** Text and Call: open Messages and the phone's dialer with the number filled in. */
export function PhoneActions({ digits, name }: { digits: string; name: string }) {
  const href = phoneHref(digits);
  return (
    <span className="ct-phone-actions">
      <a href={`sms:${href}`} aria-label={`Text ${first(name)}`} className="ct-pill">Text</a>
      <a href={`tel:${href}`} aria-label={`Call ${first(name)}`} className="ct-pill">Call</a>
    </span>
  );
}

type Fields = { street: string; apt: string; city: string; state: string; zip: string; phone: string; email: string };
const fieldsOf = (c: ContactView | null): Fields => ({
  street: c?.address?.street ?? "", apt: c?.address?.apt ?? "", city: c?.address?.city ?? "", state: c?.address?.state ?? "", zip: c?.address?.zip ?? "",
  phone: c?.phone ? formatPhone(c.phone) : "", email: c?.email ?? "",
});

/** Saves address, phone, email and sharing. Address parts go only when typed in or already saved in parts. */
async function saveContact(personId: number, f: Fields, share: boolean, sendAddress: boolean) {
  const res = await fetch(`/api/people/${personId}/contact`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...(sendAddress ? { address: { street: f.street, apt: f.apt, city: f.city, state: f.state, zip: f.zip } } : {}), email: f.email, phone: f.phone, share }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "That didn't save. Try again.");
}

function Face({ name, url }: { name: string; url: string | null }) {
  return (
    <span className="ab-face" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" /> : name.charAt(0)}
    </span>
  );
}

/**
 * The Address book's inline editing (admin): street, apt or suite, city, state, ZIP, phone, email, and sharing. The
 * same data as the person's own Edit profile.
 */
export function ContactForm({ personId, name, avatarUrl, contact, share, onDone }: {
  personId: number; name: string; avatarUrl: string | null; contact: ContactView | null; share: boolean; onDone: () => void;
}) {
  const router = useRouter();
  const [f, setF] = useState<Fields>(fieldsOf(contact));
  const [shared, setShared] = useState(share);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setF({ ...f, [k]: e.target.value }); if (["street", "apt", "city", "state", "zip"].includes(k)) setTouched(true); setError("");
  };
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (f.email.trim() && !validEmail(f.email)) return setError("That email doesn't look right.");
    setBusy(true); setError("");
    try { await saveContact(personId, f, shared, touched || !!contact?.address); router.refresh(); onDone(); }
    catch (err) { setError((err as Error).message); }
    setBusy(false);
  }
  const field = (k: keyof Fields, label: string, cls: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className={`ct-field ${cls}`}><span>{label}</span><input value={f[k]} onChange={set(k)} {...props} /></label>
  );
  return (
    <form className="ab-edit" onSubmit={save} noValidate aria-label={`${name}'s contact info`}>
      <div className="ab-edit-name"><Face name={name} url={avatarUrl} />{name}</div>
      {contact?.flagged && !touched && <p className="ct-flag">This address couldn&apos;t be read into parts: <strong>{contact.raw}</strong>. Type it into the fields below.</p>}
      <div className="ab-edit-grid">
        {field("street", "Street address", "g-street", { autoComplete: "street-address" })}
        {field("apt", "Apt, suite", "g-apt")}
        {field("city", "City", "g-city")}
        {field("state", "State", "g-state", { maxLength: 20 })}
        {field("zip", "ZIP", "g-zip", { inputMode: "numeric", maxLength: 10 })}
        {field("phone", "Phone", "g-phone", { type: "tel", autoComplete: "tel" })}
        {field("email", "Email", "g-email", { type: "email", autoComplete: "email" })}
      </div>
      <div className="ab-edit-foot">
        <label className="ct-check"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />Share with the family</label>
        <span className="ab-edit-btns">
          <button type="button" className="btn" onClick={onDone}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Saving" : "Save"}</button>
        </span>
      </div>
      {error && <p className="ct-error" role="alert">{error}</p>}
    </form>
  );
}

function CopyAll({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="ct-btn" disabled={!text} onClick={async () => {
      try { await navigator.clipboard.writeText(text); } catch { /* the browser said no */ }
      setDone(true); setTimeout(() => setDone(false), 1600);
    }}><span aria-live="polite">{done ? "Copied" : label}</span></button>
  );
}

export type BookRow = { id: number; name: string; avatarUrl: string | null; contact: ContactView | null; shared: boolean };

/**
 * The Address book: copy buttons, then everyone in the family in family order. Desktop: a compact table. Phone: one
 * row per person with only the details they have. The admin edits any row in place.
 */
export function AddressBookList({ rows, admin, title, sub }: { rows: BookRow[]; admin: boolean; title: string; sub: string }) {
  const [editing, setEditing] = useState<number | null>(null);
  const [phoneOpen, setPhoneOpen] = useState<number | null>(null);
  const oneLine = (c: ContactView | null) => (c?.address ? addressLines(c.address).filter(Boolean).join(", ") : c?.raw?.replace(/\n/g, ", ") ?? "");
  const block = (c: ContactView | null) => (c?.address ? addressLines(c.address).filter(Boolean).join("\n") : c?.raw ?? "");
  const addresses = rows.filter((r) => block(r.contact)).map((r) => `${r.name}\n${block(r.contact)}`).join("\n\n");
  const emails = rows.map((r) => r.contact?.email).filter(Boolean).join(", ");
  const phones = rows.filter((r) => r.contact?.phone).map((r) => `${r.name}: ${formatPhone(r.contact!.phone)}`).join("\n");

  return (
    <>
      <div className="ab-top">
        <div className="ab-intro">
          <h1>{title}</h1>
          <p>{sub}</p>
        </div>
        <div className="ct-tools">
          <CopyAll text={addresses} label="Copy addresses" />
          <CopyAll text={emails} label="Copy emails" />
          <CopyAll text={phones} label="Copy phone numbers" />
          <a className="ct-btn" href="/api/addresses" download>Download spreadsheet</a>
        </div>
      </div>
      <div className="ab-table">
        <div className="ab-head" aria-hidden="true"><span>Name</span><span>Mailing address</span><span>Phone</span><span>Email</span><span /></div>
        {rows.map((r) => {
          if (editing === r.id) return <ContactForm key={r.id} personId={r.id} name={r.name} avatarUrl={r.avatarUrl} contact={r.contact} share={r.shared} onDone={() => setEditing(null)} />;
          const c = r.contact;
          const addr = oneLine(c);
          return (
            <div key={r.id} className="ab-row">
              <span className="ab-name"><Face name={r.name} url={r.avatarUrl} /><Link href={`/people/${r.id}`}>{r.name}</Link></span>
              <span className="ab-addr">{addr}{admin && c?.flagged && <span className="ab-flag">Check this address</span>}</span>
              <span className="ab-tel">
                {c?.phone && (
                  <>
                    <span className="ab-tel-text">{formatPhone(c.phone)}</span>
                    <button type="button" className="ab-phone" aria-expanded={phoneOpen === r.id} onClick={() => setPhoneOpen(phoneOpen === r.id ? null : r.id)}>{formatPhone(c.phone)}</button>
                    {phoneOpen === r.id && <PhoneActions digits={c.phone} name={r.name} />}
                  </>
                )}
              </span>
              <span className="ab-mail">{c?.email && <a href={`mailto:${c.email}`}>{c.email}</a>}</span>
              <span className="ab-act">
                {admin && <button type="button" className="ab-editbtn" aria-label={`Edit ${r.name}`} onClick={() => setEditing(r.id)}><Icon name="pencil" size={16} />Edit</button>}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

/**
 * The profile's contact card: mailing address and anniversaries side by side, then phone and email (side by side on
 * desktop, stacked on phones), in the same two columns. Only what
 * exists shows. Text and Call show on phones, on other people's profiles.
 */
export function ProfileContactCard({ name, contact, anniversaries, self }: {
  name: string; contact: ContactView | null; anniversaries: AnniversaryView[]; self: boolean;
}) {
  const [l1, l2] = contact?.address ? addressLines(contact.address) : [contact?.raw ?? "", ""];
  const label = (icon: "mail" | "calendar" | "phone" | "at", text: string) => <span className="pc-label"><Icon name={icon} size={16} />{text}</span>;
  const hasAddr = !!(l1 || l2);
  return (
    <section className="pc-card" aria-label="Contact info">
      {(hasAddr || anniversaries.length > 0) && (
        <div className="pc-row">
          {hasAddr && <div className="pc-item">{label("mail", "Mailing address")}<span className="pc-value">{l1}{l2 && <><br />{l2}</>}</span></div>}
          {anniversaries.length > 0 && (
            <div className="pc-item">
              {label("calendar", "Anniversaries")}
              {anniversaries.map((a) => (
                <span key={a.id} className="pc-ann"><span className="pc-value">{dateText(a)}</span>{a.label && <span className="pc-note">{a.label}</span>}</span>
              ))}
            </div>
          )}
        </div>
      )}
      {(contact?.phone || contact?.email) && (
        <div className="pc-row pc-reach">
          {contact?.phone && (
            <div className="pc-item">
              {label("phone", "Phone")}
              <span className="pc-phone"><span className="pc-value">{formatPhone(contact.phone)}</span>{!self && <span className="pc-actions"><PhoneActions digits={contact.phone} name={name} /></span>}</span>
            </div>
          )}
          {contact?.email && <div className="pc-item">{label("at", "Email")}<a href={`mailto:${contact.email}`} className="pc-value pc-email">{contact.email}</a></div>}
        </div>
      )}
    </section>
  );
}

type AnnDraft = { key: string; id: number | null; month: string; day: string; year: string; label: string; onCalendar: boolean };
let seq = 0;
const draftOf = (a: AnniversaryView): AnnDraft => ({ key: `a${a.id}`, id: a.id, month: String(a.month), day: String(a.day), year: a.year ? String(a.year) : "", label: a.label, onCalendar: a.onCalendar });

/**
 * Edit profile: a bottom sheet on phones and a centered window on desktop. Mailing address, phone and email,
 * anniversaries, and sharing, saved together.
 */
export function EditProfile({ personId, name, self, contact, share, anniversaries }: {
  personId: number; name: string; self: boolean; contact: ContactView | null; share: boolean; anniversaries: AnniversaryView[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Fields>(fieldsOf(contact));
  const [shared, setShared] = useState(share);
  const [anns, setAnns] = useState<AnnDraft[]>(anniversaries.map(draftOf));
  const [touched, setTouched] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const panel = useRef<HTMLDivElement>(null);

  const reset = () => { setF(fieldsOf(contact)); setShared(share); setAnns(anniversaries.map(draftOf)); setTouched(false); setDirty(false); setError(""); };
  const close = () => { if (dirty && !window.confirm("Leave without saving your changes?")) return; setOpen(false); reset(); };
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    document.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [open]);

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setF({ ...f, [k]: e.target.value }); setDirty(true); setError("");
    if (["street", "apt", "city", "state", "zip"].includes(k)) setTouched(true);
  };
  const setAnn = (key: string, patch: Partial<AnnDraft>) => { setAnns((cur) => cur.map((a) => (a.key === key ? { ...a, ...patch } : a))); setDirty(true); setError(""); };

  async function save() {
    if (f.email.trim() && !validEmail(f.email)) return setError("That email doesn't look right.");
    if (anns.some((a) => !a.month || !a.day)) return setError("Choose a month and day for each anniversary, or remove it.");
    setBusy(true); setError("");
    try {
      await saveContact(personId, f, shared, touched || !!contact?.address);
      const res = await fetch(`/api/people/${personId}/anniversaries`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anniversaries: anns.map((a) => ({ id: a.id, month: Number(a.month), day: Number(a.day), year: a.year || null, label: a.label, onCalendar: a.onCalendar })) }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "That didn't save. Try again.");
      setDirty(false); setOpen(false);
      router.refresh();
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  }

  const field = (k: keyof Fields, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="ep-field"><span>{label}</span><input value={f[k]} onChange={set(k)} {...props} /></label>
  );
  return (
    <>
      <button type="button" className="btn btn-primary profile-edit" onClick={() => { reset(); setOpen(true); }}>Edit profile</button>
      {open && (
        <div className="ep-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="ep-panel" role="dialog" aria-modal="true" aria-labelledby="ep-title" ref={panel} tabIndex={-1}>
            <div className="ep-head">
              <button type="button" className="ep-cancel" onClick={close}>Cancel</button>
              <h2 id="ep-title">{self ? "Edit your details" : `Edit ${first(name)}'s details`}</h2>
              <span aria-hidden="true" />
            </div>
            <div className="ep-body">
              <section>
                <h3 className="ep-section">Mailing address</h3>
                {contact?.flagged && !touched && <p className="ct-flag">This address couldn&apos;t be read into parts: <strong>{contact.raw}</strong>. Type it into the fields below.</p>}
                {field("street", "Street", { autoComplete: "street-address" })}
                <div className="ep-two">
                  {field("apt", "Apt, suite")}
                  {field("city", "City", { autoComplete: "address-level2" })}
                  {field("state", "State", { maxLength: 20, autoComplete: "address-level1" })}
                  {field("zip", "ZIP", { inputMode: "numeric", maxLength: 10, autoComplete: "postal-code" })}
                </div>
              </section>
              <section>
                <h3 className="ep-section">Phone and email</h3>
                {field("phone", "Phone", { type: "tel", placeholder: "(555) 555-5555", autoComplete: "tel" })}
                {field("email", "Email", { type: "email", placeholder: "name@example.com", autoComplete: "email" })}
              </section>
              <section>
                <h3 className="ep-section">Anniversaries</h3>
                <p className="ep-help">Weddings, remembrance days, any date you&apos;d like the family to know about.</p>
                {anns.map((a) => (
                  <div key={a.key} className="ep-ann">
                    <div className="ep-two">
                      <div className="ep-field">
                        <span>Date</span>
                        <span className="ep-date">
                          <select aria-label="Month" value={a.month} onChange={(e) => setAnn(a.key, { month: e.target.value })}>
                            <option value="">Month</option>
                            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                          </select>
                          <select aria-label="Day" value={a.day} onChange={(e) => setAnn(a.key, { day: e.target.value })}>
                            <option value="">Day</option>
                            {Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
                          </select>
                        </span>
                      </div>
                      <label className="ep-field"><span>Year <span className="ep-opt">(optional)</span></span>
                        <input inputMode="numeric" value={a.year} onChange={(e) => setAnn(a.key, { year: e.target.value.replace(/\D/g, "").slice(0, 4) })} /></label>
                    </div>
                    <label className="ep-field"><span>What is it?</span>
                      <input value={a.label} maxLength={80} placeholder="Our wedding" onChange={(e) => setAnn(a.key, { label: e.target.value })} /></label>
                    <div className="ep-ann-foot">
                      <label className="ct-check"><input type="checkbox" checked={a.onCalendar} onChange={(e) => setAnn(a.key, { onCalendar: e.target.checked })} />Show on the family calendar</label>
                      <button type="button" className="ep-remove" onClick={() => { setAnns((cur) => cur.filter((x) => x.key !== a.key)); setDirty(true); }}>Remove</button>
                    </div>
                  </div>
                ))}
                <button type="button" className="ep-add" onClick={() => { setAnns((cur) => [...cur, { key: `n${++seq}`, id: null, month: "", day: "", year: "", label: "", onCalendar: true }]); setDirty(true); }}>
                  <Icon name="plus" size={16} stroke={2.4} />Add an anniversary
                </button>
              </section>
              <label className="ct-check ep-share"><input type="checkbox" checked={shared} onChange={(e) => { setShared(e.target.checked); setDirty(true); }} />{self ? "Share my address, phone and email with the family" : "Share their address, phone and email with the family"}</label>
              <Link href={`/people/${personId}/edit`} className="ep-more">Name, birthday and other details</Link>
              {error && <p className="ct-error" role="alert">{error}</p>}
            </div>
            <div className="ep-foot">
              <button type="button" className="btn" onClick={close}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{busy ? "Saving" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
