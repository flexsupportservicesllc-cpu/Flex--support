# Flexsupport Services — V6 recovery release (2026-10-23)

## Implemented
- Retained payment-first V5 architecture. Zelle and Venmo show manual details without Supabase prerequisite.
- Stripe `cashapp` Checkout is now explicitly requested; no misleading card-only checkout under Cash App label. Merchant eligibility still applies.
- Stripe `payment_intent.payment_failed` is handled in a verified, signed webhook. A provider-failed attempt can email business; declined/abandoned/cancelled payments are different.
- Stripe webhook requests retries if durable record OR required email notification fails. Resend provider-keyed idempotency is used to reduce duplicate alerts.
- PayPal SDK v6 is passed the `{orderId}` response promised by official v6 documentation.
- Added `POST /api/paypal/webhook` to verify signature with PayPal and cross-check the order against our reference + amount; supports completed and denied/declined capture alerts. PayPal app must be configured with this URL and `PAYPAL_WEBHOOK_ID` secret.
- Stripe success and PayPal capture remain operational even when database is unreachable; stored records and daily reports do NOT become complete until Supabase connectivity is repaired.

## Run checks
`npm install && npm run check:source && npm run test:routes && npm run build`
Run via terminal or CI in the client's isolated repo; do not put actual credentials in files.

## Live activation prerequisites
1. Add `STRIPE_WEBHOOK_SECRET` and register `https://<client-domain>/api/stripe/webhook` for Checkout and PaymentIntent failure events in client's Stripe account. Stripe API must enable Cash App Pay.
2. Add `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV=live`, `PAYPAL_WEBHOOK_ID`. Register `https://<client-domain>/api/paypal/webhook` with completed/denied capture events in the client's Live PayPal app.
3. Configure Supabase `SUPABASE_URL` from client's actual project (not manually entered), server-side service role key, and payments schema. Verify database write directly from server runtime.
4. Resend: `RESEND_API_KEY`, verified `ALERT_FROM_EMAIL`, `ALERT_TO_EMAIL=flexsupportservicesllc@gmail.com`. Verify send and Vercel logs.
5. `CRON_SECRET` protects daily report endpoint, scheduled at 13:00 UTC; report is database-only and MUST be treated as incomplete if database was offline.
6. Venmo recipient `@rasika-Wick` is a personal account: business-payment restrictions may apply; handle is informational and must not be represented as an authorized commercial checkout. Zelle `2295467045` must match business's verified receiving profile.

## Verification performed locally
- TypeScript/TSX source parsed; JSON valid.
- Mocked provider route tests run without credentials or real charges.
- Full Next.js dependency install/build blocked by networking timeout in this execution environment; a passing build is required before production.
- The package is not deployed to client GitHub/Vercel. No live payment or email verification performed.

## Known limitations
- Refund/dispute reconciliation, PayPal refunds and Stripe chargeback alerts need additional provider-status handling.
- Business daily report cannot be complete if Supabase is unreachable; reconcile from payment-provider dashboards.
- No admin UI for manually verifying Venmo or Zelle yet. Do not mark any manual transfer paid based solely on customer action.

Manual instruction-opened emails are OFF by default (`ALERT_MANUAL_REQUESTS=false`) to reduce notification spam; these are not paid/failed transactions.
