"use client";
import Link from "next/link";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FPerson, TreeNode } from "@/lib/family";
import { estimate, layoutTree, naturalWidth, type Item, type Measure } from "@/lib/treeLayout";
import { Halo } from "./Halo";

/** Smallest the tree may shrink to fit before the page shows the list version instead of scrolling sideways. */
const MIN_SCALE = 0.9;

function Face({ p, size }: { p: FPerson; size: number }) {
  return (
    <span className="tl-face" style={{ "--s": `${size}px` } as React.CSSProperties}>
      <Halo on={p.inMemory} name={p.name}>
        <span className="tdot-face" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.avatarUrl ? <img src={p.avatarUrl} alt="" /> : p.name.charAt(0)}
        </span>
      </Halo>
    </span>
  );
}

/** Text widths from the real font once it has loaded; a close estimate until then. */
function useMeasure(): Measure {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    let live = true;
    document.fonts?.ready.then(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, []);
  return useMemo<Measure>(() => {
    if (!ready || typeof document === "undefined") return estimate;
    const ctx = document.createElement("canvas").getContext("2d");
    const serif = getComputedStyle(document.documentElement).getPropertyValue("--font-serif").trim() || "Georgia";
    return (t, size, bold) => {
      if (!ctx) return estimate(t, size, bold);
      ctx.font = `${bold ? 700 : 400} ${size}px ${serif}, Georgia, serif`;
      return Math.ceil(ctx.measureText(t).width) + 1;
    };
  }, [ready]);
}

function Person({ it }: { it: Item }) {
  const nameStyle = { fontSize: it.fontSize, fontWeight: it.bold ? 700 : 400 };
  if (it.name === "under") {
    const w = Math.max(it.size, 160);
    return (
      <Link href={`/people/${it.p.id}`} className={`tl-p ${it.kind}`} style={{ left: it.x - w / 2, top: it.y - it.size / 2, width: w }}>
        <Face p={it.p} size={it.size} />
        <span className="tl-name" style={nameStyle}>{it.p.name}</span>
        {it.sub && <span className="tl-sub">{it.sub}</span>}
      </Link>
    );
  }
  // Name beside the circle, on the outer side.
  const left = it.name === "right";
  return (
    <Link href={`/people/${it.p.id}`} className={`tl-p ${it.kind} side ${left ? "to-right" : "to-left"}`}
      style={left ? { left: it.x - it.size / 2, top: it.y - it.size / 2, height: it.size } : { right: `calc(100% - ${it.x + it.size / 2}px)`, top: it.y - it.size / 2, height: it.size }}>
      <Face p={it.p} size={it.size} />
      <span className="tl-name" style={nameStyle}>{it.p.name}</span>
    </Link>
  );
}

/**
 * The desktop family tree, laid out to fit the page: full content width, the family boxes side by side and sized
 * to what they hold. When it can't fit (even a little smaller), `onNarrow` tells the page to show the list instead.
 */
export function TreeCanvas({ tree, onNarrow }: { tree: TreeNode; onNarrow: (narrow: boolean) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const measure = useMeasure();
  const [room, setRoom] = useState(0);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setRoom(el.clientWidth));
    ro.observe(el);
    setRoom(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const natural = useMemo(() => naturalWidth(tree, measure, measure), [tree, measure]);
  const fits = !room || natural * MIN_SCALE <= room;
  const scale = room && natural > room ? room / natural : 1;
  const layout = useMemo(() => layoutTree(tree, measure, measure, room && natural <= room ? room : natural), [tree, measure, room, natural]);
  const narrowRef = useRef<boolean | null>(null);
  useLayoutEffect(() => {
    if (!room) return;
    if (narrowRef.current !== !fits) { narrowRef.current = !fits; onNarrow(!fits); }
  }, [fits, room, onNarrow]);

  return (
    <div ref={wrap} className="tl-wrap" style={{ height: fits ? layout.height * scale : 0 }}>
      {fits && (
        <div className="tl" style={{ width: layout.width, height: layout.height, transform: scale < 1 ? `scale(${scale})` : undefined }}>
          <svg className="tl-lines" width={layout.width} height={layout.height} aria-hidden="true">
            {layout.boxes.map((b, i) => <rect key={i} className="tl-box" x={b.x + 0.5} y={b.y + 0.5} width={b.w - 1} height={b.h - 1} rx={10} />)}
            {layout.segs.map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />)}
          </svg>
          {layout.boxes.map((b) => b.tab && (
            <Link key={`t${b.tab.p.id}`} href={`/people/${b.tab.p.id}`} className="tl-tab" style={{ left: b.tab.x, top: b.y, width: b.tab.w }}>
              <Face p={b.tab.p} size={24} />
              <strong>{b.tab.p.name}</strong>
            </Link>
          ))}
          {layout.items.map((it) => <Person key={it.key} it={it} />)}
        </div>
      )}
    </div>
  );
}
