// Vercel Serverless Function
// Fetches a product page server-side (avoids browser CORS restrictions) and
// pulls out the title, image, and price from its Open Graph / meta tags,
// so the admin panel can pre-fill a new product from just a URL.

function extractMeta(html, names) {
  for (const name of names) {
    const patterns = [
      new RegExp('<meta[^>]+property=["\']' + name + '["\'][^>]+content=["\']([^"\']+)["\']', 'i'),
      new RegExp('<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']' + name + '["\']', 'i'),
      new RegExp('<meta[^>]+name=["\']' + name + '["\'][^>]+content=["\']([^"\']+)["\']', 'i'),
      new RegExp('<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']' + name + '["\']', 'i'),
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m && m[1]) return decodeHTMLEntities(m[1]);
    }
  }
  return null;
}

function decodeHTMLEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function guessPrice(html) {
  const patterns = [
    /(?:ر\.?س|ريال|SAR)\s?([0-9]+(?:[.,][0-9]{1,2})?)/i,
    /([0-9]+(?:[.,][0-9]{1,2})?)\s?(?:ر\.?س|ريال|SAR)/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return m[1].replace(',', '.');
  }
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const targetUrl = req.query.url;
  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    res.status(400).json({ error: 'رابط غير صالح' });
    return;
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept-Language': 'ar,en;q=0.8',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      res.status(200).json({
        title: null,
        image: null,
        price: null,
        warning: 'الموقع رفض الطلب (رمز ' + response.status + '). جرّب أمازون خصوصًا يحظر هذا النوع من الطلبات غالبًا.',
      });
      return;
    }

    const html = await response.text();

    const title = extractMeta(html, ['og:title', 'twitter:title']);
    const image = extractMeta(html, ['og:image', 'twitter:image', 'twitter:image:src']);
    const price =
      extractMeta(html, ['product:price:amount', 'og:price:amount']) || guessPrice(html);

    res.status(200).json({ title, image, price });
  } catch (err) {
    res.status(200).json({
      title: null,
      image: null,
      price: null,
      warning: 'تعذر الوصول للرابط: ' + String(err.message || err),
    });
  }
}
