import { getSession, unauthorized } from "@/lib/auth";
import { addressLines, formatPhone } from "@/lib/contact";
import { addressBook } from "@/lib/people";

const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** The address book as a spreadsheet for invitations and holiday cards. Same visibility as the page. */
export async function GET() {
  const s = await getSession();
  if (!s) return unauthorized();
  const rows = (await addressBook(s)).filter((r) => r.contact && (r.contact.address || r.contact.raw || r.contact.email || r.contact.phone));
  const header = ["Name", "Address line 1", "Address line 2", "Email", "Phone"];
  const lines = rows.map((r) => {
    const c = r.contact!;
    const [one, two] = c.address ? addressLines(c.address) : [(c.raw ?? "").replace(/\n/g, ", "), ""];
    return [r.name, one, two, c.email ?? "", c.phone ? formatPhone(c.phone) : ""].map(cell).join(",");
  });
  return new Response([header.join(","), ...lines].join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="dunya-family-addresses.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
