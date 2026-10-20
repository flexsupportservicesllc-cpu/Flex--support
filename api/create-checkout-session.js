// Mandi — Stripe Cash App Pay checkout (Vercel serverless function)
const Stripe = require('stripe');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe is not configured on the server yet.' });
  }
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    let body = req.body;
    if (!body || typeof body === 'string') {
      try { body = JSON.parse(body || '{}'); } catch { body = {}; }
    }
    const { amount, name, note } = body;

    const cents = Math.round(parseFloat(amount) * 100);
    if (!cents || isNaN(cents) || cents < 100) {
      return res.status(400).json({ error: 'Invalid amount (minimum $1.00).' });
    }
    if (cents > 100000000) {
      return res.status(400).json({ error: 'Amount is too large.' });
    }

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['cashapp'],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: cents,
          product_data: { name: note ? ('Mandi payment — ' + String(note).slice(0, 120)) : 'Mandi payment' },
        },
      }],
      metadata: {
        payer: (name || '').slice(0, 120),
        note: (note || '').slice(0, 200),
      },
      success_url: `${origin}/?paid=cashapp`,
      cancel_url: `${origin}/?canceled=1`,
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Checkout failed' });
  }
};
