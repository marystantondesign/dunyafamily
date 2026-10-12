"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Elder, FPerson, TreeNode } from "@/lib/family";
import { Halo } from "./Halo";
import { Icon } from "./Icon";

const SHOWN_DEPTH = 2; // Dunya, her children, and her grandchildren show without expanding.

function Face({ p }: { p: FPerson }) {
  return (
    <Halo on={p.inMemory} name={p.name}>
      <span className="tdot-face" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.avatarUrl ? <img src={p.avatarUrl} alt="" /> : p.name.charAt(0)}
      </span>
    </Halo>
  );
}

function Dot({ p, size, label }: { p: FPerson; size: "root" | "lg" | "md" | "sm"; label?: string }) {
  return (
    <Link href={`/people/${p.id}`} className={`tdot tdot-${size}`}>
      <Face p={p} />
      <span className="tdot-name">{p.name}</span>
      {label && <span className="tdot-sub">{label}</span>}
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
          <Face p={node.person} />
          <span><span className="tcard-name">{node.person.name}</span>{node.person.year && <span className="tdot-sub">b. {node.person.year}</span>}</span>
          {!hasMore && <Icon name="chevronRight" size={20} className="tcard-chev" />}
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
                  <Face p={pt} />
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

/** Phone: one person as a card row (avatar, name, what they are to Dunya, chevron). */
function PhoneRow({ p, role }: { p: FPerson; role: string }) {
  return (
    <li className="tcard plain">
      <div className="tcard-head">
        <Link href={`/people/${p.id}`} className="tcard-link">
          <Face p={p} />
          <span><span className="tcard-name">{p.name}</span><span className="tdot-sub">{role}</span></span>
          <Icon name="chevronRight" size={20} className="tcard-chev" />
        </Link>
      </div>
    </li>
  );
}

export function FamilyTree({ tree, earlier, siblings, everyone }: {
  tree: TreeNode | null; earlier: Elder[][]; siblings: Elder[]; everyone: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [all, setAll] = useState(false);
  const hasEarlier = earlier.length > 0 || siblings.length > 0;
  const [showEarlier, setShowEarlier] = useState(true);
  // On phones, earlier generations start hidden on every visit.
  const [phoneEarlier, setPhoneEarlier] = useState(false);
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
  const rootDot = root && (
    <div className="tcouple">
      <Link href={`/people/${root.id}`} className="tdot tdot-root">
        <Face p={root} />
        <span className="tdot-name">{rootName}</span>
        <span className="tdot-sub">Matriarch</span>
      </Link>
      {tree!.partners.map((pt) => (
        <span key={pt.id} className="tpartner">
          <span className="tpartner-line" aria-hidden="true" />
          <Dot p={pt} size="md" label="Partner" />
        </span>
      ))}
    </div>
  );

  return (
    <>
      <div className="tree-tools">
        <div className="search-field tree-find">
          <Icon name="search" />
          <input aria-label="Find a person" placeholder="Find a person" list="family-names" value={find}
            onChange={(e) => go(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") go(find); }} />
          <datalist id="family-names">{everyone.map((p) => <option key={p.id} value={p.name} />)}</datalist>
        </div>
        {tree && tree.children.some((c) => c.children.length) && (
          <button type="button" className="btn desktop-only" aria-pressed={all} onClick={() => setAll(!all)}>{all ? "Collapse" : "Expand all"}</button>
        )}
        {hasEarlier && (
          <button type="button" className="btn desktop-only" aria-expanded={showEarlier} onClick={() => setShowEarlier(!showEarlier)}>
            <Icon name={showEarlier ? "chevronUp" : "chevronDown"} size={16} /> {showEarlier ? "Hide earlier generations" : "Show earlier generations"}
          </button>
        )}
        <Link href="/people/addresses" className="btn tree-address">Address book</Link>
      </div>
      {root && (hasEarlier || tree!.partners.length > 0) && (
        <button type="button" className="btn tree-phone-toggle phone-only" aria-expanded={phoneEarlier} onClick={() => setPhoneEarlier(!phoneEarlier)}>
          <Icon name={phoneEarlier ? "chevronUp" : "chevronDown"} size={16} /> {phoneEarlier ? "Hide" : "Show"} {root.name}&apos;s parents, siblings, and partners
        </button>
      )}

      {tree && root ? (
        <div className="tree">
          <div className="tree-phone-top">
            {phoneEarlier && (
              <div className="tree-phone-earlier">
                {[["Parents", earlier[0] ?? []], ["Siblings", siblings]].map(([label, list]) => (list as Elder[]).length > 0 && (
                  <section key={label as string}>
                    <h2 className="tree-phone-label">{label as string}</h2>
                    <ul>{(list as Elder[]).map((p) => <PhoneRow key={p.id} p={p} role={p.role} />)}</ul>
                  </section>
                ))}
                {tree.partners.length > 0 && (
                  <section>
                    <h2 className="tree-phone-label">Partners</h2>
                    <ul>{tree.partners.map((p) => <PhoneRow key={p.id} p={p} role="Partner" />)}</ul>
                  </section>
                )}
              </div>
            )}
            <Link href={`/people/${root.id}`} className="tdot tdot-root">
              <Face p={root} />
              <span className="tdot-name">{rootName}</span>
              <span className="tdot-sub">Matriarch</span>
            </Link>
            {tree.children.length > 0 && <h2 className="tree-phone-label">Children, oldest first</h2>}
          </div>
          <div className="tree-desk">
          {hasEarlier && showEarlier ? (
            // Earlier generations: grandparents, then parents, then Dunya with her brothers and sisters beside her.
            <div className="tree-earlier-box">
              {[...earlier].reverse().map((gen, i) => (
                <div key={i} className="tree-gen-row">
                  {gen.map((p) => <Dot key={p.id} p={p} size="sm" label={p.role} />)}
                </div>
              ))}
              <div className="tree-chart tree-root-row">
                <ul className={earlier.length ? "" : "no-parents"}>
                  {siblings.map((p) => <li key={p.id}><Dot p={p} size="sm" label={p.role} /></li>)}
                  <li className="is-root">{rootDot}</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="tree-root">{rootDot}</div>
          )}
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
