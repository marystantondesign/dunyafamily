"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Sub = { id: number; from: string; at: string; about: string[]; title: string; body: string; photos: { full: string; thumb: string }[] };

function When({ iso }: { iso: string }) {
  const [t, setT] = useState("");
  useEffect(() => {
    const d = new Date(iso);
    setT(`${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`);
  }, [iso]);
  return <>{t}</>;
}

/** Each submitted story in full, with its photos. Mary can remove one. */
export function SubmittedList({ list }: { list: Sub[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(list);
  if (!rows.length) return <p className="ms-empty">No one has sent a story yet.</p>;
  return (
    <div className="sub-list">
      {rows.map((r) => (
        <article key={r.id} className="sub-card">
          <p className="sub-meta">From <strong>{r.from}</strong> · <When iso={r.at} />{r.about.length > 0 && <> · About {r.about.join(", ")}</>}</p>
          {r.title && <h2>{r.title}</h2>}
          {r.body.split(/\n\s*\n/).map((para, i) => <p key={i} className="sub-body">{para}</p>)}
          {r.photos.length > 0 && (
            <div className="sub-photos">
              {r.photos.map((p, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <a key={i} href={p.full} target="_blank" rel="noreferrer"><img src={p.thumb} alt={`Photo ${i + 1}`} /></a>
              ))}
            </div>
          )}
          <button type="button" className="sf-link danger" onClick={async () => {
            if (!window.confirm("Remove this story? It can be brought back later if you need it.")) return;
            const res = await fetch(`/api/stories/submit/${r.id}`, { method: "DELETE" });
            if (res.ok) { setRows((cur) => cur.filter((x) => x.id !== r.id)); router.refresh(); }
          }}>Remove</button>
        </article>
      ))}
    </div>
  );
}
