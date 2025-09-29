// api/paymongo-webhook.js
const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  // Get raw body (important for signature verification)
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString();

  const header = req.headers['paymongo-signature'] || req.headers['paymongo_signature'];
  if (!header) {
    return res.status(400).json({ error: 'Missing Paymongo-Signature header' });
  }

  // header example: t=TIMESTAMP,te=TEST_SIG,li=LIVE_SIG
  const parts = header.split(',');
  const tPart = parts.find(p => p.startsWith('t='));
  const sigTestPart = parts.find(p => p.startsWith('te=')); // test mode signature
  const sigLivePart = parts.find(p => p.startsWith('li=')); // live mode signature

  const timestamp = tPart && tPart.split('=')[1];
  const sigToCheck = sigTestPart ? sigTestPart.split('=')[1] : (sigLivePart ? sigLivePart.split('=')[1] : null);

  if (!timestamp || !sigToCheck) return res.status(400).json({ error: 'Invalid signature header format' });

  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!webhookSecret) return res.status(500).json({ error: 'Missing PAYMONGO_WEBHOOK_SECRET env var' });

  const computed = crypto.createHmac('sha256', webhookSecret).update(`${timestamp}.${rawBody}`).digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(sigToCheck, 'hex'))) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // parse payload & handle events
  const payload = JSON.parse(rawBody);
  // Example: react to checkout_session.payment.paid
  const eventType = payload?.data?.attributes?.type;
  console.log('PayMongo webhook event:', eventType);

  // TODO: update your database / mark order as paid

  return res.status(200).json({ status: 'received' });
};
