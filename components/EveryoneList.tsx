"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Member } from "@/lib/home";
import { Avatar } from "./Avatar";
import { Halo } from "./Halo";

const KEY = "df_everyone_order";
const photos = (n: number) => `${n} ${n === 1 ? "photo" : "photos"}`;

function Grid({ people }: { people: Member[] }) {
  return (
    <ul className="everyone-grid">
      {people.map((p) => (
        <li key={p.id}>
          <Link href={`/people/${p.id}`} className="member">
            <Halo on={p.inMemory} name={p.name}><Avatar name={p.name} url={p.avatarUrl} /></Halo>
            <span className="member-name">{p.name}</span>
            <span className="member-sub">{photos(p.photos)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Home's Everyone list: family order by default (Dunya, then her family, then partners and extended family), or A to Z. */
export function EveryoneList({ family, others }: { family: Member[]; others: Member[] }) {
  const [mode, setMode] = useState<"family" | "az">("family");
  useEffect(() => { try { if (localStorage.getItem(KEY) === "az") setMode("az"); } catch { /* private browsing */ } }, []);
  const pick = (m: "family" | "az") => { setMode(m); try { localStorage.setItem(KEY, m); } catch { /* private browsing */ } };
  const az = [...family, ...others].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <div className="section-head">
        <div className="everyone-title">
          <h2 className="section-title">Everyone</h2>
          <div className="order-toggle" role="group" aria-label="Order">
            <button type="button" aria-pressed={mode === "family"} onClick={() => pick("family")}>Family order</button>
            <button type="button" aria-pressed={mode === "az"} onClick={() => pick("az")}>A to Z</button>
          </div>
        </div>
        <Link href="/people" className="text-link small">
          <span className="desktop-only">See the family tree <span aria-hidden="true">→</span></span>
          <span className="phone-only">Family tree</span>
        </Link>
      </div>
      {mode === "az" ? <Grid people={az} /> : (
        <>
          <Grid people={family} />
          {others.length > 0 && (
            <>
              <p className="everyone-divider"><span>Partners and extended family</span></p>
              <Grid people={others} />
            </>
          )}
        </>
      )}
    </>
  );
}
