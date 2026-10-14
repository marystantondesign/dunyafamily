"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Elder, FPerson, TreeNode } from "@/lib/family";
import type { Earlier } from "@/lib/treeLayout";
import { Halo } from "./Halo";
import { Icon } from "./Icon";
import { TreeCanvas } from "./TreeCanvas";


export function Face({ p }: { p: FPerson }) {
  return (
    <Halo on={p.inMemory} name={p.name}>
      <span className="tdot-face" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.avatarUrl ? <img src={p.avatarUrl} alt="" /> : p.name.charAt(0)}
      </span>
    </Halo>
  );
}

/** Phone: a list of cards under Dunya. Tap the arrow to see a partner and children. */
export function PhoneBranch({ node, depth }: { node: TreeNode; depth: number }) {
  const [open, setOpen] = useState(false);
  const partners = [...node.groups.filter((g) => g.partner && !g.coparent).map((g) => ({ person: g.partner!, label: g.label })), ...node.partners];
  const coGroups = node.groups.filter((g) => g.coparent && g.partner);
  const coKids = new Set(coGroups.flatMap((g) => g.children.map((c) => c.person.id)));
  const hasMore = partners.length > 0 || node.children.length > 0;
  return (
    <li className={depth === 1 ? "tcard" : "trow"}>
      <div className="tcard-head">
        <Link href={`/people/${node.person.id}`} className="tcard-link">
          <Face p={node.person} />
          <span><span className="tcard-name">{node.person.name}</span>{node.person.year && <span className="tdot-sub">b. {node.person.year}</span>}</span>
          {!hasMore && <Icon name="chevronRight" size={20} className="tcard-chev" />}
        </Link>
        {hasMore && (
          <button type="button" className="tcard-toggle" aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} ${node.person.name}'s family`} onClick={() => setOpen(!open)}>
            <Icon name={open ? "chevronDown" : "chevronRight"} size={22} />
          </button>
        )}
      </div>
      {open && (
        <ul className="tsub">
          {partners.map((pt) => (
            <li key={pt.person.id} className="trow tpartner-row">
              <div className="tcard-head">
                <Link href={`/people/${pt.person.id}`} className="tcard-link">
                  <Face p={pt.person} />
                  <span className="tcard-name">{pt.person.name}</span>
                </Link>
              </div>
            </li>
          ))}
          {node.children.filter((c) => !coKids.has(c.person.id)).map((c) => <PhoneBranch key={c.person.id} node={c} depth={depth + 1} />)}
          {/* Co-parents: small, on the line that leads to the children they share. */}
          {coGroups.map((g) => (
            <li key={`co${g.partner!.id}`} className="tco-group">
              <Link href={`/people/${g.partner!.id}`} className="tco"><Face p={g.partner!} /> {g.partner!.name}</Link>
              <ul className="tsub">{g.children.map((c) => <PhoneBranch key={c.person.id} node={c} depth={depth + 1} />)}</ul>
            </li>
          ))}
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
          <span><span className="tcard-name">{p.name}</span>{role && <span className="tdot-sub">{role}</span>}</span>
          <Icon name="chevronRight" size={20} className="tcard-chev" />
        </Link>
      </div>
    </li>
  );
}

export function FamilyTree({ tree, earlier, siblings, everyone, earlierTree, openEarlier = false }: {
  tree: TreeNode | null; earlier: Elder[][]; siblings: Elder[]; everyone: { id: number; name: string }[];
  /** Parents, grandparents, and siblings for the desktop tree. */
  earlierTree: Earlier | null;
  /** Start with earlier generations showing (coming back from a sibling's family page). */
  openEarlier?: boolean;
}) {
  const router = useRouter();
  const hasEarlier = earlier.length > 0 || siblings.length > 0;
  // Earlier generations start hidden, unless coming back from a sibling's tree.
  const [showEarlier, setShowEarlier] = useState(openEarlier);
  const deskEarlier = !!earlierTree && (earlierTree.parents.length + earlierTree.older.length + earlierTree.younger.length) > 0;
  const [phoneEarlier, setPhoneEarlier] = useState(false);
  const [find, setFind] = useState("");
  // Too narrow for the whole tree: show the list version instead of scrolling sideways.
  const [narrow, setNarrow] = useState(false);

  function go(value: string) {
    setFind(value);
    const hit = everyone.find((p) => p.name.toLowerCase() === value.trim().toLowerCase());
    if (hit) router.push(`/people/${hit.id}`);
  }

  const root = tree?.person;
  const rootName = root ? [root.name, ...root.aliases.filter((a) => a.toLowerCase() !== root.name.toLowerCase()).slice(0, 1)].join(" / ") : "";
  const allPartners = tree ? [...tree.partners, ...tree.groups.filter((g) => g.partner && !g.coparent).map((g) => ({ person: g.partner!, label: g.label }))] : [];

  return (
    <>
      <div className="tree-tools">
        <div className="search-field tree-find">
          <Icon name="search" />
          <input aria-label="Find a person" placeholder="Find a person" list="family-names" value={find}
            onChange={(e) => go(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") go(find); }} />
          <datalist id="family-names">{everyone.map((p) => <option key={p.id} value={p.name} />)}</datalist>
        </div>
        {deskEarlier && (
          <button type="button" className="btn desktop-only" aria-expanded={showEarlier} onClick={() => setShowEarlier(!showEarlier)}>
            <Icon name={showEarlier ? "chevronUp" : "chevronDown"} size={16} /> {showEarlier ? "Hide earlier generations" : "Show earlier generations"}
          </button>
        )}
        <Link href="/people/addresses" className="btn tree-address">Address book</Link>
      </div>
      {root && (hasEarlier || allPartners.length > 0) && (
        <button type="button" className="btn tree-phone-toggle phone-only" aria-expanded={phoneEarlier} onClick={() => setPhoneEarlier(!phoneEarlier)}>
          <Icon name={phoneEarlier ? "chevronUp" : "chevronDown"} size={16} /> {phoneEarlier ? "Hide" : "Show"} {root.name}&apos;s parents, siblings, and partners
        </button>
      )}

      {tree && root ? (
        <div className={`tree${narrow ? " narrow" : ""}`}>
          <div className="tree-phone-top">
            {phoneEarlier && (
              <div className="tree-phone-earlier">
                {[["Parents", earlier[0] ?? []], ["Siblings", siblings]].map(([label, list]) => (list as Elder[]).length > 0 && (
                  <section key={label as string}>
                    <h2 className="tree-phone-label">{label as string}</h2>
                    <ul>{(list as Elder[]).map((p) => <PhoneRow key={p.id} p={p} role={p.role} />)}</ul>
                  </section>
                ))}
                {allPartners.length > 0 && (
                  <section>
                    <h2 className="tree-phone-label">Partners</h2>
                    <ul>{allPartners.map((p) => <PhoneRow key={p.person.id} p={p.person} role="" />)}</ul>
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
          <div className="tree-phone-groups">
            {tree.groups.map((g) => (
              <div key={g.partner?.id ?? "none"} className="tree-phone-group">
                {g.partner && tree.groups.length > 1 && <p className="tree-phone-grouplabel">{root.name} and {g.partner.name}</p>}
                <ul className="tree-phone">{g.children.map((c) => <PhoneBranch key={c.person.id} node={c} depth={1} />)}</ul>
              </div>
            ))}
          </div>

          {/* Desktop: laid out to fit the page. Earlier generations, when shown, sit above in their own box. */}
          <div className="tree-desk tl-desk">
            <TreeCanvas tree={tree} onNarrow={setNarrow} earlier={showEarlier ? earlierTree : null} />
          </div>
          {tree.children.length === 0 && <p className="muted tree-empty">No one is connected to {root.name} yet. Mary can add her children in Settings, then Family tree.</p>}
        </div>
      ) : (
        <p className="muted tree-empty">The tree grows from Dunya. Mary can add her and her children in Settings, then Family tree.</p>
      )}
    </>
  );
}
