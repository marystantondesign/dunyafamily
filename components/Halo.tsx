/**
 * In memory: a slate ring and a gold halo raised above the photo, and the photo in black and white. Everything
 * scales from the photo's size (CSS container units on .halo-mark). Hovering shows "In memory", and screen readers
 * hear "in memory" after the name, so the meaning isn't carried by color alone. `square` is for square photos (the
 * profile picture).
 */
export function Halo({ on, children, square = false }: { on: boolean; name?: string; children: React.ReactNode; square?: boolean }) {
  if (!on) return <>{children}</>;
  return (
    <span className={`halo${square ? " square" : ""}`} title="In memory">
      {children}
      <span className="halo-mark" aria-hidden="true"><span className="halo-ring" /><span className="halo-glow" /></span>
      <span className="sr-only">, in memory</span>
    </span>
  );
}
