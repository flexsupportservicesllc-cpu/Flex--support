# V5 Review — Payment-First Recovery

## Root cause corrected

V4 executed Supabase `payments.insert` before **every** payment method, so an unreachable database yielded the same error for Cash App, PayPal, Venmo and Zelle. V5 removes that precondition while preserving provider-verified transaction statuses.

## Code changes

- Venmo and Zelle immediately return recipient instructions with UUID references and `pending` status. Supabase record creation and optional Resend notification occur after the response. A user clicking a button never becomes `paid`.
- Stripe creates a Checkout Session directly. Confirmation is handled by signed webhook; a missing Supabase server does not prevent starting checkout. Stripe webhooks send payment alerts independent of Supabase.
- PayPal creates a Business Orders API order directly; the browser receives only the public Client ID, never OAuth server tokens. Server verifies order reference and amounts, then captures PayPal payment.
- Resend sends business alerts for provider-confirmed successes/Stripe asynchronous failures and for **manual instructions opened** (explicitly pending). The daily report remains database-based and may be incomplete if the DB is unreachable.
- The current design, free-form service description, customer-selected amount, separate manual Venmo/Zelle instructions, and contact-alert email remain in place.

## Verification

- Static TS/TSX parse and JSON parse are run with `npm run check:source`.
- No-money mocked route tests run with `npm run test:routes`.
- Complete Next.js build requires npm dependencies. If dependency installation is blocked, full compilation remains unverified.
- No changes have been made to the client's GitHub, Vercel, Stripe, PayPal, Resend, or Supabase accounts by producing this ZIP.

## Before a live release

Obtain a **successful** local `npm run build`, then a Vercel preview deployment and verified provider test payments. Check Stripe's signed webhook delivery, PayPal merchant settlement, Resend notification and the daily report. Confirm manual Venmo commercial-payment eligibility before publishing the handle as a service-payment option. Reconcile database records from provider dashboards until Supabase connectivity is fixed.
