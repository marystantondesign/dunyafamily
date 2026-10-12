import { notFound } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { q } from "@/lib/db";
import { displayName } from "@/lib/names";
import { formatPhone, smsReady } from "@/lib/sms";

export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { reminder: "Reminder", code: "Code", reply: "Reply" };

/** Texts sent (admin): every reminder and confirmation code, newest first, and replies like STOP. */
export default async function TextsPage() {
  if (!isAdmin(await getSession())) notFound();
  const rows = await q<{ id: number; name: string | null; phone: string | null; kind: string; body: string | null; status: string; error: string | null; created_at: string }>(
    `select s.id, pe.name, s.phone, s.kind, s.body, s.status, s.error, s.created_at from reminder_sends s
       left join people pe on pe.id = s.person_id order by s.created_at desc limit 200`);
  const [on] = await q<{ n: number }>(`select count(*)::int as n from reminder_settings where enabled and phone_verified_at is not null`);
  return (
    <div className="admin-page">
      <div className="page-head">
        <h1 className="display">Texts sent</h1>
        <p>{smsReady() ? `Texting is set up. ${on?.n ?? 0} ${on?.n === 1 ? "person gets" : "people get"} reminders.` : "Texting isn't set up yet, so nothing is sent. Add the Twilio settings in Vercel to turn it on."}</p>
      </div>
      {rows.length ? (
        <ul className="texts-list">
          {rows.map((r) => (
            <li key={r.id} className={r.status === "failed" ? "failed" : undefined}>
              <div className="texts-meta">
                <strong>{r.name ? displayName(r.name) : formatPhone(r.phone)}</strong>
                <span>{KIND[r.kind] ?? r.kind} · {r.status}</span>
                <time dateTime={r.created_at}>{new Date(r.created_at).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time>
              </div>
              {r.body && <pre className="texts-body">{r.body}</pre>}
              {r.error && <p className="error">{r.error}</p>}
            </li>
          ))}
        </ul>
      ) : <p className="muted">No texts yet.</p>}
    </div>
  );
}
