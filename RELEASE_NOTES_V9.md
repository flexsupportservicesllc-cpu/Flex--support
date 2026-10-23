# Flexsupport Services V9 — Manual payment handoff correction

## Corrected
- The Venmo instructions now include an **Open Venmo profile** link and a fallback for users whose device cannot resolve the profile link. No payment is sent automatically. The personal handle remains @rasika-Wick.
- The Zelle instructions now include an explicit copy-recipient action and bank-app payment steps. Receiving phone number remains 229-546-7045.
- The UI clearly indicates that manual transfers are **pending verification**, not complete.
- These changes do not affect Stripe or PayPal routes, webhooks, database schema, or environment variables.

## Important limitations
- Venmo personal-account transfers for services may be subject to Venmo's restrictions; this code does not claim personal Venmo is an eligible merchant checkout. The displayed URL has not been independently confirmed to resolve to the recipient profile. Confirm the handle in Venmo itself before public launch.
- Zelle has no universal checkout redirect and must be completed in the payer's banking app.
- Database-independent manual instructions are not proof that transfers were received. PayPal, Stripe, webhooks, and emails need real-account verification.
- Database reporting remains unavailable when the Supabase endpoint is unreachable.
- This package is **not deployed**.
