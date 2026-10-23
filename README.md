# Flexsupport Services V10 — client-only production package

**Single release action:** On the client’s Windows machine, extract the V10 ZIP, open its `Flexsupport-Services-V10` folder, and double-click `DEPLOY_PRODUCTION.cmd`. It runs source checks, mocked payment tests, TypeScript checking, and a full local Next.js build **before** touching GitHub. On success it creates a recovery branch, pushes the changes to the client’s `main` branch, and triggers the client Vercel deployment. No Matatan account is used.

**Do not run the release script on an unfamiliar computer.** It only accepts the already-cloned `https://github.com/flexsupportservicesllc-cpu/Flex--support` repository at `%USERPROFILE%\Downloads\Flex--support`. The script does not access secret keys. The client must keep real credentials in Vercel, ensure the Node.js runtime is patched, and finish signed webhook/email verification.

Provider-confirmed payments, signed callbacks, and delivered email alerts cannot be certified by a build or a mock test. See `RELEASE_NOTES_V10.md`.

---

> V9 manual payment handoff update: See RELEASE_NOTES_V9.md. This package is not deployed.

# Flexsupport Services — V7 payment-first portal

Independent client project. **Do not connect to, deploy under, or reuse any Matatan project or account.**

## Purpose

A single-page, mobile-friendly payment portal for service payments with customer-entered amounts.

- **Cash App Pay** — Stripe Checkout, with Cash App Pay enabled/eligible in Stripe's Dashboard. With Stripe API 2026-09-30.endive+, use Dashboard-managed payment methods; do not send deprecated `payment_method_types`. The checkout route confirms Cash App is offered before redirecting.
- **PayPal** — independent PayPal Business Orders API using JavaScript SDK v6 and server-side capture. Not connected to the Venmo handle.
- **Venmo** — manual transfer instructions for `@rasika-Wick`, **not** automatically verified. The current handle is personal; the merchant must confirm any commercial usage complies with Venmo's rules.
- **Zelle** — manual bank transfer instructions for `2295467045`, **not** automatically verified.

## Critical V5 change

**Supabase is no longer a prerequisite for displaying Venmo/Zelle instructions or opening Stripe/PayPal checkout.**

Manual instructions are returned immediately. A best-effort post-response task records them as `pending` in Supabase and alerts the business that instructions were opened, **not** that money arrived. Stripe and PayPal create provider sessions/orders first; provider-confirmed payment callbacks update Supabase best-effort and send Resend alerts without relying on Supabase to send them.

A failed database connection still affects transaction history and the database-backed daily report. **Provider dashboards are authoritative, and daily reports are incomplete when Supabase is unavailable.** Do not confuse pending/manual requests with collected funds.

## Server-only Vercel environment settings

| Variable | Required for | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe payment | `sk_live_...` in Production |
| `STRIPE_WEBHOOK_SECRET` | Stripe confirmed-payment alert | Webhook endpoint `/api/stripe/webhook`; signed events |
| `STRIPE_PAYMENT_METHOD_CONFIGURATION` | Optional Stripe configuration | ID of dedicated Cash App-enabled Payment Method Configuration (`pmc_...`) |
| `PAYPAL_CLIENT_ID` | PayPal | Browser-safe client ID from the client business app |
| `PAYPAL_CLIENT_SECRET` | PayPal | Secret: server only |
| `PAYPAL_ENV` | PayPal | `live` in Production, `sandbox` in Preview |
| `NEXT_PUBLIC_ZELLE_RECIPIENT` | Zelle | `2295467045` (non-secret) |
| `NEXT_PUBLIC_ZELLE_DISPLAY_NAME` | Zelle | Actual bank-recipient display name once verified |
| `VENMO_HANDLE` | Venmo | `@rasika-Wick` (non-secret) |
| `SUPABASE_URL` | Optional transaction logging, mandatory for DB report | The exact client project API base URL; no `/rest/v1/` suffix |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional transaction logging, mandatory for DB report | Secret: server only |
| `RESEND_API_KEY` | Email alerts | Secret: server only |
| `ALERT_FROM_EMAIL` | Email alerts | Sending domain verified in Resend |
| `ALERT_TO_EMAIL` | Email alerts | `flexsupportservicesllc@gmail.com` |
| `CRON_SECRET` | Daily report endpoint | Secret: server only |
| `NEXT_PUBLIC_SITE_URL` | Stripe return links | Public production URL, e.g. https://flexsupport-lyart.vercel.app |

Standard PayPal checkout uses its public Client ID; V5 does **not** send the PayPal server OAuth access token to the browser. `NEXT_PUBLIC_PAYPAL_ENV` is no longer used.

## Stripe configuration

1. Verify Cash App Pay is activated for the client's Stripe merchant. With Stripe API 2026-09-30.endive+, configure dynamic payment methods in Stripe Dashboard. Optionally set `STRIPE_PAYMENT_METHOD_CONFIGURATION` to a configuration that enables Cash App Pay; the route returns 503 if a newly-created session does not offer `cashapp`.
2. Create a signed webhook for `https://<client-domain>/api/stripe/webhook` and set `STRIPE_WEBHOOK_SECRET` in the matching Vercel environment.
3. Subscribe to: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`.
4. Provider signed webhooks are the source of truth; the `/complete` page never marks a payment paid.

## PayPal configuration

Configure the client's PayPal Business REST app `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `PAYPAL_ENV=live` in Production. The SDK creates a PayPal approval session. On approval, the server verifies the order's `FS-` reference, captures the order and verifies the actual provider amount. PayPal and Venmo are separate destinations.

## Notifications and reporting

- Verified Stripe paid/failed events and PayPal completed captures generate Resend alerts to `flexsupportservicesllc@gmail.com`. Manual-method instruction emails are clearly labeled **pending, not paid**.
- Resend uses stable provider keys for idempotency. Notifications cannot be guaranteed if the Resend service is unavailable or unconfigured.
- Daily report is scheduled by `vercel.json` for 13:00 UTC (9 AM EDT, 8 AM EST). It summarizes **rows created in Supabase the previous UTC day**, not all provider settlements. If the DB was unreachable, a separate **REPORT UNAVAILABLE** email is sent (when Resend works), rather than claiming zero transactions. Reconcile manually in provider dashboards. Refunds, disputes, and provider-level reconciliation are not fully implemented; do not call this a complete accounting report yet.

## Test commands

```bash
npm ci        # when a committed package-lock.json exists
# or npm install (generates package-lock.json on first install)
npm run check:source
npm run test:routes
npm run typecheck
npm run build
```

`test:routes` runs **mocked** Zelle, Venmo, Stripe, and PayPal routes and makes no actual API calls or payments. To certify a live release, complete sandbox tests and verify signed webhooks, email delivery, provider configuration, and reconciliation. Do not infer successful live payment behavior from a passing build.


## V6 update
See `RELEASE_NOTES_V6.md` for changes, tested scope, required production env vars/webhooks and current limitations.

## V7 compatibility and CI

See `RELEASE_NOTES_V7.md`. Stripe Checkout no longer sends deprecated `payment_method_types` in API 2026-09-30.endive+. The route verifies Cash App is present before redirect. `npm run test:report` checks the daily-report error-notification fallback with mocks. A GitHub Actions workflow runs the checks and full build on each pull request; no secrets are required for source checks.
