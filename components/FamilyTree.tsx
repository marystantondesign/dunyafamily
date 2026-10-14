"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import type { Elder, FPerson, KidGroup, TreeNode } from "@/lib/family";
import { Halo } from "./Halo";
import { Icon } from "./Icon";

// Smallest the whole tree may shrink to fit the window, before it scrolls instead.
const MIN_SCALE = 0.75;

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

/** One person: the root is depth 0, children 1, grandchildren 2, and so on. Each depth is a little smaller. */
function Dot({ p, depth, label }: { p: FPerson; depth: number; label?: string }) {
  return (
    <Link href={`/people/${p.id}`} className={`tdot ft-d${Math.min(depth, 4)}`}>
      <Face p={p} />
      <span className="tdot-name">{p.name}</span>
      {label && <span className="tdot-sub">{label}</span>}
    </Link>
  );
}

const names = (list: string[]) =>
  list.length <= 1 ? list.join("") : list.length === 2 ? list.join(" and ") : `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`;

/** A co-parent: small, no label, sitting just beside the line that drops to the children they share. */
function CoParent({ p }: { p: FPerson }) {
  return (
    <span className="ft-co" aria-hidden="false">
      <span className="ft-co-gap" />
      <span className="ft-co-stem" />
      <Link href={`/people/${p.id}`} className="ft-co-who">
        <span className="ft-co-tie" aria-hidden="true" />
        <span className="ft-co-face"><Face p={p} /><span className="ft-co-name">{p.name}</span></span>
      </Link>
    </span>
  );
}

/**
 * A person, partners beside them, and their children below, grouped by the other parent when there's more than
 * one. Each co-parent group gets its own drop line with the co-parent small beside it; children with no other
 * parent recorded hang straight off the person's line.
 */
function Branch({ node, depth }: { node: TreeNode; depth: number }) {
  const normal = node.groups.filter((g) => !g.coparent);
  const single = normal.length === 1 && node.groups.length === 1 ? normal[0] : null;
  const beside = [
    ...(single?.partner ? [{ person: single.partner, label: single.label }] : []),
    ...node.partners,
  ];
  const kids = (g: KidGroup) => g.children.map((c) => <Branch key={c.person.id} node={c} depth={depth + 1} />);
  // Children with no other parent recorded, alongside co-parent groups, hang straight off the person's line.
  const hasCo = node.groups.some((g) => g.coparent);
  return (
    <li>
      <div className="tcouple">
        <Dot p={node.person} depth={depth} />
        {beside.map((pt) => (
          <span key={pt.person.id} className="tpartner">
            <span className="tpartner-line" aria-hidden="true" />
            <Dot p={pt.person} depth={depth + 1} label={pt.label} />
          </span>
        ))}
      </div>
      {single && single.children.length > 0 && <ul>{kids(single)}</ul>}
      {!single && node.groups.length > 0 && (
        <ul>
          {node.groups.flatMap((g) => {
            if (g.coparent && g.partner) {
              return [(
                <li key={`co${g.partner.id}`} className="ft-cogroup">
                  <CoParent p={g.partner} />
                  <ul>{kids(g)}</ul>
                </li>
              )];
            }
            if (!g.partner && hasCo) return kids(g);
            return [(
              <li key={g.partner?.id ?? "none"} className="ft-subgroup">
                {g.partner && <span className="ft-subtab"><Face p={g.partner} /> With {g.partner.name}</span>}
                <ul>{kids(g)}</ul>
              </li>
            )];
          })}
        </ul>
      )}
    </li>
  );
}

/** Dunya's children with one partner: a soft card with the other parent's tab on top, and the children's tree hanging from it. */
function GroupCard({ root, g }: { root: FPerson; g: KidGroup }) {
  const kids = <ul className="ft-kids">{g.children.map((c) => <Branch key={c.person.id} node={c} depth={1} />)}</ul>;
  if (!g.partner) return <li className="ft-group plain">{kids}</li>;
  return (
    <li className="ft-group">
      <div className="ft-card">
        <Link href={`/people/${g.partner.id}`} className="ft-tab" aria-label={`${root.name} and ${g.partner.name}: ${names(g.children.map((c) => c.person.name))}`}>
          <Face p={g.partner} />
          <strong>{g.partner.name}</strong>
        </Link>
        {kids}
      </div>
    </li>
  );
}

/** Phone: a list of cards under Dunya. Tap the arrow to see a partner and children. */
function PhoneBranch({ node, depth }: { node: TreeNode; depth: number }) {
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
            <li key={pt.person.id} className="trow">
              <div className="tcard-head">
                <Link href={`/people/${pt.person.id}`} className="tcard-link">
                  <Face p={pt.person} />
                  <span><span className="tcard-name">{pt.person.name}</span><span className="tdot-sub">{pt.label}</span></span>
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
          <span><span className="tcard-name">{p.name}</span><span className="tdot-sub">{role}</span></span>
          <Icon name="chevronRight" size={20} className="tcard-chev" />
        </Link>
      </div>
    </li>
  );
}

/** Shrinks the tree to fit the width (down to 75%) instead of scrolling sideways. */
function useFit() {
  const wrap = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, height: 0 as number | undefined, offset: 0 });
  useLayoutEffect(() => {
    const w = wrap.current, el = inner.current;
    if (!w || !el) return;
    const measure = () => {
      const natural = el.scrollWidth, room = w.clientWidth;
      // Hidden (phones): nothing to measure.
      if (!natural || !room) return;
      const scale = Math.max(MIN_SCALE, Math.min(1, room / natural));
      setFit({ scale, height: el.offsetHeight * scale, offset: Math.max(0, (room - natural * scale) / 2) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(w);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { wrap, inner, fit };
}

export function FamilyTree({ tree, earlier, siblings, everyone }: {
  tree: TreeNode | null; earlier: Elder[][]; siblings: Elder[]; everyone: { id: number; name: string }[];
}) {
  const router = useRouter();
  const hasEarlier = earlier.length > 0 || siblings.length > 0;
  // Earlier generations start hidden on every visit.
  const [showEarlier, setShowEarlier] = useState(false);
  const [phoneEarlier, setPhoneEarlier] = useState(false);
  const [find, setFind] = useState("");
  const { wrap, inner, fit } = useFit();

  function go(value: string) {
    setFind(value);
    const hit = everyone.find((p) => p.name.toLowerCase() === value.trim().toLowerCase());
    if (hit) router.push(`/people/${hit.id}`);
  }

  const root = tree?.person;
  const rootName = root ? [root.name, ...root.aliases.filter((a) => a.toLowerCase() !== root.name.toLowerCase()).slice(0, 1)].join(" / ") : "";
  const allPartners = tree ? [...tree.partners, ...tree.groups.filter((g) => g.partner && !g.coparent).map((g) => ({ person: g.partner!, label: g.label }))] : [];
  const rootBlock = root && (
    <div className="ft-root">
      <Link href={`/people/${root.id}`} className="tdot ft-d0">
        <Face p={root} />
        <span className="tdot-name">{rootName}</span>
        <span className="tdot-sub">Matriarch</span>
      </Link>
      {/* A partner with no children together stands beside Dunya, joined by a double line. */}
      {tree!.partners.map((pt) => (
        <span key={pt.person.id} className="ft-spouse">
          <span className="ft-double" aria-hidden="true" />
          <Dot p={pt.person} depth={1} label={pt.label} />
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
        {hasEarlier && (
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
                {allPartners.length > 0 && (
                  <section>
                    <h2 className="tree-phone-label">Partners</h2>
                    <ul>{allPartners.map((p) => <PhoneRow key={p.person.id} p={p.person} role={p.label} />)}</ul>
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

          <div className="tree-desk ft-fit" ref={wrap} style={{ height: fit.height, overflowX: fit.scale <= MIN_SCALE ? "auto" : "hidden" }}>
            <div className="ft" ref={inner} style={{ transform: `translateX(${fit.offset}px) scale(${fit.scale})` }}>
              {hasEarlier && showEarlier ? (
                // Earlier generations: grandparents, then parents, then Dunya with her brothers and sisters beside her.
                <div className="tree-earlier-box">
                  {[...earlier].reverse().map((gen, i) => (
                    <div key={i} className="tree-gen-row">
                      {gen.map((p) => <Dot key={p.id} p={p} depth={3} label={p.role} />)}
                    </div>
                  ))}
                  <div className="tree-root-row">
                    <ul className={earlier.length ? "" : "no-parents"}>
                      {siblings.map((p) => <li key={p.id}><Dot p={p} depth={2} label={p.role} /></li>)}
                      <li className="is-root">{rootBlock}</li>
                    </ul>
                  </div>
                </div>
              ) : rootBlock}
              {tree.groups.length > 0 && (
                <ul className="ft-groups">{tree.groups.map((g) => <GroupCard key={g.partner?.id ?? "none"} root={root} g={g} />)}</ul>
              )}
            </div>
          </div>
          {tree.children.length > 0
            ? <p className="ft-note desktop-only">Everyone is shown. Children are oldest to youngest, left to right.</p>
            : <p className="muted tree-empty">No one is connected to {root.name} yet. Mary can add her children in Settings, then Family tree.</p>}
        </div>
      ) : (
        <p className="muted tree-empty">The tree grows from Dunya. Mary can add her and her children in Settings, then Family tree.</p>
      )}
    </>
  );
}
