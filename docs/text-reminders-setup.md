# Text reminders: turning them on

Everything for text reminders is already in the site. Until the settings below are filled in, the
Text reminders page works and saves people's choices, but no texts are sent. Mary's admin page
"Texts sent" (Settings, then Admin) says whether texting is set up.

## 1. Twilio account and number

1. Sign up at twilio.com and upgrade from the trial (trial accounts can only text verified numbers).
2. Buy one local US phone number that can send SMS.
3. Register for US texting (A2P 10DLC) as a **Sole Proprietor** under Messaging, Regulatory Compliance.
   Twilio will ask for the items below. Suggested answers:
   - **Your details:** your legal name, email, address, and a mobile number (Twilio texts it a code). No EIN.
   - **Use case:** Sole proprietor. Description: "Opt-in prayer and family date reminders for members of a
     private family website. Members choose to receive one short text at a time they pick."
   - **How people opt in (message flow):** "Family members sign in to the password-protected family site,
     open Settings, then Text reminders, enter their mobile number, and confirm it by typing a 6-digit code
     we text them. They choose the time and how often. Reminders only start after the number is confirmed."
   - **Sample message 1:** "Good morning, Mary 🙏 You're praying for: • Uncle Ray: dental surgery Thursday
     • Jenni: starting a new job Monday  Today is Sandra's birthday 🎂  https://dunya-family.com/prayer?tab=mine
     Reply STOP to stop."
   - **Sample message 2:** "Your Dunya Family code is 123456. It expires in 10 minutes."
   - **Opt-out:** STOP. **Help:** HELP, answered with "Dunya Family prayer reminders. Change them at
     https://dunya-family.com/you/reminders. Reply STOP to stop."
   - Message contents: no links to other sites, no phone numbers, no age-gated content. Embedded links: yes
     (your own site).
4. Wait for approval (often a few days). Texts to US numbers won't deliver reliably before then.

## 2. Settings in Vercel

In Vercel, open the project, then Settings, then Environment Variables, and add these for Production
(the same names are listed in `.env.example`; on your Mac, paste the values into those lines of `.env`):

| Name | Where it comes from |
| --- | --- |
| `TWILIO_ACCOUNT_SID` | Twilio console home page, Account Info |
| `TWILIO_AUTH_TOKEN` | Twilio console home page, Account Info |
| `TWILIO_FROM` | Your Twilio number, like `+12125550143` (or leave blank and use the next one) |
| `TWILIO_MESSAGING_SERVICE_SID` | Optional: a Messaging Service SID (starts with `MG`), if your registration put the number in one |
| `SITE_URL` | The site's address, like `https://dunya-family.com` (no slash at the end) |
| `CRON_SECRET` | Any long random string. On a Mac: `openssl rand -hex 24` |

Then redeploy (Deployments, the latest one, Redeploy) so the site picks them up.

## 3. Replies (STOP, START, HELP)

In Twilio, open your phone number (or its Messaging Service), and under "A message comes in" set
Webhook, HTTP POST, to:

    https://YOUR-SITE/api/sms/incoming

STOP turns reminders off on the site too, and START turns them back on. Twilio sends its own STOP
and START confirmations; the site answers HELP.

## 4. The 15-minute schedule

The schedule runs on GitHub Actions (free), from `.github/workflows/reminders.yml`. In GitHub, open
the dunyafamily repository, then Settings, Secrets and variables, Actions, and add two repository secrets:

- `SITE_URL`: the same address as in Vercel
- `CRON_SECRET`: the same string as in Vercel

To test right away: GitHub, Actions, "Text reminders", Run workflow. GitHub can run scheduled jobs a
few minutes late; the site still sends anything due in the last three hours, and never twice in a day.
GitHub pauses schedules in a repository with no activity for 60 days; Actions shows a button to turn
it back on.

(If the Vercel project is ever on the Pro plan, a Vercel cron job every 15 minutes calling
`/api/cron/reminders` works too. It sends the CRON_SECRET automatically.)

## 5. Try it

1. On the site: Settings, Text reminders. Enter your number, type the code, pick a time a few minutes
   from now, check Include, and Save.
2. In GitHub Actions, run "Text reminders" once that time has passed.
3. The text arrives and its link opens My prayers. Every send (and any failure, with Twilio's reason)
   shows in Settings, Admin, Texts sent.
