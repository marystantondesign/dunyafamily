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
/** The dash between a family member and their partner: 26px, so the partner's name never crowds theirs. */
const DASH = 26;
const NOTCH = 10;
const GAP = 22;
/** The gap in use. Boxes with room to spare widen it so the tree spreads to fill them; sizes never change. */
let gap = GAP;
const BAND = 72;
const NAME_GAP = 3;
const LH = 1.15;
/** A partner's name goes under their circle unless it's wider than this; then it goes on the outer side. */
const UNDER_MAX = 46;
/** Space between the outermost person (circle or name) and the box's left and right edges. */
const BOX_PAD = 20;
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
export type Box = { x: number; y: number; w: number; h: number; tab: { x: number; w: number; p: FPerson } | null; label?: string };
export type Layout = { width: number; height: number; items: Item[]; segs: Seg[]; boxes: Box[]; pills: Pill[] };

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
        v.contour.forEach((e, i) => { if (merged[i]) x = Math.max(x, merged[i].r - e.l + gap); });
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
function layoutMember(node: TreeNode, d: number, m: Measure, rootDrop?: number): Sub[] {
  const size = dia(d), fs = font(d), cy = size / 2;
  const nameW = m(node.person.name, fs);
  const me: Item = { key: `m${node.person.id}`, p: node.person, kind: "member", x: 0, y: cy, size, fontSize: fs, name: "under" };
  const half = Math.max(size, nameW) / 2;

  const single = node.groups.length === 1 && !node.groups[0].coparent ? node.groups[0] : null;
  const kidsPartner = single?.partner ?? null;
  const others = node.partners.map((pt) => pt.person);

  // Children: co-parent groups on their own drop lines; the rest hang straight off the parent's line.
  // `rootDrop`: the root of a sibling's own tree, whose children's line drops straight from below the line under
  // their name (as Dunya's does), even with a partner beside them.
  const h = blockH(d), splitY = rootDrop ? rootDrop + 16 : h + 14, top = h + BAND + splitY - (h + 14);
  const slots: Slot[] = node.groups.flatMap((g) => (g.coparent && g.partner)
    ? [{ variants: [coGroup(g, d, splitY, top, m)], anchor: "co" as const }]
    : g.children.map((c) => personSlot(c, d + 1, top, m)));
  // A couple's children drop from the middle of the dash between them, on whichever side the partner sits.
  // Children with a co-parent, or with one recorded parent, drop from the family member.
  const fromDash = kidsPartner && !rootDrop;
  const dropY = rootDrop ?? (kidsPartner ? cy : h + 2);
  const kidsFor = (side: 1 | -1) => childrenRow(slots, fromDash ? side * (size / 2 + DASH / 2) : 0, dropY, splitY, top);

  // The partner (with or without children together) goes on whichever side has room.
  const sides: (1 | -1)[][] = (kidsPartner ? 1 : 0) + others.length === 1 ? [[1], [-1]]
    : kidsPartner ? [[1, ...others.map(() => -1 as const)]]
    : [others.map((_, i) => (i % 2 ? -1 : 1) as 1 | -1)];
  const list = kidsPartner ? [kidsPartner, ...others] : others;
  const rows = new Map<number, Sub | null>();
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
    const side = sideList[0] ?? 1;
    if (!rows.has(side)) rows.set(side, kidsFor(side));
    const kids = rows.get(side)!;
    const base: Sub = { items, segs, contour: [row], bottom: h };
    if (!kids) return base;
    // The person row above the band, then the band (co-parents), then each generation below.
    return { items: [...items, ...kids.items], segs: [...segs, ...kids.segs], contour: [row, ...kids.contour], bottom: kids.bottom };
  });
}

/** A brother or sister of the root, for the earlier generations section. */
export type Sib = { person: FPerson; partners: FPerson[]; count: number; href: string | null };
/** Dunya's parents (each with their own parents), and her brothers and sisters older and younger than her. */
export type Earlier = { parents: { person: FPerson; parents: FPerson[] }[]; older: Sib[]; younger: Sib[]; label: string };
export type Pill = { x: number; y: number; w: number; text: string; href: string };
type EarlierOut = { items: Item[]; segs: Seg[]; pills: Pill[]; frame: { l: number; r: number; top: number; bottom: number } };

const PILL_H = 26;
const SIB_GAP = 40;

/**
 * Above Dunya, in Dunya's own frame (her circle's top at y = 0, centered on x = 0): her brothers and sisters on
 * either side of her (older to the left, younger to the right) hanging from one bar, her parents as a couple
 * centered over her with the drop from the middle of their dash, and each parent's parents as a couple above them.
 */
function layoutEarlier(e: Earlier, rootExt: Ext, rootBottom: number, m: Measure, pillMeasure: Measure): EarlierOut | null {
  if (!e.parents.length && !e.older.length && !e.younger.length) return null;
  const items: Item[] = [], segs: Seg[] = [], pills: Pill[] = [];
  const S1 = dia(1), F1 = font(1), S2 = dia(2), F2 = font(2);
  const cy = dia(0) / 2;
  const barY = -22;
  let l = rootExt.l, r = rootExt.r, bottom = rootBottom;
  const anchors = [0];
  segs.push([0, barY, 0, 0]);
  let xr = rootExt.r + SIB_GAP, xl = rootExt.l - SIB_GAP;
  const sib = (s: Sib, side: 1 | -1) => {
    const nameW = m(s.person.name, F1);
    const text = s.href ? `${s.person.name.split(" ")[0]}'s family · ${s.count}` : "";
    const pillW = text ? Math.ceil(pillMeasure(text, 13) + 30) : 0;
    let el = -Math.max(S1, nameW, pillW) / 2, er = -el;
    const part = s.partners.map((p, i) => partnerAt(p, 1, S1 + i * (DASH + SMALL + 6) * 2, cy, m));
    for (const pa of part) er = Math.max(er, pa.ext.r);
    const x0 = side > 0 ? xr - el : xl - er;
    if (side > 0) xr = x0 + er + SIB_GAP; else xl = x0 + el - SIB_GAP;
    l = Math.min(l, x0 + el); r = Math.max(r, x0 + er);
    items.push({ key: `m${s.person.id}`, p: s.person, kind: "member", x: x0, y: cy, size: S1, fontSize: F1, name: "under" });
    for (const pa of part) { items.push({ ...pa.item, x: pa.item.x + x0 }); segs.push([pa.dash[0] + x0, pa.dash[1], pa.dash[2] + x0, pa.dash[3]]); }
    segs.push([x0, barY, x0, cy - S1 / 2]);
    anchors.push(x0);
    const pillY = cy + S1 / 2 + NAME_GAP + nameH(F1) + 8;
    if (text) { pills.push({ x: x0 - pillW / 2, y: pillY, w: pillW, text, href: s.href! }); bottom = Math.max(bottom, pillY + PILL_H); }
    else bottom = Math.max(bottom, cy + S1 / 2 + NAME_GAP + nameH(F1));
  };
  // Nearest to Dunya first: the youngest of the older ones on the left, the next younger on the right.
  [...e.older].reverse().forEach((s) => sib(s, -1));
  e.younger.forEach((s) => sib(s, 1));
  if (anchors.length > 1) segs.push([Math.min(...anchors), barY, Math.max(...anchors), barY]);

  let top = barY;
  if (e.parents.length) {
    const PY = barY - 96;
    // Half the room each grandparent couple needs: wide enough that their names, side by side, keep a gap
    // for the line that drops from the middle of their dash.
    const gHalf = (pp: Earlier["parents"][number]) => Math.max(S2 / 2 + 22, ...pp.parents.map((g) => m(g.name, F2) / 2 + 12));
    const gReach = (pp: Earlier["parents"][number]) =>
      pp.parents.length === 2 ? gHalf(pp) + Math.max(...pp.parents.map((g) => Math.max(S2, m(g.name, F2)) / 2)) : pp.parents.length ? Math.max(S2, m(pp.parents[0].name, F2)) / 2 : 0;
    const spread = e.parents.length === 2
      ? Math.max(110, S2 + 52, ...e.parents.map((pp) => gReach(pp) + 16), ...e.parents.map((pp) => Math.max(S1, m(pp.person.name, F1)) / 2 + 24))
      : 0;
    const xs = e.parents.length === 2 ? [-spread, spread] : [0];
    e.parents.forEach((pp, i) => {
      const px = xs[i];
      items.push({ key: `m${pp.person.id}`, p: pp.person, kind: "member", x: px, y: PY, size: S1, fontSize: F1, name: "under" });
      l = Math.min(l, px - Math.max(S1, m(pp.person.name, F1)) / 2); r = Math.max(r, px + Math.max(S1, m(pp.person.name, F1)) / 2);
      // Their parents, a couple above them with the line from the middle of their dash.
      if (pp.parents.length) {
        const GY = PY - 118;
        const gx = pp.parents.length === 2 ? [px - gHalf(pp), px + gHalf(pp)] : [px];
        pp.parents.forEach((g, j) => {
          items.push({ key: `m${g.id}`, p: g, kind: "member", x: gx[j], y: GY, size: S2, fontSize: F2, name: "under" });
          const w = Math.max(S2, m(g.name, F2)) / 2;
          l = Math.min(l, gx[j] - w); r = Math.max(r, gx[j] + w);
        });
        if (pp.parents.length === 2) {
          segs.push([gx[0] + S2 / 2, GY, gx[1] - S2 / 2, GY]);
          segs.push([px, GY, px, PY - S1 / 2]);
        } else segs.push([px, GY + S2 / 2 + NAME_GAP + nameH(F2) + 2, px, PY - S1 / 2]);
        top = Math.min(top, GY - S2 / 2);
      }
    });
    if (e.parents.length === 2) {
      segs.push([xs[0] + S1 / 2, PY, xs[1] - S1 / 2, PY]);
      segs.push([0, PY, 0, barY]);
    } else segs.push([0, PY + S1 / 2 + NAME_GAP + nameH(F1) + 2, 0, barY]);
    top = Math.min(top, PY - S1 / 2);
  }
  return { items, segs, pills, frame: { l: l - 32, r: r + 32, top: top - 58, bottom: bottom + 22 } };
}

type Built = { kids: Sub | null; ext: Ext };
type Group = { g: KidGroup; kids: Sub | null; ext: Ext; tabW: number; w: number; h: number; build: (gap: number) => Built };
type Prepared = { items: Item[]; segs: Seg[]; rootW: number; rootH: number; boxTop: number; boxH: number; groups: Group[]; natural: number; earlier: EarlierOut | null; earlierLabel?: string; rootTop: number };

/** Dunya, any partner beside her, and a box for each set of her children. Measured at natural size. */
function prepare(tree: TreeNode, m: Measure, tabMeasure: Measure, earlier?: Earlier | null): Prepared {
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
  // Earlier generations, when open, sit above Dunya in her own frame; everything else moves down to make room.
  const before = earlier ? layoutEarlier({ ...earlier }, { l, r }, rootH, m, tabMeasure) : null;
  const rootTop = before ? -before.frame.top : 0;
  const rootW = 2 * Math.max(-l, r, before ? Math.max(-before.frame.l, before.frame.r) : 0);
  const boxTop = rootTop + Math.max(rootH, before ? before.frame.bottom + 14 : 0) + 30;
  const contentTop = TAB_H + 34;
  const groups: Group[] = tree.groups.map((g) => {
    const tabW = g.partner ? Math.ceil(24 + 8 + tabMeasure(g.partner.name, 13, true) + 34) : 0;
    const build = (withGap: number) => {
      gap = withGap;
      const slots = g.children.map((c) => personSlot(c, 1, contentTop, m));
      const kids = childrenRow(slots, 0, g.partner ? TAB_H : 0, TAB_H + 14, contentTop);
      gap = GAP;
      const ext = kids ? kids.contour.reduce((a, e) => ({ l: Math.min(a.l, e.l), r: Math.max(a.r, e.r) }), { l: Infinity, r: -Infinity }) : { l: -60, r: 60 };
      // The tab sits over the children's line (x = 0), so make room for it on both sides.
      return { kids, ext: { l: Math.min(ext.l, -tabW / 2), r: Math.max(ext.r, tabW / 2) } };
    };
    const { kids, ext } = build(GAP);
    return { g, kids, ext, tabW, build, w: Math.ceil(ext.r - ext.l) + BOX_PAD * 2, h: (kids?.bottom ?? contentTop) + BOX_PAD + 18 };
  });
  const boxesW = groups.reduce((a, b) => a + b.w, 0) + BOX_GAP * Math.max(0, groups.length - 1);
  return { items, segs, rootW, rootH, boxTop, boxH: Math.max(0, ...groups.map((b) => b.h)), groups, natural: Math.max(boxesW, rootW), earlier: before, earlierLabel: earlier?.label, rootTop };
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
    // Spread the tree to fill the box: widen the gaps between branches until it reaches the padding.
    let built: Built = { kids: b.kids, ext: b.ext };
    if (w - b.w > 4 && b.kids) {
      let lo = GAP, hi = GAP + 400;
      for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2;
        const t = b.build(mid);
        if (t.ext.r - t.ext.l <= w - BOX_PAD * 2) { lo = mid; built = t; } else hi = mid;
      }
    }
    const dx = x + w / 2 - (built.ext.l + built.ext.r) / 2;
    boxes.push({ x, y: pr.boxTop, w, h: pr.boxH, tab: b.g.partner ? { x: dx - b.tabW / 2, w: b.tabW, p: b.g.partner } : null });
    if (built.kids) {
      const s = move(built.kids, dx, pr.boxTop);
      items.push(...s.items);
      segs.push(...s.segs);
    }
    drops.push(dx);
    x += w + BOX_GAP;
  }
  // Dunya centered on the page, with her line down to each box. Earlier generations, if open, above her.
  const rootX = width / 2, dy = pr.rootTop;
  const pills: Pill[] = [];
  const e = pr.earlier;
  if (e) {
    boxes.push({ x: rootX + e.frame.l, y: dy + e.frame.top, w: e.frame.r - e.frame.l, h: e.frame.bottom - e.frame.top, tab: null, label: pr.earlierLabel });
    for (const it of e.items) items.push({ ...it, x: it.x + rootX, y: it.y + dy });
    for (const sg of e.segs) segs.push([sg[0] + rootX, sg[1] + dy, sg[2] + rootX, sg[3] + dy]);
    for (const p of e.pills) pills.push({ ...p, x: p.x + rootX, y: p.y + dy });
  }
  for (const it of pr.items) items.push({ ...it, x: it.x + rootX, y: it.y + dy });
  for (const sg of pr.segs) segs.push([sg[0] + rootX, sg[1] + dy, sg[2] + rootX, sg[3] + dy]);
  if (drops.length) {
    const lineY = pr.boxTop - 18;
    segs.push([rootX, dy + pr.rootH, rootX, lineY]);
    const xs = [...drops, rootX];
    segs.push([Math.min(...xs), lineY, Math.max(...xs), lineY]);
    for (const t of drops) segs.push([t, lineY, t, pr.boxTop]);
  }
  return { width, height: pr.boxTop + pr.boxH + 2, items, segs, boxes, pills };
}

/** The tree at its natural (narrowest) width, or spread to `width` when there's more room. */
export function layoutTree(tree: TreeNode, m: Measure, tabMeasure: Measure, width = 0, earlier?: Earlier | null): Layout {
  const pr = prepare(tree, m, tabMeasure, earlier);
  return place(pr, Math.max(width, pr.natural));
}

/** The narrowest width the tree needs. */
export function naturalWidth(tree: TreeNode, m: Measure, tabMeasure: Measure, earlier?: Earlier | null) {
  return prepare(tree, m, tabMeasure, earlier).natural;
}

/**
 * One family member's own tree (a sibling's family page): them at the top with any partner beside them, their
 * children and descendants below, built exactly like the main tree. `sub` is the line under their name.
 */
function prepareBranch(node: TreeNode, sub: string, m: Measure) {
  const h = blockH(0);
  // The root's name is bold with a line under it, so the line down to their children starts below that line.
  const variants = layoutMember(node, 0, m, h + 18);
  const span = (v: Sub) => {
    const l = Math.min(...v.contour.map((e) => e.l)), r = Math.max(...v.contour.map((e) => e.r));
    return { l: Math.min(l, -m(sub, 13) / 2), r: Math.max(r, m(sub, 13) / 2) };
  };
  const v = variants.reduce((a, b) => (span(b).r - span(b).l < span(a).r - span(a).l ? b : a));
  const ext = span(v);
  const segs = v.segs;
  const items = v.items.map((it) => (it.key === `m${node.person.id}` ? { ...it, bold: true, sub } : it));
  return { items, segs, ext, bottom: v.bottom, natural: Math.ceil(ext.r - ext.l) + BOX_PAD * 2 };
}

export function layoutBranch(node: TreeNode, sub: string, m: Measure, width = 0): Layout {
  const b = prepareBranch(node, sub, m);
  const w = Math.max(width, b.natural);
  const dx = w / 2 - (b.ext.l + b.ext.r) / 2, dy = 12;
  return {
    width: w, height: b.bottom + dy + 30, boxes: [], pills: [],
    items: b.items.map((it) => ({ ...it, x: it.x + dx, y: it.y + dy })),
    segs: b.segs.map(([a, c, e, f]) => [a + dx, c + dy, e + dx, f + dy] as Seg),
  };
}

export const branchWidth = (node: TreeNode, sub: string, m: Measure) => prepareBranch(node, sub, m).natural;
