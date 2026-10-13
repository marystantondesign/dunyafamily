/** The maroon question-mark badge for "Tagging needed". */
export function QBadge({ size = 22, className = "" }: { size?: number; className?: string }) {
  return <span className={`q-badge ${className}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.6) }} aria-hidden="true">?</span>;
}
