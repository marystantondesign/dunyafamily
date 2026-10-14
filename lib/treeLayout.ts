import type { FPerson, KidGroup, TreeNode } from "./family";

/**
 * The desktop family tree, laid out bottom-up. Each branch is only as wide as its widest generation needs: branches
 * are pushed together row by row (a contour per row), a parent sits centered over the span of their children, and
 * siblings keep a consistent gap. Partners sit beside their family member; co-parents sit on the drop line to the
 * children they share. Everything is in pixels; the page scales it to fit, or falls back to the phone list.
 */

export type Measure = (text: string, size: number, bold?: boolean) => number;
/** Before fonts can be measured (server render), a close estimate for Libre Caslon. */
export const estimate: Measure = (t, size, bold) => t.length * size * (bold ? 0.6 : 0.52);

const DIA = [72, 60, 46, 38, 32, 28];
const FONT = [22, 17, 14, 12, 11, 11];
const dia = (d: number) => DIA[Math.min(d, DIA.length - 1)];
const font = (d: number) => FONT[Math.min(d, FONT.length - 1)];
/** Partners and co-parents: one small size for everyone who married into or had a child with the family. */
export const SMALL = 22;
export const SMALL_FONT = 11;
const DASH = 14;
const NOTCH = 10;
const GAP = 22;
const BAND = 72;
const NAME_GAP = 3;
const LH = 1.15;
/** A partner's name goes under their circle unless it's wider than this; then it goes on the outer side. */
const UNDER_MAX = 46;
const BOX_PAD = 26;
const BOX_GAP = 20;
const TAB_H = 40;

const nameH = (size: number) => Math.ceil(size * LH);
/** Height of a family member's block: circle, then name. */
const blockH = (d: number) => dia(d) + NAME_GAP + nameH(font(d));

export type Item = {
  key: string; p: FPerson; kind: "member" | "small";
  /** Circle center. */
  x: number; y: number; size: number; fontSize: number;
  name: "under" | "left" | "right"; bold?: boolean; sub?: string;
};
export type Seg = [number, number, number, number];
export type Box = { x: number; y: number; w: number; h: number; tab: { x: number; w: number; p: FPerson } | null };
export type Layout = { width: number; height: number; items: Item[]; segs: Seg[]; boxes: Box[] };

type Ext = { l: number; r: number };
type Sub = { items: Item[]; segs: Seg[]; contour: Ext[]; bottom: number };

const merge = (a: Ext[], b: Ext[], dx = 0): Ext[] => {
  const out = a.map((e) => ({ ...e }));
  b.forEach((e, i) => {
    const s = { l: e.l + dx, r: e.r + dx };
    out[i] = out[i] ? { l: Math.min(out[i].l, s.l), r: Math.max(out[i].r, s.r) } : s;
  });
  return out;
};
const move = (s: Sub, dx: number, dy: number): Sub => ({
  items: s.items.map((it) => ({ ...it, x: it.x + dx, y: it.y + dy })),
  segs: s.segs.map(([a, b, c, d]) => [a + dx, b + dy, c + dx, d + dy] as Seg),
  contour: s.contour.map((e) => ({ l: e.l + dx, r: e.r + dx })),
  bottom: s.bottom + dy,
});

/** A small circle beside a family member, on the given side, with the name under it or on the outer side. */
function partnerAt(p: FPerson, side: 1 | -1, memberSize: number, cy: number, m: Measure): { item: Item; ext: Ext; dash: Seg } {
  const x0 = side * (memberSize / 2);
  const cx = x0 + side * (DASH + SMALL / 2);
  const w = m(p.name, SMALL_FONT);
  const under = w <= UNDER_MAX;
  const half = Math.max(SMALL, w) / 2;
  const ext = under ? { l: cx - half, r: cx + half }
    : side > 0 ? { l: cx - SMALL / 2, r: cx + SMALL / 2 + 5 + w } : { l: cx - SMALL / 2 - 5 - w, r: cx + SMALL / 2 };
  return {
    item: { key: `pt${p.id}`, p, kind: "small", x: cx, y: cy, size: SMALL, fontSize: SMALL_FONT, name: under ? "under" : side > 0 ? "right" : "left" },
    ext, dash: [x0, cy, x0 + side * DASH, cy],
  };
}

type Slot = { variants: Sub[]; anchor: "person" | "co" };

/** Lay out a row of slots left to right, each as close as its contour allows. Picks each slot's best variant. */
function placeRow(slots: Slot[]) {
  let merged: Ext[] = [];
  const placed: { sub: Sub; x: number }[] = [];
  for (const s of slots) {
    let best: { sub: Sub; x: number; right: number } | null = null;
    for (const v of s.variants) {
      let x = 0;
      if (placed.length) {
        x = -Infinity;
        v.contour.forEach((e, i) => { if (merged[i]) x = Math.max(x, merged[i].r - e.l + GAP); });
        if (x === -Infinity) x = 0;
      }
      const right = Math.max(...merge(merged, v.contour, x).map((e) => e.r));
      if (!best || right < best.right - 0.5) best = { sub: v, x, right };
    }
    placed.push({ sub: best!.sub, x: best!.x });
    merged = merge(merged, best!.sub.contour, best!.x);
  }
  return { placed, merged };
}

/**
 * The children of one family member (or of a co-parent group), with the lines from `dropX` down to them.
 * `top` is the y of the children's circles; the split line sits just under the parent.
 */
function childrenRow(slots: Slot[], dropX: number, dropY: number, splitY: number, top: number): Sub | null {
  if (!slots.length) return null;
  const { placed } = placeRow(slots);
  const a0 = placed[0].x, a1 = placed[placed.length - 1].x;
  const shift = dropX - (a0 + a1) / 2;
  let out: Sub = { items: [], segs: [], contour: [], bottom: top };
  for (const pl of placed) {
    const s = move(pl.sub, pl.x + shift, 0);
    out = { items: [...out.items, ...s.items], segs: [...out.segs, ...s.segs], contour: merge(out.contour, s.contour), bottom: Math.max(out.bottom, s.bottom) };
  }
  const xs = placed.map((pl) => pl.x + shift);
  // Down from the parent, across the children, and down to each one (a co-parent group draws its own stem).
  out.segs.push([dropX, dropY, dropX, splitY]);
  if (xs.length > 1) out.segs.push([Math.min(...xs), splitY, Math.max(...xs), splitY]);
  placed.forEach((_, i) => { if (slots[i].anchor === "person") out.segs.push([xs[i], splitY, xs[i], top]); });
  return out;
}

/** A co-parent and the children they share: the co-parent on the drop line, then the children below. */
function coGroup(g: KidGroup, d: number, splitY: number, top: number, m: Measure): Sub {
  const coY = splitY + 22;
  const kids = childrenRow(g.children.map((c) => personSlot(c, d + 1, top, m)), 0, coY, coY + 18, top);
  const p = g.partner!;
  const w = m(p.name, SMALL_FONT);
  const item: Item = { key: `co${p.id}`, p, kind: "small", x: NOTCH + SMALL / 2, y: coY, size: SMALL, fontSize: SMALL_FONT, name: "right" };
  // The co-parent sits in the band between the generations, beside the line.
  const band = merge([{ l: -1, r: NOTCH + SMALL + 5 + w }], kids ? kids.contour.slice(0, 1) : []);
  return {
    items: [item, ...(kids?.items ?? [])],
    segs: [[0, splitY, 0, coY], [0, coY, NOTCH, coY], ...(kids?.segs ?? [])],
    contour: [...band, ...(kids ? kids.contour.slice(1) : [])],
    bottom: kids?.bottom ?? coY + SMALL,
  };
}

/** A family member's slot in their parents' row: the person (and partner) at `top`, their family below. */
function personSlot(node: TreeNode, d: number, top: number, m: Measure): Slot {
  const variants = layoutMember(node, d, m).map((v) => {
    const s = move(v, 0, top);
    // The band above them only holds the line that comes down to them.
    return { ...s, contour: [{ l: -1, r: 1 }, ...s.contour] };
  });
  return { variants, anchor: "person" };
}

/** One family member with partners and descendants, in their own frame: circle top at y = 0, centered on x = 0. */
function layoutMember(node: TreeNode, d: number, m: Measure): Sub[] {
  const size = dia(d), fs = font(d), cy = size / 2;
  const nameW = m(node.person.name, fs);
  const me: Item = { key: `m${node.person.id}`, p: node.person, kind: "member", x: 0, y: cy, size, fontSize: fs, name: "under" };
  const half = Math.max(size, nameW) / 2;

  const single = node.groups.length === 1 && !node.groups[0].coparent ? node.groups[0] : null;
  const kidsPartner = single?.partner ?? null;
  const others = node.partners.map((pt) => pt.person);

  // Children: co-parent groups on their own drop lines; the rest hang straight off the parent's line.
  const h = blockH(d), splitY = h + 14, top = h + BAND;
  const slots: Slot[] = node.groups.flatMap((g) => (g.coparent && g.partner)
    ? [{ variants: [coGroup(g, d, splitY, top, m)], anchor: "co" as const }]
    : g.children.map((c) => personSlot(c, d + 1, top, m)));
  const dropX = kidsPartner ? size / 2 + DASH / 2 : 0;
  const dropY = kidsPartner ? cy : h + 2;
  const kids = childrenRow(slots, dropX, dropY, splitY, top);

  // A partner with children together sits on the right, with the drop line from the middle of the dash.
  // A partner without children together goes on whichever side has room.
  const sides: (1 | -1)[][] = kidsPartner ? [[1, ...others.map(() => -1 as const)]]
    : others.length === 1 ? [[1], [-1]]
    : [others.map((_, i) => (i % 2 ? -1 : 1) as 1 | -1)];
  const list = kidsPartner ? [kidsPartner, ...others] : others;
  return sides.map((sideList) => {
    const items: Item[] = [me];
    const segs: Seg[] = [];
    let row: Ext = { l: -half, r: half };
    const used = { 1: 0, [-1]: 0 } as Record<number, number>;
    list.forEach((p, i) => {
      const side = sideList[i];
      const pa = partnerAt(p, side, size + used[side] * 2, cy, m);
      used[side] += DASH + SMALL + 6;
      items.push(pa.item);
      segs.push(pa.dash);
      row = { l: Math.min(row.l, pa.ext.l), r: Math.max(row.r, pa.ext.r) };
    });
    const base: Sub = { items, segs, contour: [row], bottom: h };
    if (!kids) return base;
    // The person row above the band, then the band (co-parents), then each generation below.
    return { items: [...items, ...kids.items], segs: [...segs, ...kids.segs], contour: [row, ...kids.contour], bottom: kids.bottom };
  });
}

type Group = { g: KidGroup; kids: Sub | null; ext: Ext; tabW: number; w: number; h: number };
type Prepared = { items: Item[]; segs: Seg[]; rootW: number; rootH: number; boxTop: number; boxH: number; groups: Group[]; natural: number };

/** Dunya, any partner beside her, and a box for each set of her children. Measured at natural size. */
function prepare(tree: TreeNode, m: Measure, tabMeasure: Measure): Prepared {
  const root = tree.person;
  const size = dia(0);
  const rootNameW = m(root.name, font(0), true);
  const rootH = size + NAME_GAP + nameH(font(0)) + 15;
  const items: Item[] = [{ key: `m${root.id}`, p: root, kind: "member", x: 0, y: size / 2, size, fontSize: font(0), name: "under", bold: true, sub: "Matriarch" }];
  const segs: Seg[] = [];
  const l = -Math.max(size, rootNameW) / 2;
  let r = -l;
  let used = 0;
  for (const pt of tree.partners) {
    const pa = partnerAt(pt.person, 1, size + used * 2, size / 2, m);
    used += DASH + SMALL + 6;
    // Beside Dunya the name reads on the outer side.
    pa.item.name = "right";
    items.push(pa.item);
    segs.push(pa.dash);
    r = Math.max(r, pa.item.x + SMALL / 2 + 5 + m(pt.person.name, SMALL_FONT));
  }
  const rootW = 2 * Math.max(-l, r);
  const boxTop = rootH + 30;
  const contentTop = TAB_H + 34;
  const groups: Group[] = tree.groups.map((g) => {
    const slots = g.children.map((c) => personSlot(c, 1, contentTop, m));
    const kids = childrenRow(slots, 0, g.partner ? TAB_H : 0, TAB_H + 14, contentTop);
    const ext = kids ? kids.contour.reduce((a, e) => ({ l: Math.min(a.l, e.l), r: Math.max(a.r, e.r) }), { l: Infinity, r: -Infinity }) : { l: -60, r: 60 };
    const tabW = g.partner ? Math.ceil(24 + 8 + tabMeasure(g.partner.name, 13, true) + 34) : 0;
    // The tab sits over the children's line (x = 0), so make room for it on both sides.
    const lo = Math.min(ext.l, -tabW / 2), hi = Math.max(ext.r, tabW / 2);
    return { g, kids, ext: { l: lo, r: hi }, tabW, w: Math.ceil(hi - lo) + BOX_PAD * 2, h: (kids?.bottom ?? contentTop) + BOX_PAD };
  });
  const boxesW = groups.reduce((a, b) => a + b.w, 0) + BOX_GAP * Math.max(0, groups.length - 1);
  return { items, segs, rootW, rootH, boxTop, boxH: Math.max(0, ...groups.map((b) => b.h)), groups, natural: Math.max(boxesW, rootW) };
}

/** Spread the boxes across `width`: each grows in proportion to its contents, which sit centered in it. */
function place(pr: Prepared, width: number): Layout {
  const boxesW = pr.groups.reduce((a, b) => a + b.w, 0) + BOX_GAP * Math.max(0, pr.groups.length - 1);
  const extra = Math.max(0, width - boxesW);
  const total = pr.groups.reduce((a, b) => a + b.w, 0) || 1;
  const items: Item[] = [];
  const segs: Seg[] = [];
  const boxes: Box[] = [];
  const drops: number[] = [];
  let x = 0;
  for (const b of pr.groups) {
    const w = b.w + (extra * b.w) / total;
    const dx = x + w / 2 - (b.ext.l + b.ext.r) / 2;
    boxes.push({ x, y: pr.boxTop, w, h: pr.boxH, tab: b.g.partner ? { x: dx - b.tabW / 2, w: b.tabW, p: b.g.partner } : null });
    if (b.kids) {
      const s = move(b.kids, dx, pr.boxTop);
      items.push(...s.items);
      segs.push(...s.segs);
    }
    drops.push(dx);
    x += w + BOX_GAP;
  }
  // Dunya centered on the page, with her line down to each box.
  const rootX = width / 2;
  for (const it of pr.items) items.push({ ...it, x: it.x + rootX });
  for (const sg of pr.segs) segs.push([sg[0] + rootX, sg[1], sg[2] + rootX, sg[3]]);
  if (drops.length) {
    const lineY = pr.rootH + 12;
    segs.push([rootX, pr.rootH, rootX, lineY]);
    const xs = [...drops, rootX];
    segs.push([Math.min(...xs), lineY, Math.max(...xs), lineY]);
    for (const t of drops) segs.push([t, lineY, t, pr.boxTop]);
  }
  return { width, height: pr.boxTop + pr.boxH + 2, items, segs, boxes };
}

/** The tree at its natural (narrowest) width, or spread to `width` when there's more room. */
export function layoutTree(tree: TreeNode, m: Measure, tabMeasure: Measure, width = 0): Layout {
  const pr = prepare(tree, m, tabMeasure);
  return place(pr, Math.max(width, pr.natural));
}

/** The narrowest width the tree needs. */
export function naturalWidth(tree: TreeNode, m: Measure, tabMeasure: Measure) {
  return prepare(tree, m, tabMeasure).natural;
}
