/**
 * In memory (Option A): a sky-blue ring and a gold halo above the photo. Hovering shows "In memory",
 * and screen readers hear it too, so the meaning isn't carried by color alone.
 */
export function Halo({ on, children }: { on: boolean; children: React.ReactNode }) {
  if (!on) return <>{children}</>;
  return (
    <span className="halo" title="In memory">
      {children}
      <span className="sr-only">, in memory</span>
    </span>
  );
}
