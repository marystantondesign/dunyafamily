/**
 * Contact details: a structured mailing address (street, apt or suite, city, state, ZIP), an email, and a phone.
 * Older addresses were one block of text; they're read into these fields (with capitalization fixed) until someone
 * saves the new fields. Anything that can't be read is flagged for the admin to fix. Safe for the browser too.
 */
export type Address = { street: string; apt: string; city: string; state: string; zip: string };
export const EMPTY_ADDRESS: Address = { street: "", apt: "", city: "", state: "", zip: "" };

const STATES = new Set("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR GU VI AS MP".split(" "));
const STATE_NAMES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY",
  louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA",
  washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};
const STREET_WORDS = new Set(("rd road st street ave avenue dr drive ln lane blvd boulevard ct court cir circle pl place way pkwy parkway " +
  "hwy highway ter terrace trl trail loop cv cove row sq square pike run xing").split(" "));
// Street words that stay short and capitalized; directions stay upper case.
const UPPER = new Set(["NE", "NW", "SE", "SW", "N", "S", "E", "W", "PO", "US", "II", "III", "IV"]);

/** "3230 cumberland rd" -> "3230 Cumberland Rd"; "PO box" -> "PO Box"; "1st" stays "1st". */
export function titleCase(s: string) {
  return s.trim().replace(/\s+/g, " ").split(" ").map((w) => {
    const bare = w.replace(/[.,]/g, "").toUpperCase();
    if (UPPER.has(bare)) return w.toUpperCase();
    if (/^\d/.test(w)) return w.toLowerCase();
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(" ");
}

export function normalizeState(s: string) {
  const t = s.trim().replace(/\./g, "");
  if (STATES.has(t.toUpperCase())) return t.toUpperCase();
  return STATE_NAMES[t.toLowerCase()] ?? "";
}

/** Splits "Street, Apt 5" style lines into street and apt or suite. */
function splitApt(line: string): { street: string; apt: string } {
  const m = line.match(/^(.*?)[,\s]+((?:apt|apartment|unit|suite|ste|#|bldg|building|lot|rm|room)\.?\s*#?\s*[\w-]+)\s*$/i);
  if (!m) return { street: line, apt: "" };
  let apt = m[2].replace(/\s+/g, " ");
  apt = apt.replace(/^(apartment|apt)\.?\s*/i, "Apt ").replace(/^(suite|ste)\.?\s*/i, "Suite ").replace(/^unit\s*/i, "Unit ")
    .replace(/^(building|bldg)\.?\s*/i, "Bldg ").replace(/^lot\s*/i, "Lot ").replace(/^(room|rm)\.?\s*/i, "Room ").replace(/^#\s*/, "#");
  return { street: m[1], apt: apt.replace(/#\s+/, "#") };
}

/**
 * Reads an old one-block address. Null when it can't be read (no ZIP, or no state it recognizes), so the admin can
 * fix it by hand.
 */
export function parseAddress(text: string | null | undefined): Address | null {
  if (!text?.trim()) return null;
  const flat = text.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean).join(", ").replace(/\s+/g, " ").replace(/,\s*,/g, ",");
  // ... City, ST 12345  or  ... City ST 12345-6789
  const tail = flat.match(/^(.*?)[,\s]+([A-Za-z][A-Za-z .]*?)[,\s]+(\d{5}(?:-\d{4})?)\s*(?:,?\s*(?:usa|us|united states))?\.?$/i);
  if (!tail) return null;
  const head = tail[1];
  // The state is the last word or two before the ZIP.
  const words = tail[2].trim().split(/\s+/);
  let state = "", cityExtra = "";
  for (const n of [2, 1]) {
    if (words.length < n) continue;
    const cand = normalizeState(words.slice(-n).join(" "));
    if (cand) { state = cand; cityExtra = words.slice(0, -n).join(" "); break; }
  }
  if (!state) return null;
  // City: what's between the street part and the state (after the last comma), or the trailing words of the street line.
  let street = head, city = cityExtra;
  if (!city) {
    const lastComma = head.lastIndexOf(",");
    if (lastComma >= 0) {
      street = head.slice(0, lastComma);
      city = head.slice(lastComma + 1);
    } else {
      // No comma: "3230 cumberland rd apt 5 ocean springs". The city starts after the apartment, or after the
      // last street word (Rd, St, Ave...).
      const apt = head.match(/^(.*?\b(?:apt|apartment|unit|suite|ste|lot|#)\.?\s*#?\s*\d[\w-]*)\s+(\D.*)$/i);
      if (apt) { street = apt[1]; city = apt[2]; }
      else {
        const words = head.split(" ");
        let at = -1;
        words.forEach((w, i) => { if (i > 0 && i < words.length - 1 && STREET_WORDS.has(w.toLowerCase().replace(/\./g, ""))) at = i; });
        if (at < 0) return null;
        street = words.slice(0, at + 1).join(" ");
        city = words.slice(at + 1).join(" ");
      }
    }
  }
  const parts = splitApt(street.replace(/,\s*$/, "").trim());
  // "123 Main St, Apt 5" leaves a trailing comma piece in street sometimes; also catch "Apt 5" as its own comma part.
  let s2 = parts.street, apt = parts.apt;
  const commaParts = s2.split(",").map((x) => x.trim()).filter(Boolean);
  if (!apt && commaParts.length > 1) {
    const last = splitApt(`x ${commaParts[commaParts.length - 1]}`);
    if (last.apt) { apt = last.apt; s2 = commaParts.slice(0, -1).join(", "); }
  }
  if (!s2.trim() || !city.trim()) return null;
  return { street: titleCase(s2.replace(/,/g, "")), apt: apt ? titleCase(apt) : "", city: titleCase(city), state, zip: tail[3] };
}

export const hasAddress = (a: Address | null | undefined) => !!a && !!(a.street || a.city || a.zip);

/** Two lines: "3230 Cumberland Rd, Apt 5" / "Ocean Springs, MS 39564". */
export function addressLines(a: Address): [string, string] {
  const one = [a.street, a.apt].filter(Boolean).join(", ");
  const two = [a.city, [a.state, a.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [one, two];
}
export const addressText = (a: Address) => addressLines(a).filter(Boolean).join("\n");

/** Stored as digits (with the country code when one was given); shown as (555) 555-5555. */
export function phoneDigits(v: string): string | null {
  const t = v.trim();
  if (!t) return "";
  const plus = t.startsWith("+");
  const d = t.replace(/\D/g, "");
  if (d.length === 10) return d;
  if (d.length === 11 && d.startsWith("1")) return d;
  if (plus && d.length >= 8 && d.length <= 15) return d;
  return null;
}
export function formatPhone(d: string | null | undefined) {
  if (!d) return "";
  const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d.length === 10 ? d : null;
  return ten ? `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}` : `+${d}`;
}
/** For sms: and tel: links. */
export const phoneHref = (d: string) => (d.length === 10 ? `+1${d}` : `+${d}`);

export const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
