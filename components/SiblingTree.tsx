"use client";
import Link from "next/link";
import { useState } from "react";
import type { TreeNode } from "@/lib/family";
import { Face, PhoneBranch } from "./FamilyTree";
import { TreeCanvas } from "./TreeCanvas";

/** A brother's or sister's own family tree, built the same way as Dunya's. Phones get the list version. */
export function SiblingTree({ tree, sub }: { tree: TreeNode; sub: string }) {
  const [narrow, setNarrow] = useState(false);
  const root = tree.person;
  return (
    <div className={`tree${narrow ? " narrow" : ""}`}>
      <div className="tree-phone-top">
        <Link href={`/people/${root.id}`} className="tdot tdot-root">
          <Face p={root} />
          <span className="tdot-name">{root.name}</span>
          <span className="tdot-sub">{sub}</span>
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
      <div className="tree-desk tl-desk">
        <TreeCanvas tree={tree} onNarrow={setNarrow} branch={{ sub }} />
      </div>
    </div>
  );
}
