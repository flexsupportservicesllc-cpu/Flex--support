# Flexsupport Services V8 — Payment confirmation and record consistency

**Status: review package; NOT deployed.** The current chat's Vercel connector lacks permission to the independent client workspace `mandi10`. This archive must never be considered live merely because it is downloaded.

## What was improved

1. **Payment-status ordering / replay safety** (`lib/server.ts`): payment events are first inserted. On an existing payment ID, a conditional database update permits valid transitions but prevents a late failure or expiration event from downgrading a paid record. A paid event does not overwrite a refunded record. The collision check verifies the payment's own ID, not merely any unique-key violation. Provider checkout is not blocked by Supabase failures.
2. **Regression test** (`scripts/test-persistence.cjs`): verifies pending→paid, late failure and expiry, refunded status, duplicate pending creation, collision on a different unique key, and database unavailability without using real customer data.
3. **Build verification gate** (`.github/workflows/verify.yml`): includes the regression test and uses a patched Node.js 24.22.1 runner.
4. Removed duplicate PayPal webhook variable from `.env.example` and included regression test in `DEPLOY_PREVIEW.ps1`.

## Checked on this package
- `npm run check:source` — PASS
- `npm run test:routes` — PASS (mocked provider responses)
- `npm run test:webhooks` — PASS (mocked provider webhooks)
- `npm run test:persistence` — PASS (mocked Supabase)
- `npm run test:report` — PASS (mocked email/report)

**Not checked:** complete Next.js build (dependency registry is unreachable in this environment), actual payment capture, live webhook signatures from Stripe and PayPal, Resend email delivery, and the client's Vercel deployment. The `DEPLOY_PREVIEW.cmd` helper requires `npm.cmd install` to finish, checks both build and tests, and pushes **only a preview branch** before any production merge.

## Production release requirements
- Server keys installed only in the client's Vercel project. Never commit live keys.
- Ensure `STRIPE_WEBHOOK_SECRET` matches the signed Stripe webhook configured for `https://flexsupport-lyart.vercel.app/api/stripe/webhook`. Listen for checkout completed, asynchronous success/failure, expired, and payment_intent.payment_failed as used by the implementation.
- Configure PayPal webhook for `https://flexsupport-lyart.vercel.app/api/paypal/webhook` and store its ID in `PAYPAL_WEBHOOK_ID`.
- Configure Resend's verified `ALERT_FROM_EMAIL`, `RESEND_API_KEY`, and recipient `flexsupportservicesllc@gmail.com`, plus `CRON_SECRET`.
- Independently verify at least one test completion and a failure alert without sending real money. In production, verify provider dashboard status before accepting payments; manual Venmo and Zelle remain pending until recipient confirms them.
- Supabase may remain unavailable during checkout, but accurate daily reports **require** a functioning database or a separate provider reconciliation process. The current daily handler warns on data failure, rather than incorrectly reporting zero payments.
