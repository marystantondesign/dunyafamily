"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FPerson, TreeNode } from "@/lib/family";
import { Icon } from "./Icon";

const SHOWN_DEPTH = 2; // Dunya, her children, and her grandchildren show without expanding.
const GEN_NAMES = ["Parents", "Grandparents", "Great-grandparents"];
const genName = (i: number) => GEN_NAMES[i] ?? `${"Great-".repeat(i - 1)}grandparents`;

function Dot({ p, size, label }: { p: FPerson; size: "root" | "lg" | "md" | "sm"; label?: string }) {
  return (
    <Link href={`/people/${p.id}`} className={`tdot tdot-${size}`}>
      <span className="tdot-face" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.avatarUrl ? <img src={p.avatarUrl} alt="" /> : p.name.charAt(0)}
      </span>
      <span className="tdot-name">{p.name}</span>
      {(label || p.inMemory) && <span className="tdot-sub">{[label, p.inMemory ? "In memory" : ""].filter(Boolean).join(", ")}</span>}
    </Link>
  );
}

const count = (n: TreeNode): number => n.children.reduce((sum, c) => sum + 1 + count(c), 0);

/** Desktop: a chart that branches down from Dunya. Deeper generations open one branch at a time, or all at once. */
function Branch({ node, depth, all, open, toggle }: { node: TreeNode; depth: number; all: boolean; open: Set<number>; toggle: (id: number) => void }) {
  const size = depth === 1 ? "lg" : depth === 2 ? "md" : "sm";
  const showKids = node.children.length > 0 && (depth < SHOWN_DEPTH || all || open.has(node.person.id));
  return (
    <li>
      <div className="tcouple">
        <Dot p={node.person} size={size} />
        {node.partners.map((pt) => (
          <span key={pt.id} className="tpartner">
            <span className="tpartner-line" aria-hidden="true" />
            <Dot p={pt} size="sm" label="Partner" />
          </span>
        ))}
      </div>
      {node.children.length > 0 && !showKids && (
        <button type="button" className="tmore" aria-expanded={false} onClick={() => toggle(node.person.id)}>
          <Icon name="chevronDown" size={14} /> {count(node)} more
        </button>
      )}
      {showKids && (
        <>
          {depth >= SHOWN_DEPTH && !all && (
            <button type="button" className="tmore" aria-expanded onClick={() => toggle(node.person.id)}><Icon name="chevronUp" size={14} /> Less</button>
          )}
          <ul>{node.children.map((c) => <Branch key={c.person.id} node={c} depth={depth + 1} all={all} open={open} toggle={toggle} />)}</ul>
        </>
      )}
    </li>
  );
}

/** Phone: a list of cards under Dunya. Tap the arrow to see a partner and children. */
function PhoneBranch({ node, depth, all }: { node: TreeNode; depth: number; all: boolean }) {
  const [open, setOpen] = useState(false);
  const hasMore = node.partners.length > 0 || node.children.length > 0;
  const shown = hasMore && (open || all);
  return (
    <li className={depth === 1 ? "tcard" : "trow"}>
      <div className="tcard-head">
        <Link href={`/people/${node.person.id}`} className="tcard-link">
          <span className="tdot-face" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {node.person.avatarUrl ? <img src={node.person.avatarUrl} alt="" /> : node.person.name.charAt(0)}
          </span>
          <span><span className="tcard-name">{node.person.name}</span>{node.person.inMemory && <span className="tdot-sub">In memory</span>}</span>
        </Link>
        {hasMore && (
          <button type="button" className="tcard-toggle" aria-expanded={shown} aria-label={`${shown ? "Hide" : "Show"} ${node.person.name}'s family`} onClick={() => setOpen(!open)}>
            <Icon name={shown ? "chevronDown" : "chevronRight"} size={22} />
          </button>
        )}
      </div>
      {shown && (
        <ul className="tsub">
          {node.partners.map((pt) => (
            <li key={pt.id} className="trow">
              <div className="tcard-head">
                <Link href={`/people/${pt.id}`} className="tcard-link">
                  <span className="tdot-face" aria-hidden="true">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {pt.avatarUrl ? <img src={pt.avatarUrl} alt="" /> : pt.name.charAt(0)}
                  </span>
                  <span><span className="tcard-name">{pt.name}</span><span className="tdot-sub">Partner</span></span>
                </Link>
              </div>
            </li>
          ))}
          {node.children.map((c) => <PhoneBranch key={c.person.id} node={c} depth={depth + 1} all={all} />)}
        </ul>
      )}
    </li>
  );
}

export function FamilyTree({ tree, earlier, everyone }: { tree: TreeNode | null; earlier: FPerson[][]; everyone: { id: number; name: string }[] }) {
  const router = useRouter();
  const [all, setAll] = useState(false);
  const [showEarlier, setShowEarlier] = useState(false);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [find, setFind] = useState("");
  const toggle = (id: number) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  function go(value: string) {
    setFind(value);
    const hit = everyone.find((p) => p.name.toLowerCase() === value.trim().toLowerCase());
    if (hit) router.push(`/people/${hit.id}`);
  }

  const root = tree?.person;
  const rootName = root ? [root.name, ...root.aliases.filter((a) => a.toLowerCase() !== root.name.toLowerCase()).slice(0, 1)].join(" / ") : "";

  return (
    <>
      <div className="tree-tools">
        {tree && tree.children.some((c) => c.children.length) && (
          <button type="button" className="btn" aria-pressed={all} onClick={() => setAll(!all)}>{all ? "Collapse" : "Expand all"}</button>
        )}
        <div className="search-field tree-find">
          <Icon name="search" />
          <input aria-label="Find a person" placeholder="Find a person..." list="family-names" value={find}
            onChange={(e) => go(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") go(find); }} />
          <datalist id="family-names">{everyone.map((p) => <option key={p.id} value={p.name} />)}</datalist>
        </div>
      </div>

      {tree && root ? (
        <div className="tree">
          {earlier.length > 0 && (
            <div className="tree-earlier">
              <button type="button" className="btn btn-quiet" aria-expanded={showEarlier} onClick={() => setShowEarlier(!showEarlier)}>
                <Icon name={showEarlier ? "chevronDown" : "chevronUp"} size={16} /> Earlier generations
              </button>
              {showEarlier && (
                <div className="tree-gens">
                  {[...earlier].map((gen, i) => ({ gen, i })).reverse().map(({ gen, i }) => (
                    <div key={i} className="tree-gen">
                      <span className="tree-gen-label">{genName(i)}</span>
                      <div className="tree-gen-people">{gen.map((p) => <Dot key={p.id} p={p} size="md" />)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="tree-root">
            <div className="tcouple">
              <Link href={`/people/${root.id}`} className="tdot tdot-root">
                <span className="tdot-face" aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {root.avatarUrl ? <img src={root.avatarUrl} alt="" /> : root.name.charAt(0)}
                </span>
                <span className="tdot-name">{rootName}</span>
                <span className="tdot-sub">Matriarch</span>
              </Link>
              {tree.partners.map((pt) => (
                <span key={pt.id} className="tpartner">
                  <span className="tpartner-line" aria-hidden="true" />
                  <Dot p={pt} size="md" label="Partner" />
                </span>
              ))}
            </div>
          </div>

          {tree.children.length > 0 ? (
            <>
              <div className="tree-chart">
                <ul>{tree.children.map((c) => <Branch key={c.person.id} node={c} depth={1} all={all} open={open} toggle={toggle} />)}</ul>
              </div>
              <ul className="tree-phone">{tree.children.map((c) => <PhoneBranch key={c.person.id} node={c} depth={1} all={all} />)}</ul>
            </>
          ) : (
            <p className="muted tree-empty">No one is connected to {root.name} yet. Open her children&apos;s pages, choose Edit details, and add {root.name} as their parent.</p>
          )}
        </div>
      ) : (
        <p className="muted tree-empty">The tree grows from Dunya. Add her to the family, then add her children from their pages.</p>
      )}
    </>
  );
}
