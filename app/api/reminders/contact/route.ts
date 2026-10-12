import { getSession, unauthorized } from "@/lib/auth";
import { siteUrl } from "@/lib/sms";

/** A contact card for the texting number, with the Dunya Family picture, so texts show who they're from. */
export async function GET(req: Request) {
  if (!(await getSession())) return unauthorized();
  const from = process.env.TWILIO_FROM ?? "";
  if (!from) return new Response("Texting isn't set up yet.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const icon = await fetch(new URL("/contact-icon.png", req.url)).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
  // vCard lines longer than 75 characters fold onto lines that start with a space.
  const fold = (line: string) => line.match(/.{1,74}/g)!.join("\r\n ");
  const card = [
    "BEGIN:VCARD", "VERSION:3.0", "FN:Dunya Family", "N:;Dunya Family;;;", "ORG:Dunya Family",
    `TEL;TYPE=CELL:${from}`, `URL:${siteUrl()}`,
    ...(icon ? [fold(`PHOTO;ENCODING=b;TYPE=PNG:${Buffer.from(icon).toString("base64")}`)] : []),
    "END:VCARD",
  ].join("\r\n");
  return new Response(card, { headers: { "Content-Type": "text/vcard; charset=utf-8", "Content-Disposition": 'attachment; filename="Dunya Family.vcf"' } });
}
