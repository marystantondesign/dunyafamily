"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "./Icon";
import { DateFields, dateBody, type DateDraft } from "./PeopleBits";
import { TagPicker, type Option, type Picked } from "./TagPicker";

/** From the Add menu: an anniversary or other important date on someone's profile. */
export function AddDateForm({ people, kind }: { people: Option[]; kind: DateDraft["kind"] }) {
  const router = useRouter();
  const [who, setWho] = useState<Picked[]>([]);
  const [draft, setDraft] = useState<DateDraft>({ kind, label: "", month: "", day: "", year: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const personId = typeof who[0] === "number" ? who[0] : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!personId) return setError("Choose whose date this is.");
    if (!draft.month || !draft.day) return setError("Choose a month and day.");
    setBusy(true);
    const res = await fetch(`/api/people/${personId}/dates`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dateBody(draft)) });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "That didn't save. Try again.");
    router.push(`/people/${personId}`);
    router.refresh();
  }

  return (
    <form className="add-person" onSubmit={submit}>
      <div className="add-person-head">
        <Link href="/" className="icon-btn" aria-label="Close"><Icon name="x" size={22} /></Link>
        <h1>Add an important date</h1>
      </div>
      <TagPicker label="Whose date is it" options={people} value={who} onChange={(v) => setWho(v.filter((x) => typeof x === "number").slice(-1))} placeholder="Start typing a name" hint="Not in the family yet? Add them first from the Family page." />
      <DateFields value={draft} onChange={setDraft} idPrefix="nd" />
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn btn-primary add-person-go" disabled={busy}>{busy ? "Saving" : "Add date"}</button>
    </form>
  );
}
