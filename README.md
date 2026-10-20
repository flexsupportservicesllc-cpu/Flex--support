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
├─ index.html                      ← the page (edit your handles here)
├─ api/
│  ├─ create-checkout-session.js   ← builds the Stripe Cash App checkout
│  └─ webhook.js                   ← (optional) records confirmed payments
├─ package.json                    ← Stripe dependency
└─ .env.example                    ← which env vars to set in Vercel
```

---

## Notes & honest caveats

- **Zelle can never be automated** — no API exists. It stays manual, amount typed by the client.
- **Square alternative:** Cash App Pay can also run through Square instead of Stripe. If you’d rather settle Cash App into your Square balance, say so — the Cash App button would use Square’s Web Payments SDK instead (a different `/api` function). Pick ONE processor for Cash App; don’t wire both.
- **PayPal/Venmo can be upgraded** to real auto-confirming checkout later (PayPal SDK handles both). Right now they’re manual by your choice.
- Test everything in Stripe **test mode** (`sk_test_...` + a test Cash App flow) before going live.
- For a running list of all payments (manual + auto), the next step is a small Supabase table — ask and I’ll wire the “I’ve paid” button and the webhook to write to it.
