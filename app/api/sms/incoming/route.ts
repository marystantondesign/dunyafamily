import { handleReply } from "@/lib/reminders";
import { fromTwilio, twiml } from "@/lib/sms";

/** Twilio sends texts people reply with here (STOP, START, HELP). Only requests signed by Twilio are accepted. */
export async function POST(req: Request) {
  const params = Object.fromEntries(new URLSearchParams(await req.text())) as Record<string, string>;
  if (!fromTwilio(req.url, params, req.headers.get("x-twilio-signature"))) return new Response("Forbidden", { status: 403 });
  const reply = await handleReply(params.From ?? "", params.Body ?? "");
  return new Response(twiml(reply), { headers: { "Content-Type": "text/xml" } });
}
