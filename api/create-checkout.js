// api/create-checkout.js
// Vercel Serverless (Node) function
module.exports = async (req, res) => {
  // simple CORS handling — replace '*' with your Firebase domain if you want tighter security
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    // expected body: { items: [{ name, amount, quantity }], success_url, cancel_url, description }
    const body = req.body || {};
    const items = body.items || [{
      name: 'Sample item',
      amount: 10000, // centavos => ₱100.00
      quantity: 1
    }];

    // Build PayMongo line_items format (amount in centavos)
    const line_items = items.map(it => ({
      name: it.name,
      description: it.description || '',
      images: it.images || [],
      amount: it.amount, // must be integer in centavos
      currency: (it.currency || 'PHP'),
      quantity: it.quantity || 1
    }));

    const payload = {
      data: {
        attributes: {
          description: body.description || 'Order from Firebase site',
          line_items,
          // only include allowed payment types for your account; use ['gcash','card'] if enabled
          payment_method_types: body.payment_method_types || ['gcash','card'],
          success_url: body.success_url || 'https://your-firebase-site.web.app/success.html',
          cancel_url: body.cancel_url || 'https://your-firebase-site.web.app/cancel.html',
          // optional: send merchant-defined metadata
          metadata: body.metadata || {}
        }
      }
    };

    const secret = process.env.PAYMONGO_SECRET; // set this in Vercel
    if (!secret) return res.status(500).json({ error: 'Missing PAYMONGO_SECRET env var' });

    const auth = 'Basic ' + Buffer.from(`${secret}:`).toString('base64');

    // Call PayMongo Checkout Sessions API
    const r = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': auth
      },
      body: JSON.stringify(payload)
    });

    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
