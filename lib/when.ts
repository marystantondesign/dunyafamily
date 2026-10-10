/** "March 1958", "1958", or "1950s". Kept apart from lib/photos so browser code can use it. */
export function whenLabel(p: { year: number | null; decade: number | null; month: number | null }) {
  if (p.year && p.month)
    return `${new Date(2000, p.month - 1, 1).toLocaleString("en-US", { month: "long" })} ${p.year}`;
  if (p.year) return String(p.year);
  if (p.decade) return `${p.decade}s`;
  return null;
}
