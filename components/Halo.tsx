/**
 * In memory (Option A): a sky-blue ring and a gold halo above the photo. Hovering shows "In memory",
 * with their name, and screen readers hear it too, so the meaning isn't carried by color alone.
 */
export function Halo({ on, name, children }: { on: boolean; name?: string; children: React.ReactNode }) {
  if (!on) return <>{children}</>;
  return (
    <span className="halo" title={name ? `${name}, in memory` : "In memory"}>
      {children}
      <span className="sr-only">, in memory</span>
    </span>
  );
}
