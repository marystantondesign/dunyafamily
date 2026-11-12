"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { addressLines, formatPhone, phoneHref, validEmail, type Address } from "@/lib/contact";
import { Icon } from "./Icon";

export type ContactView = { address: Address | null; flagged: boolean; raw: string | null; email: string | null; phone: string | null };
export type AnniversaryView = { id: number; month: number; day: number; year: number | null; label: string; text: string };

const first = (n: string) => n.split(/\s+/)[0];

/** Text and Call: open Messages and the phone's dialer with the number filled in. */
export function PhoneActions({ digits, name }: { digits: string; name: string }) {
  const href = phoneHref(digits);
  return (
    <span className="ct-phone-actions">
      <a href={`sms:${href}`} aria-label={`Text ${first(name)}`} className="ct-pill"><Icon name="comment" size={16} />Text</a>
      <a href={`tel:${href}`} aria-label={`Call ${first(name)}`} className="ct-pill"><Icon name="phone" size={16} />Call</a>
    </span>
  );
}

/**
 * The contact fields: street, apt or suite, city, state, ZIP, email, phone, and sharing. Address fields are only
 * sent when touched, so an old address that couldn't be read into parts stays as it was.
 */
export function ContactForm({ personId, name, contact, share, columns, onDone, extra }: {
  personId: number; name: string; contact: ContactView | null; share: boolean; columns: 2 | 4;
  onDone: (saved: boolean) => void; extra?: React.ReactNode;
}) {
  const router = useRouter();
  const a = contact?.address;
  const [f, setF] = useState({ street: a?.street ?? "", apt: a?.apt ?? "", city: a?.city ?? "", state: a?.state ?? "", zip: a?.zip ?? "",
    email: contact?.email ?? "", phone: contact?.phone ? formatPhone(contact.phone) : "" });
  const [shared, setShared] = useState(share);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f, addr = false) => (e: React.ChangeEvent<HTMLInputElement>) => { setF({ ...f, [k]: e.target.value }); if (addr) setTouched(true); setError(""); };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (f.email.trim() && !validEmail(f.email)) return setError("That email doesn't look right.");
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/people/${personId}/contact`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(touched || a ? { address: { street: f.street, apt: f.apt, city: f.city, state: f.state, zip: f.zip } } : {}), email: f.email, phone: f.phone, share: shared }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error ?? "That didn't save. Try again.");
      router.refresh();
      onDone(true);
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  }

  const field = (k: keyof typeof f, label: React.ReactNode, props: React.InputHTMLAttributes<HTMLInputElement> = {}, addr = false, wide = "") => (
    <label className={`ct-field ${wide}`}>
      <span>{label}</span>
      <input value={f[k]} onChange={set(k, addr)} {...props} />
    </label>
  );
  return (
    <form className={`ct-form cols-${columns}`} onSubmit={save} noValidate aria-label={`${name}'s contact info`}>
      {contact?.flagged && !touched && (
        <p className="ct-flag">This address couldn&apos;t be read into parts: <strong>{contact.raw}</strong>. Type it into the fields below.</p>
      )}
      <div className="ct-grid">
        {field("street", "Street address", { autoComplete: "street-address" }, true, "all")}
        {field("apt", <>Apt, suite <span className="ct-opt">(optional)</span></>, {}, true)}
        {field("city", "City", {}, true)}
        {field("state", "State", { maxLength: 20 }, true)}
        {field("zip", "ZIP", { inputMode: "numeric", maxLength: 10 }, true)}
        {field("email", "Email", { type: "email", placeholder: "name@example.com", autoComplete: "email" }, false, "half")}
        {field("phone", "Phone", { type: "tel", placeholder: "(555) 555-5555", autoComplete: "tel" }, false, "half")}
      </div>
      <label className="ct-share"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />Share with the family</label>
      {extra}
      {error && <p className="ct-error" role="alert">{error}</p>}
      <div className="ct-actions">
        <button type="button" className="ct-cancel" onClick={() => onDone(false)}>Cancel</button>
        <button className="ct-save" disabled={busy}>{busy ? "Saving" : "Save"}</button>
      </div>
    </form>
  );
}

function CopyAll({ text, label, icon }: { text: string; label: string; icon?: "copy" | "mail" | "phone" }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="ct-btn" disabled={!text} onClick={async () => {
      try { await navigator.clipboard.writeText(text); } catch { /* the browser said no */ }
      setDone(true); setTimeout(() => setDone(false), 1600);
    }}>{icon && <Icon name={icon} size={18} />}<span aria-live="polite">{done ? "Copied" : label}</span></button>
  );
}

export type BookRow = { id: number; name: string; contact: ContactView | null; updated: string | null; shared: boolean };

/** The Address book: copy buttons, then each person's address, email, and phone. The admin edits a row in place. */
export function AddressBookList({ rows, admin, intro }: { rows: BookRow[]; admin: boolean; intro: React.ReactNode }) {
  const [editing, setEditing] = useState<number | null>(null);
  const [phoneOpen, setPhoneOpen] = useState<number | null>(null);
  const text = (c: ContactView | null) => (c?.address ? addressLines(c.address).filter(Boolean).join("\n") : c?.raw ?? "");
  const addresses = rows.filter((r) => text(r.contact)).map((r) => `${r.name}\n${text(r.contact)}`).join("\n\n");
  const emails = rows.map((r) => r.contact?.email).filter(Boolean).join(", ");
  const phones = rows.filter((r) => r.contact?.phone).map((r) => `${r.name}: ${formatPhone(r.contact!.phone)}`).join("\n");

  return (
    <>
      <div className="ab-top">
        {intro}
        <div className="ct-tools">
          <CopyAll text={addresses} label="Copy addresses" icon="copy" />
          <CopyAll text={emails} label="Copy emails" icon="mail" />
          <CopyAll text={phones} label="Copy phone numbers" icon="phone" />
          <a className="ct-btn" href="/api/addresses" download>Download spreadsheet</a>
        </div>
      </div>
      <div className="ab-list">
        {rows.map((r) => {
          const c = r.contact;
          if (editing === r.id)
            return (
              <div key={r.id} className="ab-edit">
                <h2>{r.name}</h2>
                <ContactForm personId={r.id} name={r.name} contact={c} share={r.shared} columns={4} onDone={() => setEditing(null)} />
              </div>
            );
          const [l1, l2] = c?.address ? addressLines(c.address) : [c?.raw ?? "", ""];
          return (
            <div key={r.id} className="ab-row">
              <Link href={`/people/${r.id}`} className="ab-name">{r.name}</Link>
              <span className="ab-addr">
                {l1 || l2 ? <><span>{l1}</span>{l2 && <span>{l2}</span>}</> : <span className="ab-none">No address yet</span>}
                {admin && c?.flagged && <span className="ab-flag">Check this address</span>}
              </span>
              <span className="ab-reach">
                {c?.email ? <a href={`mailto:${c.email}`} className="ab-email">{c.email}</a> : <span className="ab-none">No email yet</span>}
                {c?.phone ? (
                  <>
                    <button type="button" className="ab-phone" aria-expanded={phoneOpen === r.id} onClick={() => setPhoneOpen(phoneOpen === r.id ? null : r.id)}>{formatPhone(c.phone)}</button>
                    {phoneOpen === r.id && <PhoneActions digits={c.phone} name={r.name} />}
                  </>
                ) : <span className="ab-none">No phone yet</span>}
              </span>
              <span className="ab-meta">
                <span>{r.shared ? r.updated : admin ? "Not shared with the family" : null}</span>
                {admin && <button type="button" className="ab-editbtn" aria-label={`Edit ${r.name}`} onClick={() => setEditing(r.id)}>Edit</button>}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Anniversaries in the profile's contact editing: each one with a remove button, and a small form to add one. */
function AnniversaryEditor({ personId, list }: { personId: number; list: AnniversaryView[] }) {
  const router = useRouter();
  const [d, setD] = useState({ month: "", day: "", year: "", label: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function add() {
    if (!d.month || !d.day) return setError("Choose a month and day.");
    setBusy(true); setError("");
    const res = await fetch(`/api/people/${personId}/dates`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "anniversary", label: d.label, month: Number(d.month), day: Number(d.day), year: d.year ? Number(d.year) : null }),
    });
    if (res.ok) { setD({ month: "", day: "", year: "", label: "" }); router.refresh(); }
    else setError((await res.json().catch(() => ({}))).error ?? "That didn't save.");
    setBusy(false);
  }
  async function remove(a: AnniversaryView) {
    if (!window.confirm(`Remove ${a.text}?`)) return;
    await fetch(`/api/person-dates/${a.id}`, { method: "DELETE" });
    router.refresh();
  }
  return (
    <fieldset className="ct-anniv">
      <legend>Anniversaries</legend>
      {list.length > 0 && (
        <ul>
          {list.map((a) => (
            <li key={a.id}><span>{a.text}</span><button type="button" aria-label={`Remove ${a.text}`} onClick={() => remove(a)}><Icon name="x" size={16} stroke={2} /></button></li>
          ))}
        </ul>
      )}
      <div className="ct-anniv-add">
        <select aria-label="Month" value={d.month} onChange={(e) => setD({ ...d, month: e.target.value })}>
          <option value="">Month</option>
          {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <input aria-label="Day" inputMode="numeric" placeholder="Day" value={d.day} onChange={(e) => setD({ ...d, day: e.target.value.replace(/\D/g, "").slice(0, 2) })} />
        <input aria-label="Year (optional)" inputMode="numeric" placeholder="Year" value={d.year} onChange={(e) => setD({ ...d, year: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
        <input aria-label="Note (optional)" placeholder="Note, like a pet’s name (optional)" value={d.label} onChange={(e) => setD({ ...d, label: e.target.value })} className="wide" />
        <button type="button" className="ct-btn" disabled={busy} onClick={add}><Icon name="plus" size={16} stroke={2} />Add anniversary</button>
      </div>
      {error && <p className="ct-error" role="alert">{error}</p>}
    </fieldset>
  );
}

/**
 * The profile's contact card: mailing address and anniversaries side by side, then phone (with Text and Call), then
 * email. One pencil opens the contact editing, for the person themselves or the admin.
 */
export function ProfileContactCard({ personId, name, contact, share, anniversaries, canEdit }: {
  personId: number; name: string; contact: ContactView | null; share: boolean; anniversaries: AnniversaryView[]; canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [open]);
  const [l1, l2] = contact?.address ? addressLines(contact.address) : [contact?.raw ?? "", ""];
  const label = (icon: "mail" | "heart" | "phone" | "at", text: string) => <span className="pc-label"><Icon name={icon} size={14} />{text}</span>;
  const none = <span className="pc-none">Not added yet</span>;
  return (
    <section className="pc-card" aria-label="Contact info">
      {canEdit && <button type="button" className="pc-edit" aria-label="Edit contact info" onClick={() => setOpen(true)}><Icon name="pencil" size={20} /></button>}
      <div className="pc-item">
        {label("mail", "Mailing address")}
        {l1 || l2 ? <span className="pc-value">{l1}{l2 && <><br />{l2}</>}</span> : none}
      </div>
      <div className="pc-item pc-anniv">
        {label("heart", "Anniversaries")}
        {anniversaries.length ? anniversaries.map((a, i) => <span key={a.id} className={i === 0 ? "pc-value" : "pc-more"}>{a.text}</span>) : none}
      </div>
      <div className="pc-item pc-wide">
        {label("phone", "Phone")}
        {contact?.phone ? (
          <span className="pc-phone"><span className="pc-value">{formatPhone(contact.phone)}</span><PhoneActions digits={contact.phone} name={name} /></span>
        ) : none}
      </div>
      <div className="pc-item pc-wide">
        {label("at", "Email")}
        {contact?.email ? <a href={`mailto:${contact.email}`} className="pc-value pc-email">{contact.email}</a> : none}
      </div>
      {open && (
        <div className="modal-backdrop pc-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="modal pc-modal" role="dialog" aria-modal="true" aria-labelledby="pc-title">
            <div className="pc-modal-head">
              <h2 id="pc-title">{first(name)}&apos;s contact info</h2>
              <button type="button" className="icon-btn" aria-label="Close" onClick={() => setOpen(false)}><Icon name="x" size={22} /></button>
            </div>
            <ContactForm personId={personId} name={name} contact={contact} share={share} columns={2} onDone={() => setOpen(false)}
              extra={<AnniversaryEditor personId={personId} list={anniversaries} />} />
          </div>
        </div>
      )}
    </section>
  );
}
