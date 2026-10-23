# Flexsupport Services V7 — compatibility and reporting integrity

**Date:** October 23, 2026. Isolated client application. No other projects or accounts should be used.

## Code corrections

1. **Stripe Cash App Pay compatibility:** Modern Stripe Checkout API versions (2026-09-30.endive+) reject the `payment_method_types` request parameter. Removed it, optionally use the merchant's `STRIPE_PAYMENT_METHOD_CONFIGURATION` ID, and reject sessions that do not actually offer Cash App Pay. No card-only checkout is passed off as Cash App Pay.
2. **Reporting failure visibility:** When the daily Supabase report cannot be generated, send a clearly labeled `REPORT UNAVAILABLE` email via Resend. A missing database is never misreported as zero revenue. This does not restore transaction data; reconciliation is still necessary.
3. **CI verification:** Added a GitHub Actions build/check workflow and mocked test for daily-report failure handling. Existing provider tests remain.

## Verified in this environment
- TypeScript/TSX **syntax** and JSON checks pass.
- Mocked payment routes: Zelle, Venmo, Stripe, PayPal pass, including Stripe session with and without Cash App eligibility.
- Mocked signed webhook verification, status updates and retries pass.
- Mocked daily-report authorization, successful send and database-outage notification pass.

**Not verified:** full Next.js build, live merchant API calls, Supabase writes, Stripe/PayPal webhooks and real email delivery. `npm install` could not resolve registry.npmjs.org (`EAI_AGAIN`) in this execution environment. Do not treat V7 as commercially ready without the GitHub CI build and provider verification.

## Production prerequisites
- Stripe merchant must actually offer Cash App Pay; set `STRIPE_PAYMENT_METHOD_CONFIGURATION` only if using an eligible dedicated configuration.
- Configure signing secrets `STRIPE_WEBHOOK_SECRET` and `PAYPAL_WEBHOOK_ID`, register provider webhook endpoints and test signed events.
- Configure verified Resend sender and `ALERT_TO_EMAIL=flexsupportservicesllc@gmail.com`.
- Verify the *correct client Supabase project base URL* and server key. Manual instructions and provider checkout do not depend on Supabase, but reports do.
- Use a protected preview deployment and do not merge to Production until provider-specific confirmation, refund/failed handling and email delivery are checked.

## References
- https://support.stripe.com/questions/fix-the-payment_method_types-error
- https://developer.paypal.com/sdk/js/set-up/
- https://vercel.com/docs/cron-jobs/manage-cron-jobs
