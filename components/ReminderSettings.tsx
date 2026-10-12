"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Frequency, Include, ReminderSettings } from "@/lib/reminders";
import { Icon } from "./Icon";

const TIMES: { label: string; value: string }[] = [
  { label: "Morning", value: "07:00" }, { label: "Midday", value: "12:00" }, { label: "Evening", value: "18:00" }, { label: "Before bed", value: "21:00" },
];
const OFTEN: { label: string; value: Frequency }[] = [
  { label: "Every day", value: "daily" }, { label: "A few times a week", value: "fewweek" }, { label: "Only when something is new", value: "new" },
];
const INCLUDE: { label: string; key: keyof Include }[] = [
  { label: "Prayers I'm praying for", key: "prayers" }, { label: "Birthdays", key: "birthdays" }, { label: "Anniversaries", key: "anniversaries" },
  { label: "Remembrance days", key: "remembrance" }, { label: "When a prayer is answered", key: "answered" },
];
const RESEND_SECONDS = 60;

async function call(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "That didn't work. Try again.");
}

/** Six boxes for the code. Typing moves along; pasting fills them all; the last digit checks it. */
function CodeBoxes({ onDone, disabled }: { onDone: (code: string) => void; disabled: boolean }) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => { boxes.current[0]?.focus(); }, []);
  function set(i: number, v: string) {
    const clean = v.replace(/\D/g, "");
    if (clean.length > 1) {
      const next = [...digits];
      clean.slice(0, 6 - i).split("").forEach((d, k) => { next[i + k] = d; });
      setDigits(next);
      boxes.current[Math.min(5, i + clean.length)]?.focus();
      if (next.every(Boolean)) onDone(next.join(""));
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 5) boxes.current[i + 1]?.focus();
    if (next.every(Boolean)) onDone(next.join(""));
  }
  return (
    <div className="rm-code" role="group" aria-label="6-digit code">
      {digits.map((d, i) => (
        <input key={i} ref={(el) => { boxes.current[i] = el; }} inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"} maxLength={6}
          aria-label={`Digit ${i + 1}`} value={d} disabled={disabled}
          onChange={(e) => set(i, e.target.value)}
          onKeyDown={(e) => { if (e.key === "Backspace" && !digits[i] && i > 0) boxes.current[i - 1]?.focus(); }} />
      ))}
    </div>
  );
}

/** Text reminders (mockup 47). The phone number is confirmed with a texted code before anything is sent to it. */
export function ReminderSettingsForm({ initial, phoneShown, ready, hasContact }: { initial: ReminderSettings; phoneShown: string; ready: boolean; hasContact: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [phone, setPhone] = useState(phoneShown);
  const [editingPhone, setEditingPhone] = useState(!initial.verified);
  const [codeSent, setCodeSent] = useState(false);
  const [wait, setWait] = useState(0);
  const [verified, setVerified] = useState(initial.verified);
  const [checking, setChecking] = useState(false);
  const [codeKey, setCodeKey] = useState(0);
  const [time, setTime] = useState(initial.sendTime);
  const [often, setOften] = useState<Frequency>(initial.frequency);
  const [include, setInclude] = useState<Include>(initial.include);
  const [busy, setBusy] = useState(false);
  const [phoneMsg, setPhoneMsg] = useState("");
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function sendCode() {
    setPhoneMsg("");
    try { await call("/api/reminders/code", "POST", { phone }); setCodeSent(true); setVerified(false); setWait(RESEND_SECONDS); setCodeKey((k) => k + 1); }
    catch (e) { setPhoneMsg((e as Error).message); }
  }
  async function check(code: string) {
    setChecking(true);
    setPhoneMsg("");
    try { await call("/api/reminders/verify", "POST", { code }); setVerified(true); setCodeSent(false); setEditingPhone(false); router.refresh(); }
    catch (e) { setPhoneMsg((e as Error).message); setCodeKey((k) => k + 1); }
    setChecking(false);
  }
  async function save() {
    setBusy(true);
    setMsg(null);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
    try {
      await call("/api/reminders", "PUT", { enabled, sendTime: time, timeZone, frequency: often, include });
      setMsg({ text: enabled && !verified ? "Saved. Confirm your phone number and the texts will start." : "Saved." });
      router.refresh();
    } catch (e) { setMsg({ text: (e as Error).message, error: true }); }
    setBusy(false);
  }

  return (
    <div className="rm">
      <h1 className="display desktop-only">Text reminders</h1>
      {!ready && <p className="rm-notice">Texting isn&apos;t set up yet. You can choose your settings now, and the texts will start once it&apos;s ready.</p>}

      <div className="rm-toggle">
        <label htmlFor="rm-on"><strong>Text me reminders</strong><span>One short text, with your prayers and family dates.</span></label>
        <input id="rm-on" type="checkbox" role="switch" className="switch" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
      </div>

      <section className="rm-section">
        <label htmlFor="rm-phone" className="rm-label">Your phone number</label>
        <div className="rm-phone">
          <input id="rm-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(212) 555-0143" value={phone}
            disabled={!editingPhone || codeSent} onChange={(e) => setPhone(e.target.value)} />
          {!editingPhone || codeSent ? (
            <button type="button" className="text-btn rm-change" onClick={() => { setEditingPhone(true); setCodeSent(false); setPhoneMsg(""); }}>Change</button>
          ) : (
            <button type="button" className="btn" disabled={!phone.trim()} onClick={sendCode}>Send code</button>
          )}
        </div>
        {verified && !codeSent && !editingPhone && <p className="rm-ok"><Icon name="check" size={16} stroke={2.4} /> Confirmed</p>}
        {codeSent && (
          <div className="rm-code-box">
            <p>We texted you a 6-digit code. Enter it to confirm.</p>
            <CodeBoxes key={codeKey} onDone={check} disabled={checking} />
            <button type="button" className="text-btn rm-resend" disabled={wait > 0} onClick={sendCode}>
              {wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}
            </button>
          </div>
        )}
        {phoneMsg && <p className="error" role="alert">{phoneMsg}</p>}
      </section>

      <section className="rm-section">
        <h2 className="rm-label">When do you usually pray?</h2>
        <div className="rm-chips">
          {TIMES.map((t) => <button key={t.value} type="button" className={`rm-chip${time === t.value ? " on" : ""}`} aria-pressed={time === t.value} onClick={() => setTime(t.value)}>{t.label}</button>)}
        </div>
        <label className="rm-time">Text me at <input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} /></label>
      </section>

      <section className="rm-section">
        <h2 className="rm-label">How often?</h2>
        <div className="rm-chips">
          {OFTEN.map((o) => <button key={o.value} type="button" className={`rm-chip${often === o.value ? " on" : ""}`} aria-pressed={often === o.value} onClick={() => setOften(o.value)}>{o.label}</button>)}
        </div>
        {often === "fewweek" && <p className="hint">Mondays, Wednesdays, and Fridays.</p>}
        {often === "new" && <p className="hint">Only when you&apos;ve added a prayer since the last text, or a family date is today.</p>}
      </section>

      <section className="rm-section">
        <h2 className="rm-label">Include</h2>
        <ul className="rm-checks">
          {INCLUDE.map((i) => (
            <li key={i.key}>
              <label><input type="checkbox" checked={include[i.key]} onChange={(e) => setInclude({ ...include, [i.key]: e.target.checked })} /> {i.label}</label>
            </li>
          ))}
        </ul>
      </section>

      {hasContact && (
        <div className="rm-tip">
          <span className="rm-tip-icon" aria-hidden="true">📇</span>
          <p>Save Dunya Family to your contacts so the picture shows in your texts.</p>
          <a href="/api/reminders/contact" className="btn rm-contact">Add contact</a>
        </div>
      )}

      <button type="button" className="btn btn-primary rm-save" disabled={busy} onClick={save}>{busy ? "Saving" : "Save"}</button>
      {msg && <p className={msg.error ? "error rm-msg" : "rm-msg"} role="status">{msg.text}</p>}
      <p className="rm-stop">Reply STOP to any text to turn these off.</p>
    </div>
  );
}
