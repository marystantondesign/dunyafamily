"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TagPicker, type Option, type Picked } from "./TagPicker";

type Tag = { id: number; name: string; removable: boolean };
type PersonTag = Tag & { canSetAvatar: boolean; isAvatar: boolean };

export function PhotoEditor({ photoId, people, occasions, allPeople, allOccasions, meta, canEditMeta }: {
  photoId: number; people: PersonTag[]; occasions: Tag[]; allPeople: Option[]; allOccasions: Option[];
  meta: { year: number | null; decade: number | null; caption: string | null }; canEditMeta: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function call(url: string, method: string, body: unknown) {
    setError("");
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "That didn't save. Try again.");
    router.refresh();
  }
  const addTag = (kind: "person" | "occasion") => (v: Picked[]) => { const last = v[v.length - 1]; if (last !== undefined) call(`/api/photos/${photoId}/tags`, "POST", { kind, value: last }); };
  const removeTag = (kind: "person" | "occasion", id: number) => call(`/api/photos/${photoId}/tags`, "DELETE", { kind, value: id });

  const yearEditable = canEditMeta || meta.year === null;
  const captionEditable = canEditMeta || !meta.caption;

  return (
    <>
      <div className="meta-block">
        <p className="label" style={{ margin: "0 0 8px" }}>Who&apos;s here</p>
        <ul className="rows">
          {people.map((p) => (
            <li key={p.id}>
              <Link href={`/people/${p.id}`}>{p.name}</Link>
              <span style={{ display: "flex", gap: 12 }}>
                {p.isAvatar ? <span className="small muted">Profile photo</span> : p.canSetAvatar && (
                  <button className="link-btn" onClick={() => call(`/api/people/${p.id}`, "PATCH", { avatarPhotoId: photoId })}>Use as profile photo</button>
                )}
                {p.removable && <button className="link-btn danger" onClick={() => removeTag("person", p.id)}>Remove</button>}
              </span>
            </li>
          ))}
        </ul>
        <div style={{ marginTop: 10 }}>
          <TagPicker label="Add someone" options={allPeople.filter((o) => !people.some((p) => p.id === o.id))} value={[]} onChange={addTag("person")} placeholder="Start typing a name" />
        </div>
      </div>

      <div className="meta-block">
        <p className="label" style={{ margin: "0 0 8px" }}>Occasion</p>
        <div className="pills">
          {occasions.map((o) => (
            <span key={o.id} className="pill on">
              {o.name}
              {o.removable && <button className="link-btn" aria-label={`Remove ${o.name}`} onClick={() => removeTag("occasion", o.id)}>×</button>}
            </span>
          ))}
        </div>
        <div style={{ marginTop: 10 }}>
          <TagPicker label="Add an occasion" options={allOccasions.filter((o) => !occasions.some((x) => x.id === o.id))} value={[]} onChange={addTag("occasion")} placeholder="Christmas, Birthday, Summer" />
        </div>
      </div>

      {(yearEditable || captionEditable) && (
        <form
          className="meta-block form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const body: Record<string, unknown> = {};
            if (yearEditable) {
              const y = String(f.get("year") ?? "").trim();
              const d = String(f.get("decade") ?? "");
              if (y) body.year = Number(y);
              else if (d) body.decade = Number(d);
              else if (canEditMeta) body.year = null;
            }
            if (captionEditable) body.caption = String(f.get("caption") ?? "");
            call(`/api/photos/${photoId}`, "PATCH", body);
          }}
        >
          {yearEditable && (
            <div className="row-2">
              <div className="field">
                <label htmlFor="year">Year</label>
                <input id="year" name="year" inputMode="numeric" defaultValue={meta.year ?? ""} placeholder="1994" />
              </div>
              <div className="field">
                <label htmlFor="decade">Or decade</label>
                <select id="decade" name="decade" defaultValue={meta.year ? "" : meta.decade ?? ""}>
                  <option value="">Not sure</option>
                  {Array.from({ length: 11 }, (_, i) => 1930 + i * 10).map((d) => <option key={d} value={d}>{d}s</option>)}
                </select>
              </div>
            </div>
          )}
          {captionEditable && (
            <div className="field">
              <label htmlFor="caption">A memory or note</label>
              <textarea id="caption" name="caption" rows={2} defaultValue={meta.caption ?? ""} placeholder="The year the turkey caught fire" />
            </div>
          )}
          <button className="btn" style={{ justifySelf: "start" }}>Save</button>
        </form>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </>
  );
}
