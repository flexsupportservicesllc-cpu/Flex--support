# Flexsupport Services — Payments Landing Page

Responsive, customer-entered service payments via Stripe (Cash App Pay where eligible), PayPal, Venmo (where eligible), and manually verified Zelle.

## Setup
1. Create a new **private** GitHub repository owned by the client. Do not reuse MatatanTech infrastructure.
2. `npm install` then `cp .env.example .env.local` (on Windows, copy manually). Fill required keys in `.env.local`.
3. Run `supabase/schema.sql` in the client's Supabase SQL Editor.
4. `npm run dev`. Test against Stripe test mode and PayPal sandbox.
5. Deploy to the client's Vercel project, add environment variables in Vercel. Set `NEXT_PUBLIC_SITE_URL` to the real https domain.
6. Add a Stripe webhook pointing to `https://DOMAIN/api/stripe/webhook`, listen for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`; set `STRIPE_WEBHOOK_SECRET`.
7. Enable Cash App Pay in Stripe Dashboard; confirm eligibility and visibility. Dynamic payment methods depend on merchant and consumer eligibility and may also display cards. If Cash App Pay must be exclusive, configure that payment method in the Stripe Dashboard and provide `STRIPE_PAYMENT_METHOD_CONFIGURATION`.
8. PayPal: provide the **business** REST app client ID and secret. Sandbox first. Venmo is US-only and eligibility dependent. Production only after both wallets pass end-to-end tests. Set both `PAYPAL_ENV=live` and `NEXT_PUBLIC_PAYPAL_ENV=live` when ready.
9. Provide the verified Zelle **business** recipient email/phone. Customers will see manual transfer instructions. Zelle entries are **pending**, not paid; bank verification is required before marking paid.
10. Add client business contact information, legal name, refund/payment policy, privacy policy and brand assets before production.

## Important safeguards
- Never place secret API keys in `NEXT_PUBLIC_*` variables.
- Payment amount is chosen by customer but validated server-side ($1–$100,000).
- Stripe payments marked paid only by signed webhook (not a success URL).
- PayPal payments marked paid only after server capture validation.
- Zelle is NOT automatically confirmed, and there is no anonymous access to payment records.
- No admin dashboard in v1; client can review payment entries in secured Supabase dashboard. Manual verification should use an authenticated admin process before changing status.
- Configure production throttling/WAF (e.g. Vercel rate limiting) and bot protections before broadly sharing on social media.

## Verification checklist
- Stripe successful, canceled, expired, asynchronous, and invalid-signature webhook scenarios
- PayPal approve, cancel and declined capture; verify duplicate captures do not duplicate records
- Venmo eligibility on qualifying US mobile and desktop browsers
- Zelle submit displays pending, never a paid receipt
- Form invalid amounts, email validation, mobile layouts, metadata previews

### Current state
Source code is an implementation starter; no merchant keys, webhook endpoint, Supabase project, or live payment accounts are connected. Do not accept live payments until the above tests pass.

## Email notifications (v2)
- Configure `RESEND_API_KEY`, `ALERT_FROM_EMAIL` (domain must be verified with Resend), and `ALERT_TO_EMAIL` (recipient may be a comma-separated list). Keep Resend key server-only.
- A signed Stripe webhook sends alerts for paid checkout and asynchronous payment failure. A verified PayPal capture sends a paid alert. No notification is generated merely by clicking the payment button. If webhook delivery fails, Stripe can retry.
- Daily report runs via `/api/cron/daily-report` at **13:00 UTC** and summarizes the **preceding UTC calendar day**. Set `CRON_SECRET` as a random secret in Vercel for authorization; it must not appear in URLs or client code.
- Vercel Hobby cron schedules can be approximate; verify Vercel plan limitations. PayPal failed/declined event webhooks and refund reconciliation are not yet implemented; these are required for comprehensive failure/refund alerts.
- Email delivery requires verified sender domain and real provider credentials. No email sending has been tested in this source package; do not imply alerts are live until verified.
- This package adds a new `vercel.json` cron; remove the client's obsolete `/api/daily-summary` cron when deploying this release.
