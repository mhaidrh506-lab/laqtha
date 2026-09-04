// Vercel Serverless Function
// Sends a plain-text email via Resend's API. Used for two purposes:
// 1) Notifying the site owner when a new support ticket is submitted.
// 2) Sending the owner's reply to a customer's email address.
// Requires a RESEND_API_KEY environment variable configured in the Vercel project.

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'الطريقة غير مدعومة' });
    return;
  }

  let body = req.body;
  if (!body || typeof body === 'string') {
    try { body = JSON.parse(body || '{}'); } catch (e) { body = {}; }
  }

  const { to, subject, message } = body || {};
  if (!to || !subject || !message) {
    res.status(400).json({ error: 'الحقول (to, subject, message) مطلوبة' });
    return;
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    res.status(500).json({ error: 'لم يتم إعداد مفتاح البريد (RESEND_API_KEY) على الخادم بعد' });
    return;
  }

  try {
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + RESEND_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'لقطها <onboarding@resend.dev>',
        to: [to],
        subject: subject,
        text: message,
      }),
    });

    const data = await resendResponse.json();

    if (!resendResponse.ok) {
      res.status(500).json({ error: (data && data.message) || 'فشل إرسال البريد' });
      return;
    }

    res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    res.status(500).json({ error: String((err && err.message) || err) });
  }
};
