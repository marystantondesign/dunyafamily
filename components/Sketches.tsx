/** Pencil illustrations from the round 11 designs. Ink strokes, muted brown hatching, card cream fills. */
const INK = "#2B1D1A";
const HATCH = "#9C8670";
const CREAM = "#FFFCF6";

export function RecipeBoxSketch({ height = 120, label = true }: { height?: number; label?: boolean }) {
  return (
    <svg role="img" aria-label="Pencil sketch of an open recipe box" viewBox="40 8 150 136" height={height} className="sketch"
      fill="none" stroke={INK} strokeLinecap="round" strokeLinejoin="round">
      <path d="M80 56 L78 14 L176 21 L180 64" strokeWidth="1.3" />
      <path d="M82 52 L81 19 L172 25 L175 60" strokeWidth="0.6" stroke={HATCH} />
      <path d="M60 64 L62 54 L152 61 L150 71" strokeWidth="0.9" />
      <path d="M64 66 L67 57 L157 64 L154 73" strokeWidth="0.9" />
      <path d="M68 68 L72 60 L162 67 L158 75" strokeWidth="0.9" />
      <path d="M50 70 L80 56 L180 64" strokeWidth="1.3" />
      <path d="M50 70 L150 78 L150 138 L50 130 Z" strokeWidth="1.4" fill={CREAM} />
      <path d="M150 78 L180 64 L180 122 L150 138" strokeWidth="1.4" fill={CREAM} />
      <g strokeWidth="0.5" stroke={HATCH}>
        <path d="M154 82 L177 70" /><path d="M154 90 L177 78" /><path d="M154 98 L177 86" /><path d="M154 106 L177 94" />
        <path d="M154 114 L177 102" /><path d="M154 122 L177 110" /><path d="M154 130 L176 118" />
        <path d="M54 127 L146 134" /><path d="M53 74 L148 81" />
      </g>
      {label && (
        <text x="100" y="112" textAnchor="middle" transform="rotate(4 100 108)" fill={INK} stroke="none" style={{ fontFamily: "var(--hand)", fontSize: 26 }}>Recipes</text>
      )}
    </svg>
  );
}

export function BookSketch({ height = 120 }: { height?: number }) {
  return (
    <svg role="img" aria-label="Pencil sketch of a hardcover book" viewBox="2 2 206 196" height={height} className="sketch"
      fill="none" stroke={INK} strokeLinecap="round" strokeLinejoin="round">
      <path d="M99 166 L106 196 L111 189 L117 194 L110 164" strokeWidth="1.1" fill={CREAM} />
      <path d="M112 144 L105 173 L194 135 L204 106 Z" strokeWidth="1.4" fill={CREAM} />
      <g strokeWidth="0.5" stroke={HATCH}>
        <path d="M110 152 L201 115" /><path d="M109 157 L199 120" /><path d="M108 162 L198 125" /><path d="M107 167 L196 130" />
      </g>
      <path d="M20 28 L110 7 L204 106 L112 144 Z" strokeWidth="1.4" fill={CREAM} />
      <path d="M37 36 L110 19 L187 100 L112 131 Z" strokeWidth="1" />
      <path d="M41 37 L110 22 L183 99 L112 128 Z" strokeWidth="0.5" stroke={HATCH} />
      <path d="M20 28 C12 25, 5 31, 7 39 L96 168 C99 173, 103 175, 105 173 L112 144" strokeWidth="1.4" fill={CREAM} />
      <g strokeWidth="1.3">
        <path d="M38 51 Q29 52 27 60" /><path d="M57 74 Q48 75 46 83" /><path d="M75 98 Q66 99 64 107" /><path d="M93 121 Q84 122 82 130" />
      </g>
      <g strokeWidth="0.5" stroke={HATCH}>
        <path d="M14 34 L24 44" /><path d="M11 39 L22 48" /><path d="M15 46 L26 55" /><path d="M30 60 L41 68" /><path d="M33 66 L44 74" />
        <path d="M36 71 L46 78" /><path d="M48 84 L59 92" /><path d="M51 90 L62 98" /><path d="M54 95 L65 102" /><path d="M66 108 L77 116" />
        <path d="M69 114 L80 121" /><path d="M73 119 L84 126" /><path d="M84 131 L95 139" /><path d="M87 137 L98 145" /><path d="M90 143 L101 150" />
        <path d="M93 150 L104 156" />
      </g>
    </svg>
  );
}

/** A recipe card: the photo of the original when there is one, otherwise a blank ruled index card. */
export function RecipeCardImage({ url, title, className = "" }: { url: string | null; title: string; className?: string }) {
  return url ? (
    <div className={`recipe-card-img ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={`The original card for ${title}`} />
    </div>
  ) : (
    <div className={`recipe-card-img lined ${className}`} role="img" aria-label="Blank recipe card" />
  );
}
