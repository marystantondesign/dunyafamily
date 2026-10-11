import { getSession, unauthorized } from "@/lib/auth";
import { addressBook } from "@/lib/people";

const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** The address book as a spreadsheet for invitations and holiday cards. Same visibility as the page. */
export async function GET() {
  const s = await getSession();
  if (!s) return unauthorized();
  const rows = (await addressBook(s)).filter((r) => r.address);
  const width = Math.max(2, ...rows.map((r) => r.address!.split("\n").length));
  const header = ["Name", ...Array.from({ length: width }, (_, i) => `Address line ${i + 1}`)];
  const lines = rows.map((r) => {
    const parts = r.address!.split("\n");
    return [r.name, ...Array.from({ length: width }, (_, i) => parts[i] ?? "")].map(cell).join(",");
  });
  return new Response([header.join(","), ...lines].join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="dunya-family-addresses.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
