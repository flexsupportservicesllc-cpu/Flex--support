# Flexsupport Services V10 — client-controlled production release

This is an independently scoped Flexsupport Services release, based on V9. Do not use Matatan accounts.

## Confirmed from code and no-money checks
- Zelle and Venmo instructions do not depend on Supabase; Zelle is a bank transfer and Venmo uses the client-supplied personal handle.
- Stripe Cash App Pay uses the merchant's available payment-method configuration and verifies that Cash App is offered by a newly created checkout session.
- PayPal v6 uses a browser-safe Client ID, with the Client Secret and capture retained server-side.
- Stripe and PayPal signed webhooks send verified payment event notices. Duplicate and late out-of-order event state guards are included.
- Daily report is database-backed, and sends a **report unavailable** warning if database access fails. It is not a complete provider settlement report.
- `/api/health` identifies release V10 without displaying credentials.

## Deployment
Run `DEPLOY_PRODUCTION.cmd` only from the extracted release ZIP **on the client’s Windows machine that owns** `C:\Users\...\Downloads\Flex--support`. It verifies the client-only Git remote, executes source, mock payment, webhook, persistence, daily-report, typecheck and complete build, pushes a remote backup branch, then pushes the V10 release to main (which triggers Vercel). No API keys are copied.

## Required external live checks, not certified by this code release
1. Vercel production deployment must show Ready. The `/api/health` endpoint should return `release: v10`.
2. Stripe: ensure Cash App Pay is offered, and a provider-confirmed payment arrives at `/api/stripe/webhook` with a valid `STRIPE_WEBHOOK_SECRET`.
3. PayPal: ensure Live Client ID/Secret, PayPal v6 eligibility, capture, webhook subscription, and `PAYPAL_WEBHOOK_ID` are configured.
4. Resend: verify the sender domain and production email delivery to `flexsupportservicesllc@gmail.com`.
5. Supabase: correct the exact client project API hostname and verify durable records; before this, daily-report totals are unavailable/incomplete. Vercel returns 'fetch failed' for inaccessible Supabase endpoints.
6. Venmo is a personal handle; verify the account's terms permit the intended commercial usage. Manual Zelle/Venmo transfers require recipient-side confirmation. Clicking Continue is never proof of payment.

A successful Next.js build does not prove live charges or emails work. Never infer merchant settlement from Stripe's Checkout Session HTTP 200 alone.
