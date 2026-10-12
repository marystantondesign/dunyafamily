import Link from "next/link";
import { redirect } from "next/navigation";
import { ReminderSettingsForm } from "@/components/ReminderSettings";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/reminders";
import { formatPhone, smsReady } from "@/lib/sms";

export const dynamic = "force-dynamic";

/** Text reminders (mockup 47): one short text with your prayers and family dates, at the time you usually pray. */
export default async function RemindersPage() {
  const s = await getSession();
  if (!s) redirect("/enter");
  if (!s.pid) {
    return (
      <div className="rm">
        <h1 className="display desktop-only">Text reminders</h1>
        <p className="lede">Pick yourself first, so the texts can include the prayers you&apos;ve added.</p>
        <Link href="/enter/who" className="btn btn-primary">Pick yourself</Link>
      </div>
    );
  }
  const settings = await getSettings(s.pid);
  return <ReminderSettingsForm initial={settings} phoneShown={formatPhone(settings.phone)} ready={smsReady() || process.env.SMS_DRY_RUN === "1"} hasContact={!!process.env.TWILIO_FROM} />;
}
