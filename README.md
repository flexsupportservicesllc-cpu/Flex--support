# Mandi — Payments Page (Setup & Deploy Guide)

A single landing page where clients enter an amount and pay via **Cash App, PayPal, Venmo, or Zelle**.

- **Cash App = Tier 2 (automatic).** Runs through **Stripe** (Cash App Pay). The client is charged, Stripe confirms instantly, money lands in your Stripe balance — no manual matching.
- **PayPal / Venmo / Zelle = Tier 1 (manual).** The page shows your handle + a QR + an “Open app” deep link. The client pays, taps “I’ve paid,” and **you confirm by hand** against your accounts.

---

## STEP 1 — Enter your handles (manual methods)

Open `index.html`, find the block near the top of the `<script>` marked
`EDIT YOUR PAYMENT DETAILS HERE`, and replace the `REPLACE_...` values (keep the quotes):

```js
const MANDI = {
  businessName: "Mandi",
  zelle:   { handle: "pay@yourdomain.com" },   // Zelle email OR phone
  venmo:   { handle: "Mandi-Payments" },        // Venmo username, NO @
  paypal:  { email: "flexsupportservicesllc@gmail.com" }, // your PayPal account email
  cashapp: {
    useStripe: true,          // leave true for automatic Stripe checkout
    cashtag: "$mandi"         // only used if you set useStripe: false
  }
};
```

| Field | Where to get it |
|-------|-----------------|
| **zelle.handle** | The email or phone you registered with Zelle in your bank app |
| **venmo.handle** | Your Venmo username (Profile → the @name), entered WITHOUT the @ |
| **paypal.email** | The email on your PayPal account (pre-filled: flexsupportservicesllc@gmail.com) |

That’s all the manual methods need. QR codes and “Open app” links build themselves.

---

## STEP 2 — Connect Stripe (Cash App auto-checkout)

1. Create / log in to **Stripe** (stripe.com). In **Settings → Payment methods**, turn on **Cash App Pay**.
2. Get your keys from **Developers → API keys**:
   - **Secret key** (`sk_live_...` or `sk_test_...`) — goes on the SERVER only.
   - (You do NOT need the publishable key for this setup — the redirect flow uses the secret key server-side.)
3. You’re done in the code — the `cashapp.useStripe: true` flag already routes the Cash App button through Stripe.

> 🔒 The secret key is **never** in `index.html`. It lives only in a Vercel environment variable (Step 3). The browser only ever receives a one-time Stripe checkout URL.

### (Optional) auto-record each paid order
Set up a webhook so confirmed payments are logged automatically:
- Stripe Dashboard → **Developers → Webhooks → Add endpoint**
- URL: `https://YOUR-DOMAIN/api/webhook`
- Event: `checkout.session.completed`
- Copy the **Signing secret** (`whsec_...`) into the `STRIPE_WEBHOOK_SECRET` env var.

---

## STEP 3 — Deploy to Vercel

1. Put this folder in a Git repo (GitHub) and import it in **Vercel** (or run `vercel` with the CLI).
2. In **Vercel → Project → Settings → Environment Variables**, add:
   - `STRIPE_SECRET_KEY` = your `sk_...` key
   - `STRIPE_WEBHOOK_SECRET` = your `whsec_...` (only if you set up the webhook)
3. Deploy. Point your domain at it. Done.

Vercel auto-detects the `/api` folder as serverless functions — no extra config.

---

## Project files

```
mandi-pay/
├─ index.html                      ← the payment page (edit your handles here)
├─ admin.html                      ← private payments dashboard (/admin)
├─ vercel.json                     ← schedules the daily summary email
├─ api/
│  ├─ create-checkout-session.js   ← builds the Stripe Cash App checkout
│  ├─ webhook.js                   ← records CONFIRMED Cash App payments (auto)
│  ├─ notify.js                    ← records SELF-REPORTED PayPal/Venmo/Zelle
│  ├─ payments.js                  ← feeds the dashboard (password-protected)
│  ├─ daily-summary.js             ← emails the once-a-day digest (Vercel Cron)
│  └─ _lib.js                      ← shared: write to Supabase + send email
├─ package.json                    ← Stripe dependency
└─ .env.example                    ← which env vars to set in Vercel
```

---

## STEP 4 — Payment log + alerts (who paid / how much / how)

This is the unified system so the business sees **every** payment in one place
and gets an email the moment one comes in — instead of watching four apps.

**What gets recorded:** time, payer name, amount, method, the “what’s this for”
note, and a status:
- **Confirmed** = real Cash App payment verified by Stripe (logs itself via the webhook).
- **Self-reported** = the payer tapped “I’ve paid” after PayPal/Venmo/Zelle. This is
  their *claim*, not proof — always confirm it landed in your actual app before
  treating it as paid.

### 4a. Create the Supabase project + table
1. Go to **supabase.com**, create a free project (the client's own account).
2. Open **SQL Editor**, paste this, and click **Run**:

```sql
create table payments (
  id          bigint generated always as identity primary key,
  created_at  timestamptz default now(),
  method      text,     -- cashapp / paypal / venmo / zelle
  payer       text,
  amount      numeric,
  note        text,
  status      text,     -- 'confirmed' (Stripe) or 'reported' (self-reported)
  source      text      -- 'stripe' or 'page'
);
```
3. Go to **Project Settings → API** and copy the **Project URL** and the
   **service_role** key (the secret one — NOT the anon key).

### 4b. (Optional) turn on email alerts
1. Create a free account at **resend.com**, make an **API key**.
2. To send from your own domain, verify it in Resend. Until then the test sender
   `onboarding@resend.dev` works for sending to yourself.

### 4c. Add the env vars in Vercel
In **Vercel → Project → Settings → Environment Variables** add:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | your Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | the Supabase **service_role** secret key |
| `ADMIN_PASSWORD` | any password you choose (to open the dashboard) |
| `RESEND_API_KEY` | *(optional)* your Resend key for email alerts |
| `ALERT_EMAIL` | *(optional)* where alerts go, e.g. flexsupportservicesllc@gmail.com |
| `ALERT_FROM` | *(optional)* `Mandi Payments <onboarding@resend.dev>` |

Redeploy. Done.

### 4d. Open the dashboard
Go to **`https://YOUR-DOMAIN/admin`**, enter the `ADMIN_PASSWORD`, and you’ll see
the running list with running totals and a Confirmed / Self-reported filter.

> Email + Supabase are both **optional and independent**. With neither set, the
> page still works and payments are written to the Vercel function logs. Add
> Supabase for the dashboard, add Resend for email — in any order.

---

## STEP 5 — Daily summary email (once-a-day digest)

One email a day with the last 24 hours: total collected, confirmed vs
self-reported, a per-method breakdown, and the full list. It runs on **Vercel
Cron** (free tier allows one daily job) and needs Supabase + Resend from Step 4.

1. The schedule lives in **`vercel.json`** (already included):
   ```json
   { "crons": [ { "path": "/api/daily-summary", "schedule": "0 13 * * *" } ] }
   ```
   `0 13 * * *` = **1:00 PM UTC daily** ≈ **8:00 AM US Central**, summarizing the
   previous 24 hours. To change the time, edit the two numbers (minute hour) —
   it’s in **UTC**, so subtract 5–6 hours for US Central.
2. Add one more env var in **Vercel → Settings → Environment Variables**:
   | Variable | Value |
   |----------|-------|
   | `CRON_SECRET` | any long random string (locks the cron so only Vercel can trigger it) |
3. Redeploy. Vercel registers the cron automatically (check **Vercel → Project
   → Settings → Cron Jobs**).
4. **Test it now** without waiting a day: open
   `https://YOUR-DOMAIN/api/daily-summary?pw=YOUR_ADMIN_PASSWORD` in a browser.
   You should get a JSON `{ ok: true, ... }` and the summary email in your inbox.

> Needs email (Resend) set up to actually send. Without `CRON_SECRET` it still
> runs, but anyone could trigger it — so set `CRON_SECRET`.

---

## Notes & honest caveats

- **Zelle can never be automated** — no API exists. It stays manual, amount typed by the client.
- **Square alternative:** Cash App Pay can also run through Square instead of Stripe. If you’d rather settle Cash App into your Square balance, say so — the Cash App button would use Square’s Web Payments SDK instead (a different `/api` function). Pick ONE processor for Cash App; don’t wire both.
- **PayPal/Venmo can be upgraded** to real auto-confirming checkout later (PayPal SDK handles both). Right now they’re manual by your choice.
- Test everything in Stripe **test mode** (`sk_test_...` + a test Cash App flow) before going live.
- For a running list of all payments (manual + auto), see **STEP 4** above — it’s
  already wired: the webhook logs confirmed Cash App, the “I’ve paid” button logs
  the rest, and `/admin` shows them all.
