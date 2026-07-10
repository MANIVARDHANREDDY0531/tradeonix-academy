const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = __dirname;
const bundledDataDir = path.join(root, 'data');

loadEnv();

const configuredDataDir = (process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || '').trim();
const dataDir = configuredDataDir ? path.resolve(configuredDataDir) : bundledDataDir;
const requestLog = path.join(dataDir, 'purchase-requests.jsonl');
const usersPath = path.join(dataDir, 'users.json');
const sessionsPath = path.join(dataDir, 'sessions.json');
const journalsPath = path.join(dataDir, 'journal-entries.json');
const otpStorePath = path.join(dataDir, 'auth-otps.json');
const clientsPath = path.join(dataDir, 'clients.json');
const usdtOrdersPath = path.join(dataDir, 'usdt-orders.json');
const storageProbePath = path.join(dataDir, 'storage-health.json');
const couponsPath = path.join(root, 'coupons.json');
const port = Number(process.env.PORT || 8766);

seedPersistentDataDir();

const razorpayKeyId = process.env.RAZORPAY_KEY_ID || '';
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || '';
const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
const marketCache = new Map();
const marketNewsCache = new Map();
const siteName = process.env.SITE_NAME || 'TRADEONIX ACADEMY';
const adminEmail = process.env.ADMIN_EMAIL || '';
const adminWhatsappNumber = process.env.ADMIN_WHATSAPP_NUMBER || '';
const notificationFromEmail = process.env.NOTIFICATION_FROM_EMAIL || '';
const resendApiKey = process.env.RESEND_API_KEY || '';
const whatsappCloudToken = process.env.WHATSAPP_CLOUD_TOKEN || '';
const whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const adminUsername = process.env.ADMIN_USERNAME || '';
const adminPassword = process.env.ADMIN_PASSWORD || '';
const adminAccessKey = process.env.ADMIN_ACCESS_KEY || 'SVMJM5';
const otpSecret = process.env.OTP_SECRET || razorpayKeySecret || process.env.SESSION_SECRET || 'tradeonix-local-otp-secret';

const plans = {
  'beginner-3-month': {
    name: 'Complete Beginner Trader Blueprint - 3 Month Access',
    price: 8999,
    checkoutUrl: process.env.PAYMENT_BEGINNER_3_MONTH || ''
  },
  'beginner-6-month': {
    name: 'Complete Beginner Trader Blueprint - 6 Month Access',
    price: 13999,
    checkoutUrl: process.env.PAYMENT_BEGINNER_6_MONTH || ''
  },
  'trading-masterclass': {
    name: 'Trading MasterClass - 3 Month Validity',
    price: 24999,
    checkoutUrl: process.env.PAYMENT_TRADING_MASTERCLASS || ''
  },
  consultation: {
    name: 'Course Selection Consultation',
    price: 0,
    checkoutUrl: process.env.PAYMENT_CONSULTATION || ''
  }
};

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

const marketFeeds = {
  nifty: { symbol: '^NSEI', yahooSymbols: ['^NSEI'], googleSymbol: 'NIFTY_50:INDEXNSE', decimals: 2, alwaysOpen: false, fallbackPrice: 25112.40, fallbackChange: 0.42 },
  banknifty: { symbol: '^NSEBANK', yahooSymbols: ['^NSEBANK'], googleSymbol: 'NIFTY_BANK:INDEXNSE', decimals: 2, alwaysOpen: false, fallbackPrice: 56825.20, fallbackChange: 0.36 },
  gold: { symbol: 'XAUUSD=X', yahooSymbols: ['XAUUSD=X', 'GC=F'], stooqSymbol: 'xauusd', decimals: 2, alwaysOpen: false, fallbackPrice: 4191.50, fallbackChange: 0.18 },
  bitcoin: { symbol: 'BTC-USD', yahooSymbols: ['BTC-USD'], binanceSymbol: 'BTCUSDT', coingeckoId: 'bitcoin', decimals: 2, alwaysOpen: true, fallbackPrice: 104250.00, fallbackChange: -0.31 }
};

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(payload));
}

function getRequestPath(request) {
  try {
    return new URL(request.url, 'http://localhost').pathname;
  } catch (error) {
    return request.url.split('?')[0];
  }
}

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function isAdminRequest(request) {
  const requestPath = getRequestPath(request);
  return requestPath.startsWith('/api/purchase-requests') && request.method !== 'POST';
}

function isAdminAuthorized(request) {
  if (!adminUsername || !adminPassword) return false;
  const authorization = request.headers.authorization || '';
  if (!authorization.startsWith('Basic ')) return false;

  try {
    const decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator === -1) return false;
    const username = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);
    return safeCompare(username, adminUsername) && safeCompare(password, adminPassword);
  } catch (error) {
    return false;
  }
}

function requestAdminLogin(response) {
  response.writeHead(401, {
    'Cache-Control': 'no-store',
    'Content-Type': 'text/plain; charset=utf-8',
    'WWW-Authenticate': 'Basic realm="TRADEONIX Admin", charset="UTF-8"'
  });
  response.end('Admin login required.');
}

function getJson(hostname, requestPath) {
  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname,
      path: requestPath,
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 TradeonixAcademy/1.0'
      }
    }, (apiResponse) => {
      let body = '';
      apiResponse.on('data', (chunk) => {
        body += chunk;
      });
      apiResponse.on('end', () => {
        if (apiResponse.statusCode < 200 || apiResponse.statusCode >= 300) {
          reject(new Error(`Market data returned ${apiResponse.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(body || '{}'));
        } catch (error) {
          reject(new Error('Invalid market data response'));
        }
      });
    });
    request.setTimeout(7000, () => {
      request.destroy(new Error('Market data request timed out'));
    });
    request.on('error', reject);
    request.end();
  });
}

function getText(hostname, requestPath) {
  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname,
      path: requestPath,
      method: 'GET',
      headers: {
        Accept: 'application/rss+xml,text/xml,text/plain',
        'User-Agent': 'Mozilla/5.0 TradeonixAcademy/1.0'
      }
    }, (apiResponse) => {
      let body = '';
      apiResponse.on('data', (chunk) => {
        body += chunk;
      });
      apiResponse.on('end', () => {
        if (apiResponse.statusCode < 200 || apiResponse.statusCode >= 300) {
          reject(new Error(`News feed returned ${apiResponse.statusCode}`));
          return;
        }
        resolve(body);
      });
    });
    request.setTimeout(8000, () => {
      request.destroy(new Error('News feed request timed out'));
    });
    request.on('error', reject);
    request.end();
  });
}

function postJson(hostname, requestPath, headers, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const request = https.request({
      hostname,
      path: requestPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers
      }
    }, (apiResponse) => {
      let responseBody = '';
      apiResponse.on('data', (chunk) => {
        responseBody += chunk;
      });
      apiResponse.on('end', () => {
        let parsed = {};
        try {
          parsed = JSON.parse(responseBody || '{}');
        } catch (error) {
          parsed = { raw: responseBody };
        }
        if (apiResponse.statusCode < 200 || apiResponse.statusCode >= 300) {
          reject(new Error(parsed.message || parsed.error?.message || parsed.error || `Notification failed with ${apiResponse.statusCode}`));
          return;
        }
        resolve(parsed);
      });
    });
    request.setTimeout(8000, () => {
      request.destroy(new Error('Notification request timed out'));
    });
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

function formatCurrency(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`;
}

function normalizeWhatsappNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

async function sendEmail(to, subject, text) {
  if (!resendApiKey || !notificationFromEmail || !to) return false;
  await postJson('api.resend.com', '/emails', {
    Authorization: `Bearer ${resendApiKey}`
  }, {
    from: notificationFromEmail,
    to: [to],
    subject,
    text
  });
  return true;
}

async function sendWhatsappText(to, text) {
  const phone = normalizeWhatsappNumber(to);
  if (!whatsappCloudToken || !whatsappPhoneNumberId || !phone) return;
  await postJson('graph.facebook.com', `/v20.0/${whatsappPhoneNumberId}/messages`, {
    Authorization: `Bearer ${whatsappCloudToken}`
  }, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'text',
    text: {
      preview_url: false,
      body: text
    }
  });
}

function runNotification(label, task) {
  Promise.resolve()
    .then(task)
    .catch((error) => {
      console.warn(`${label} notification failed: ${error.message}`);
    });
}

function buildAdminMessage(title, record) {
  return [
    `${title}`,
    `Reference: ${record.referenceId}`,
    `Name: ${record.customer?.name || '-'}`,
    `Phone: ${record.customer?.phone || '-'}`,
    `Email: ${record.customer?.email || '-'}`,
    `Plan: ${record.planName || record.planId || '-'}`,
    record.coupon?.code ? `Coupon: ${record.coupon.code} (${formatCurrency(record.discountAmount)} off)` : '',
    `Amount: ${formatCurrency(record.finalPlanPrice ?? record.planPrice)}`,
    `Payment status: ${record.paymentStatus || '-'}`,
    record.razorpayPaymentId ? `Razorpay payment: ${record.razorpayPaymentId}` : '',
    record.message ? `Message: ${record.message}` : ''
  ].filter(Boolean).join('\n');
}

function buildUserRequestMessage(record) {
  return [
    `Hi ${record.customer?.name || 'there'},`,
    `We received your ${siteName} enrollment request.`,
    `Reference: ${record.referenceId}`,
    `Plan: ${record.planName}`,
    record.coupon?.code ? `Coupon applied: ${record.coupon.code}` : '',
    `Amount: ${formatCurrency(record.finalPlanPrice ?? record.planPrice)}`,
    `Our team will contact you shortly.`
  ].filter(Boolean).join('\n');
}

function buildUserPaymentMessage(record) {
  return [
    `Hi ${record.customer?.name || 'there'},`,
    `Your payment for ${siteName} was successful.`,
    `Reference: ${record.referenceId}`,
    `Plan: ${record.planName}`,
    record.coupon?.code ? `Coupon applied: ${record.coupon.code}` : '',
    `Amount: ${formatCurrency(record.finalPlanPrice ?? record.planPrice)}`,
    `Thank you for enrolling.`
  ].filter(Boolean).join('\n');
}

function notifyNewRequest(record) {
  runNotification('Admin email new request', () => sendEmail(adminEmail, `New enrollment request - ${record.referenceId}`, buildAdminMessage('New enrollment request', record)));
  runNotification('Admin WhatsApp new request', () => sendWhatsappText(adminWhatsappNumber, buildAdminMessage('New enrollment request', record)));
  runNotification('User email request confirmation', () => sendEmail(record.customer?.email, `${siteName} request received`, buildUserRequestMessage(record)));
  runNotification('User WhatsApp request confirmation', () => sendWhatsappText(record.customer?.phone, buildUserRequestMessage(record)));
}

function notifyOrderCreated(record) {
  runNotification('Admin email order created', () => sendEmail(adminEmail, `Razorpay order created - ${record.referenceId}`, buildAdminMessage('Razorpay order created', record)));
  runNotification('Admin WhatsApp order created', () => sendWhatsappText(adminWhatsappNumber, buildAdminMessage('Razorpay order created', record)));
}

function notifyPaymentSuccess(record) {
  runNotification('Admin email payment success', () => sendEmail(adminEmail, `Payment received - ${record.referenceId}`, buildAdminMessage('Payment received', record)));
  runNotification('Admin WhatsApp payment success', () => sendWhatsappText(adminWhatsappNumber, buildAdminMessage('Payment received', record)));
  runNotification('User email payment confirmation', () => sendEmail(record.customer?.email, `${siteName} payment successful`, buildUserPaymentMessage(record)));
  runNotification('User WhatsApp payment confirmation', () => sendWhatsappText(record.customer?.phone, buildUserPaymentMessage(record)));
}

async function fetchMarketData(market) {
  const feed = marketFeeds[market];
  if (!feed) throw new Error('Unknown market');

  const cached = marketCache.get(market);
  if (cached && Date.now() - cached.createdAt < 45_000) return cached.payload;

  const attempts = [];
  if (feed.binanceSymbol) attempts.push(() => fetchBinanceTicker(feed));
  for (const symbol of feed.yahooSymbols || [feed.symbol]) {
    attempts.push(() => fetchYahooChart(feed, symbol));
  }
  for (const symbol of feed.yahooSymbols || [feed.symbol]) {
    attempts.push(() => fetchYahooQuote(feed, symbol));
  }
  if (feed.coingeckoId) attempts.push(() => fetchCoingeckoPrice(feed));
  if (feed.stooqSymbol) attempts.push(() => fetchStooqPrice(feed));
  if (feed.googleSymbol) attempts.push(() => fetchGoogleFinancePrice(feed));

  try {
    const payload = await Promise.any(attempts.map((attempt) => attempt()));
    marketCache.set(market, { createdAt: Date.now(), payload });
    return payload;
  } catch (error) {
    // Fall back only after every live source fails.
  }

  const fallback = buildMarketPayload(feed, feed.fallbackPrice, feed.fallbackChange, makeServerSparkline(feed.fallbackPrice, feed.fallbackChange), {
    lastPrice: true,
    marketState: 'FALLBACK',
    source: 'Fallback',
    stale: true
  });
  marketCache.set(market, { createdAt: Date.now(), payload: fallback });
  return fallback;
}

async function fetchYahooChart(feed, symbolValue) {
  const symbol = encodeURIComponent(symbolValue);
  const yahooPath = `/v8/finance/chart/${symbol}?interval=5m&range=1d`;
  const data = await getJson('query1.finance.yahoo.com', yahooPath);
  const result = data.chart?.result?.[0];
  if (!result) throw new Error('Market chart is unavailable');

  const meta = result.meta || {};
  const closePrices = result.indicators?.quote?.[0]?.close || [];
  const prices = closePrices.filter(Number.isFinite);
  const previous = Number(meta.chartPreviousClose || meta.previousClose || prices.at(0));
  const price = Number(meta.regularMarketPrice || prices.at(-1) || previous);
  if (!Number.isFinite(price)) throw new Error('Market price is unavailable');

  const change = Number.isFinite(previous) && previous ? ((price - previous) / previous) * 100 : null;
  const isClosed = !feed.alwaysOpen && meta.marketState && !['REGULAR', 'PRE', 'POST'].includes(meta.marketState);
  return buildMarketPayload(feed, price, change, prices.length > 1 ? prices : makeServerSparkline(price, change), {
    lastPrice: Boolean(isClosed),
    marketState: meta.marketState || 'UNKNOWN',
    source: 'Yahoo'
  });
}

async function fetchYahooQuote(feed, symbolValue) {
  const symbol = encodeURIComponent(symbolValue);
  const data = await getJson('query1.finance.yahoo.com', `/v7/finance/quote?symbols=${symbol}`);
  const quote = data.quoteResponse?.result?.[0];
  const price = Number(quote?.regularMarketPrice);
  if (!Number.isFinite(price)) throw new Error('Yahoo quote unavailable');
  const previous = Number(quote.regularMarketPreviousClose);
  const change = Number.isFinite(quote.regularMarketChangePercent)
    ? Number(quote.regularMarketChangePercent)
    : Number.isFinite(previous) && previous ? ((price - previous) / previous) * 100 : null;
  const marketState = quote.marketState || 'UNKNOWN';
  const isClosed = !feed.alwaysOpen && marketState && !['REGULAR', 'PRE', 'POST'].includes(marketState);
  return buildMarketPayload(feed, price, change, makeServerSparkline(price, change), {
    lastPrice: Boolean(isClosed),
    marketState,
    source: 'Yahoo'
  });
}

async function fetchCoingeckoPrice(feed) {
  const data = await getJson('api.coingecko.com', `/api/v3/simple/price?ids=${feed.coingeckoId}&vs_currencies=usd&include_24hr_change=true`);
  const quote = data[feed.coingeckoId];
  const price = Number(quote?.usd);
  if (!Number.isFinite(price)) throw new Error('CoinGecko quote unavailable');
  const change = Number(quote.usd_24h_change);
  return buildMarketPayload(feed, price, change, makeServerSparkline(price, change), {
    marketState: 'REGULAR',
    source: 'CoinGecko'
  });
}

async function fetchBinanceTicker(feed) {
  const data = await getJson('api.binance.com', `/api/v3/ticker/24hr?symbol=${encodeURIComponent(feed.binanceSymbol)}`);
  const price = Number(data.lastPrice);
  if (!Number.isFinite(price)) throw new Error('Binance quote unavailable');
  const change = Number(data.priceChangePercent);
  return buildMarketPayload(feed, price, change, makeServerSparkline(price, change), {
    marketState: 'REGULAR',
    source: 'Binance'
  });
}

async function fetchStooqPrice(feed) {
  const csv = await getText('stooq.com', `/q/l/?s=${encodeURIComponent(feed.stooqSymbol)}&f=sd2t2ohlcv&h&e=csv`);
  const [, row = ''] = csv.trim().split(/\r?\n/);
  const parts = row.split(',');
  const close = Number(parts[6]);
  const open = Number(parts[3]);
  if (!Number.isFinite(close)) throw new Error('Stooq quote unavailable');
  const change = Number.isFinite(open) && open ? ((close - open) / open) * 100 : null;
  return buildMarketPayload(feed, close, change, makeServerSparkline(close, change), {
    marketState: 'REGULAR',
    source: 'Stooq'
  });
}

async function fetchGoogleFinancePrice(feed) {
  const html = await getText('www.google.com', `/finance/quote/${encodeURIComponent(feed.googleSymbol)}?hl=en`);
  const priceMatch = html.match(/class="YMlKec fxKbKc">([^<]+)</);
  if (!priceMatch) throw new Error('Google Finance quote unavailable');
  const price = Number(priceMatch[1].replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(price)) throw new Error('Google Finance price unavailable');
  const percentMatch = html.match(/([-+]?\d+(?:\.\d+)?)%/);
  const change = percentMatch ? Number(percentMatch[1]) : null;
  return buildMarketPayload(feed, price, change, makeServerSparkline(price, change), {
    lastPrice: true,
    marketState: 'LAST',
    source: 'Google Finance'
  });
}

function buildMarketPayload(feed, price, change, prices, extra = {}) {
  return {
    price,
    change: Number.isFinite(change) ? change : null,
    prices: Array.isArray(prices) && prices.length > 1 ? prices : makeServerSparkline(price, change),
    decimals: feed.decimals,
    lastPrice: Boolean(extra.lastPrice),
    marketState: extra.marketState || 'UNKNOWN',
    source: extra.source || 'Market',
    stale: Boolean(extra.stale)
  };
}

function makeServerSparkline(price, change = 0) {
  const start = price / (1 + (Number(change) || 0) / 100);
  return Array.from({ length: 24 }, (_, i) => start + (price - start) * (i / 23));
}

async function handleMarketData(request, response) {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const market = clean(url.searchParams.get('market')).toLowerCase();
    sendJson(response, 200, await fetchMarketData(market));
  } catch (error) {
    sendJson(response, 502, { error: 'Could not load market data.' });
  }
}

function decodeXml(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function readRssTag(item, tag) {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return decodeXml(match?.[1] || '');
}

function parseNewsItems(xml, category, defaultSource = 'Market news') {
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)]
    .slice(0, 8)
    .map((match) => {
      const item = match[1];
      return {
        category,
        title: readRssTag(item, 'title'),
        source: readRssTag(item, 'source') || defaultSource,
        url: readRssTag(item, 'link'),
        publishedAt: readRssTag(item, 'pubDate')
      };
    })
    .filter((item) => item.title && item.url);
}

async function fetchMoneycontrolFeed(category, feedPath) {
  const xml = await getText('www.moneycontrol.com', feedPath);
  return parseNewsItems(xml, category, 'Moneycontrol');
}

async function fetchGoogleNewsFeed(category, query) {
  const rssPath = `/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
  const xml = await getText('news.google.com', rssPath);
  return parseNewsItems(xml, category, 'Google News');
}

function uniqueNewsItems(items) {
  const seen = new Set();
  return items
    .filter((item) => item.title && item.url)
    .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
    .filter((item) => {
    const key = String(item.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function fallbackMarketNews() {
  const now = new Date().toISOString();
  return [
    {
      category: 'India',
      title: 'Nifty 50, Bank Nifty, rupee, crude, and FII/DII flows remain key Indian market watchpoints.',
      source: 'TRADEONIX market brief',
      url: '#courses',
      publishedAt: now
    },
    {
      category: 'India',
      title: 'Indian traders are watching RBI cues, quarterly earnings, and sector rotation for near-term direction.',
      source: 'TRADEONIX market brief',
      url: '#courses',
      publishedAt: now
    },
    {
      category: 'Crypto',
      title: 'Crypto traders are watching Bitcoin, Ethereum, ETF flows, liquidity, and risk sentiment.',
      source: 'TRADEONIX market brief',
      url: '#courses',
      publishedAt: now
    },
    {
      category: 'Forex',
      title: 'Forex markets are tracking USD/INR, dollar index, yields, crude oil, and central-bank guidance.',
      source: 'TRADEONIX market brief',
      url: '#courses',
      publishedAt: now
    },
    {
      category: 'Global',
      title: 'Crypto and precious metals remain sensitive to liquidity, risk sentiment, and macro data releases.',
      source: 'TRADEONIX market brief',
      url: '#courses',
      publishedAt: now
    }
  ];
}

async function fetchMarketNews() {
  const cached = marketNewsCache.get('latest');
  if (cached && Date.now() - cached.createdAt < 600_000) return cached.payload;

  try {
    const feeds = await Promise.allSettled([
      fetchMoneycontrolFeed('India', '/rss/latestnews.xml'),
      fetchMoneycontrolFeed('India', '/rss/business.xml'),
      fetchMoneycontrolFeed('India', '/rss/marketreports.xml'),
      fetchMoneycontrolFeed('Global', '/rss/worldnews.xml'),
      fetchGoogleNewsFeed('India', 'Nifty OR Sensex OR Bank Nifty OR NSE OR BSE Indian stock market'),
      fetchGoogleNewsFeed('Crypto', 'Bitcoin OR Ethereum OR crypto market OR cryptocurrency regulation OR crypto ETF'),
      fetchGoogleNewsFeed('Forex', 'forex market OR USD INR OR dollar index OR currency market OR rupee'),
      fetchGoogleNewsFeed('Global', 'global stock markets OR US markets OR gold OR crude oil OR bond yields')
    ]);
    const items = uniqueNewsItems(feeds.flatMap((result) => result.status === 'fulfilled' ? result.value : [])).slice(0, 24);
    if (!items.length) throw new Error('No news items');
    const payload = { updatedAt: new Date().toISOString(), source: 'Moneycontrol + global market feeds', items };
    marketNewsCache.set('latest', { createdAt: Date.now(), payload });
    return payload;
  } catch (error) {
    return { updatedAt: new Date().toISOString(), items: fallbackMarketNews(), fallback: true };
  }
}

async function handleMarketNews(request, response) {
  sendJson(response, 200, await fetchMarketNews());
}

function handleValidateCoupon(request, response) {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const planId = clean(url.searchParams.get('planId'));
    const couponCode = clean(url.searchParams.get('couponCode'));
    const pricing = calculatePlanPricing(planId, couponCode);
    sendJson(response, 200, {
      ok: true,
      originalAmount: pricing.originalPaise,
      discountAmount: pricing.discountPaise,
      payableAmount: pricing.payablePaise,
      coupon: pricing.coupon
    });
  } catch (error) {
    sendJson(response, error.statusCode || 400, { error: error.message || 'Could not apply coupon.' });
  }
}

function loadEnv() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const separator = trimmed.indexOf('=');
      if (separator === -1) return;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    });
}

function seedPersistentDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (path.resolve(dataDir) === path.resolve(bundledDataDir)) return;
  if (!fs.existsSync(bundledDataDir)) return;

  [
    'purchase-requests.jsonl',
    'users.json',
    'sessions.json',
    'journal-entries.json',
    'auth-otps.json',
    'clients.json',
    'usdt-orders.json'
  ].forEach((fileName) => {
    const sourcePath = path.join(bundledDataDir, fileName);
    const targetPath = path.join(dataDir, fileName);
    if (!fs.existsSync(sourcePath) || fs.existsSync(targetPath)) return;
    fs.copyFileSync(sourcePath, targetPath);
  });
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10_000_000) {
        request.destroy();
        reject(new Error('Request is too large'));
      }
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function clean(value) {
  return String(value || '').trim();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value) {
  return /^[0-9+\-\s()]{7,20}$/.test(value);
}

function normalizeCouponCode(value) {
  return clean(value).toUpperCase().replace(/\s+/g, '');
}

function readCoupons() {
  if (!fs.existsSync(couponsPath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(couponsPath, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function calculatePlanPricing(planId, couponCode) {
  const plan = plans[planId];
  if (!plan) throw { statusCode: 400, message: 'Please choose a valid plan.' };

  const originalPaise = Math.round(Number(plan.price || 0) * 100);
  const code = normalizeCouponCode(couponCode);
  if (!code || !originalPaise) {
    return {
      originalPaise,
      discountPaise: 0,
      payablePaise: originalPaise,
      coupon: null
    };
  }

  const coupon = readCoupons().find((item) => normalizeCouponCode(item.code) === code);
  if (!coupon || coupon.active !== true) {
    throw { statusCode: 400, message: 'This coupon code is not valid.' };
  }

  const allowedPlans = Array.isArray(coupon.planIds) ? coupon.planIds : [];
  if (allowedPlans.length && !allowedPlans.includes(planId)) {
    throw { statusCode: 400, message: 'This coupon is not available for this plan.' };
  }

  const type = clean(coupon.type).toLowerCase();
  const value = Number(coupon.value || 0);
  if (!Number.isFinite(value) || value <= 0) {
    throw { statusCode: 400, message: 'This coupon code is not valid.' };
  }

  let discountPaise = 0;
  if (type === 'percent') {
    discountPaise = Math.round(originalPaise * Math.min(value, 100) / 100);
  } else if (type === 'fixed') {
    discountPaise = Math.round(value * 100);
  } else {
    throw { statusCode: 400, message: 'This coupon code is not valid.' };
  }

  discountPaise = Math.min(discountPaise, Math.max(0, originalPaise - 100));
  const payablePaise = Math.max(100, originalPaise - discountPaise);

  return {
    originalPaise,
    discountPaise,
    payablePaise,
    coupon: {
      code,
      type,
      value,
      description: clean(coupon.description)
    }
  };
}

function readPurchaseRequests() {
  if (!fs.existsSync(requestLog)) return [];
  return fs.readFileSync(requestLog, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean)
    .reverse();
}

function writePurchaseRequests(requests) {
  fs.mkdirSync(dataDir, { recursive: true });
  const lines = requests.map((item) => JSON.stringify(item)).join('\n');
  fs.writeFileSync(requestLog, lines ? `${lines}\n` : '', 'utf8');
}

function readJsonStore(filePath, fallback = []) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeJsonStore(filePath, records) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf8');
}

function fileSummary(filePath) {
  if (!fs.existsSync(filePath)) return { exists: false, bytes: 0, updatedAt: '' };
  const stats = fs.statSync(filePath);
  return {
    exists: true,
    bytes: stats.size,
    updatedAt: stats.mtime.toISOString()
  };
}

function getStorageStatus() {
  const isPersistent = path.resolve(dataDir) !== path.resolve(bundledDataDir);
  const probe = readJsonStore(storageProbePath, [])[0] || null;
  return {
    ok: isPersistent,
    mode: isPersistent ? 'persistent' : 'upload-folder',
    configured: Boolean(configuredDataDir),
    dataDir,
    configuredDataDir,
    railwayVolumeVariableFound: Boolean(process.env.RAILWAY_VOLUME_MOUNT_PATH),
    message: isPersistent
      ? 'Database is using persistent storage.'
      : 'Database is using the uploaded website folder. Add DATA_DIR=/data and a Railway volume before storing real data.',
    counts: {
      clients: readJsonStore(clientsPath).length,
      usdtOrders: readJsonStore(usdtOrdersPath).length,
      purchaseRequests: readPurchaseRequests().length,
      users: readJsonStore(usersPath).length,
      journalEntries: readJsonStore(journalsPath).length
    },
    writeTest: probe,
    files: {
      clients: fileSummary(clientsPath),
      usdtOrders: fileSummary(usdtOrdersPath),
      purchaseRequests: fileSummary(requestLog),
      users: fileSummary(usersPath),
      journalEntries: fileSummary(journalsPath),
      writeTest: fileSummary(storageProbePath)
    }
  };
}

function handleAdminStorage(request, response) {
  if (!requireAdminKey(request, response)) return;
  sendJson(response, 200, getStorageStatus());
}

function handleAdminStorageTest(request, response) {
  if (!requireAdminKey(request, response)) return;
  const previous = readJsonStore(storageProbePath, [])[0] || {};
  const next = {
    testId: `STORAGE-${Date.now().toString(36).toUpperCase()}`,
    writes: Number(previous.writes || 0) + 1,
    lastWrittenAt: new Date().toISOString()
  };
  writeJsonStore(storageProbePath, [next]);
  sendJson(response, 200, { ok: true, writeTest: next, storage: getStorageStatus() });
}

function handleAdminExport(request, response) {
  if (!requireAdminKey(request, response)) return;
  const backup = {
    exportedAt: new Date().toISOString(),
    storage: getStorageStatus(),
    purchaseRequests: readPurchaseRequests(),
    clients: readJsonStore(clientsPath),
    usdtOrders: readJsonStore(usdtOrdersPath),
    users: readJsonStore(usersPath),
    journalEntries: readJsonStore(journalsPath)
  };
  response.writeHead(200, {
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Content-Disposition': `attachment; filename="tradeonix-admin-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(backup, null, 2));
}

function isAdminKeyRequest(request) {
  const key = clean(request.headers['x-admin-key']);
  return key && safeCompare(key, adminAccessKey);
}

function requireAdminKey(request, response) {
  if (isAdminKeyRequest(request)) return true;
  sendJson(response, 401, { error: 'Admin keyword required.' });
  return false;
}

function readClients() {
  return readJsonStore(clientsPath).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function writeClients(clients) {
  writeJsonStore(clientsPath, clients);
}

function readUsdtOrders() {
  return readJsonStore(usdtOrdersPath).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function writeUsdtOrders(orders) {
  writeJsonStore(usdtOrdersPath, orders);
}

function toNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function calculateUsdtOrder(rawOrder) {
  const explicitQuantity = toNumber(rawOrder.quantity);
  const buyPrice = toNumber(rawOrder.buyPrice);
  const sellPrice = toNumber(rawOrder.sellPrice);
  const orderSide = clean(rawOrder.orderSide) || 'client_buy_usdt';
  const inrAmount = toNumber(rawOrder.inrAmount) || explicitQuantity * (orderSide === 'client_buy_usdt' ? sellPrice : buyPrice);
  const sellerUsdtReceived = orderSide === 'client_buy_usdt' && buyPrice > 0
    ? inrAmount / buyPrice
    : 0;
  const clientUsdtDelivered = orderSide === 'client_buy_usdt' && sellPrice > 0
    ? inrAmount / sellPrice
    : explicitQuantity;
  const usdtReceivedFromClient = orderSide === 'client_sell_usdt' ? explicitQuantity : 0;
  const quantity = orderSide === 'client_buy_usdt' ? clientUsdtDelivered : explicitQuantity;
  const profitUsdt = orderSide === 'client_buy_usdt' ? sellerUsdtReceived - clientUsdtDelivered : 0;
  const estimatedProfitInr = orderSide === 'client_buy_usdt' ? profitUsdt * sellPrice : 0;
  return {
    quantity,
    buyPrice,
    sellPrice,
    inrAmount,
    sellerUsdtReceived: Number(sellerUsdtReceived.toFixed(4)),
    clientUsdtDelivered: Number(clientUsdtDelivered.toFixed(4)),
    usdtReceivedFromClient: Number(usdtReceivedFromClient.toFixed(4)),
    profitUsdt: Number(profitUsdt.toFixed(4)),
    estimatedProfitInr: Number(estimatedProfitInr.toFixed(2)),
    profit: Number(profitUsdt.toFixed(4))
  };
}

function getClientName(clientId) {
  return readJsonStore(clientsPath).find((client) => client.clientId === clientId)?.name || '';
}

function getOrderProfitUsdt(order) {
  if (order.profitUsdt !== undefined) return toNumber(order.profitUsdt);
  if (order.estimatedProfitInr !== undefined && toNumber(order.sellPrice) > 0) return toNumber(order.estimatedProfitInr) / toNumber(order.sellPrice);
  if (toNumber(order.sellPrice) > 0 && toNumber(order.profit) > 0) return toNumber(order.profit) / toNumber(order.sellPrice);
  return toNumber(order.profit);
}

function getOrderTimestamp(order) {
  if (order.transactionAt) return order.transactionAt;
  if (order.orderDate && order.orderTime) return `${order.orderDate}T${order.orderTime}:00`;
  return order.orderDate || order.createdAt;
}

function buildReports(orders) {
  const makeBucket = () => ({ buyOrders: 0, sellOrders: 0, usdtBoughtByClients: 0, usdtSoldByClients: 0, usdtPurchasedFromSellers: 0, usdtProfit: 0, revenue: 0, profit: 0, estimatedProfitInr: 0, orders: 0 });
  const monthly = {};
  const yearly = {};
  for (const order of orders) {
    const date = new Date(getOrderTimestamp(order));
    if (Number.isNaN(date.getTime())) continue;
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const yearKey = String(date.getFullYear());
    for (const bucket of [monthly[monthKey] ||= makeBucket(), yearly[yearKey] ||= makeBucket()]) {
      bucket.orders += 1;
      bucket.revenue += toNumber(order.inrAmount);
      bucket.profit += getOrderProfitUsdt(order);
      bucket.usdtProfit += getOrderProfitUsdt(order);
      bucket.estimatedProfitInr += toNumber(order.estimatedProfitInr);
      if (order.orderSide === 'client_buy_usdt') {
        bucket.buyOrders += 1;
        bucket.usdtBoughtByClients += toNumber(order.quantity);
        bucket.usdtPurchasedFromSellers += toNumber(order.sellerUsdtReceived);
      } else {
        bucket.sellOrders += 1;
        bucket.usdtSoldByClients += toNumber(order.quantity);
      }
    }
  }
  const normalize = (record) => ({
    ...record,
    revenue: Number(record.revenue.toFixed(2)),
    profit: Number(record.profit.toFixed(4)),
    usdtProfit: Number(record.usdtProfit.toFixed(4)),
    estimatedProfitInr: Number(record.estimatedProfitInr.toFixed(2)),
    usdtBoughtByClients: Number(record.usdtBoughtByClients.toFixed(4)),
    usdtSoldByClients: Number(record.usdtSoldByClients.toFixed(4)),
    usdtPurchasedFromSellers: Number(record.usdtPurchasedFromSellers.toFixed(4))
  });
  return {
    monthly: Object.entries(monthly).sort((a, b) => b[0].localeCompare(a[0])).map(([period, record]) => ({ period, ...normalize(record) })),
    yearly: Object.entries(yearly).sort((a, b) => b[0].localeCompare(a[0])).map(([period, record]) => ({ period, ...normalize(record) }))
  };
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt
  };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, expected] = String(storedHash || '').split(':');
  if (!salt || !expected) return false;
  const actual = crypto.pbkdf2Sync(String(password), salt, 120000, 32, 'sha256').toString('hex');
  return safeCompare(actual, expected);
}

function normalizePassword(value) {
  return String(value || '').trim();
}

function passwordMatches(input, storedHash) {
  const rawPassword = String(input || '');
  const trimmedPassword = normalizePassword(rawPassword);
  return verifyPassword(trimmedPassword, storedHash)
    || (rawPassword !== trimmedPassword && verifyPassword(rawPassword, storedHash));
}

function createSession(userId) {
  const sessions = readJsonStore(sessionsPath);
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date().toISOString();
  sessions.push({ token, userId, createdAt: now, lastSeenAt: now });
  writeJsonStore(sessionsPath, sessions.slice(-1000));
  return token;
}

function getBearerToken(request) {
  const header = request.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function getSessionUser(request) {
  const token = getBearerToken(request);
  if (!token) return null;
  const sessions = readJsonStore(sessionsPath);
  const session = sessions.find((item) => safeCompare(item.token, token));
  if (!session) return null;
  const user = readJsonStore(usersPath).find((item) => item.id === session.userId);
  return user ? { user, token } : null;
}

function removeSession(token) {
  const sessions = readJsonStore(sessionsPath);
  writeJsonStore(sessionsPath, sessions.filter((item) => item.token !== token));
}

function removeSessionsForUser(userId) {
  const sessions = readJsonStore(sessionsPath);
  writeJsonStore(sessionsPath, sessions.filter((item) => item.userId !== userId));
}

function canSendOtpEmail() {
  return Boolean(resendApiKey && notificationFromEmail);
}

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashOtp(email, purpose, otp) {
  return crypto
    .createHmac('sha256', otpSecret)
    .update(`${clean(email).toLowerCase()}|${clean(purpose)}|${clean(otp)}`)
    .digest('hex');
}

function readOtpRecords() {
  const now = Date.now();
  return readJsonStore(otpStorePath).filter((item) => Date.parse(item.expiresAt || '') > now && Number(item.attempts || 0) < 5);
}

function writeOtpRecords(records) {
  writeJsonStore(otpStorePath, records.slice(-500));
}

function saveOtpRecord(record) {
  const records = readOtpRecords().filter((item) => !(item.email === record.email && item.purpose === record.purpose));
  records.push(record);
  writeOtpRecords(records);
}

function findOtpRecord(email, purpose) {
  return readOtpRecords().find((item) => item.email === clean(email).toLowerCase() && item.purpose === purpose);
}

function consumeOtp(email, purpose, otp) {
  const records = readOtpRecords();
  const index = records.findIndex((item) => item.email === clean(email).toLowerCase() && item.purpose === purpose);
  if (index < 0) return { ok: false, reason: 'missing' };
  const record = records[index];
  if (Date.parse(record.expiresAt || '') <= Date.now()) return { ok: false, reason: 'expired' };
  if (!safeCompare(record.otpHash, hashOtp(record.email, purpose, otp))) {
    record.attempts = Number(record.attempts || 0) + 1;
    records[index] = record;
    writeOtpRecords(records);
    return { ok: false, reason: 'invalid' };
  }
  records.splice(index, 1);
  writeOtpRecords(records);
  return { ok: true, record };
}

function buildOtpMessage(name, otp, purpose) {
  const action = purpose === 'signup' ? 'create your TRADEONIX Journal account' : 'reset your TRADEONIX Journal password';
  return [
    `Hi ${name || 'there'},`,
    '',
    `Your TRADEONIX verification code is: ${otp}`,
    '',
    `Use this code to ${action}.`,
    'This code expires in 10 minutes. Do not share it with anyone.',
    '',
    'TRADEONIX ACADEMY'
  ].join('\n');
}

function getEmailSetupError(error) {
  const rawMessage = String(error?.message || 'Unknown Resend error');
  const message = rawMessage.toLowerCase();
  const safeProviderMessage = rawMessage
    .replace(/re_[A-Za-z0-9_\-]+/g, 're_***')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]');
  if (message.includes('testing emails') || message.includes('own email') || message.includes('audience')) {
    return `OTP email failed. Resend test mode can send only to your verified Resend account email. Provider: ${safeProviderMessage}`;
  }
  if (message.includes('api key') || message.includes('unauthorized') || message.includes('401') || message.includes('invalid_api_key')) {
    return `OTP email failed. Please check RESEND_API_KEY in Railway variables. Provider: ${safeProviderMessage}`;
  }
  if (message.includes('domain') || message.includes('sender') || message.includes('from') || message.includes('verify') || message.includes('not verified')) {
    return `OTP email failed. Please verify your sender domain/email in Resend and check NOTIFICATION_FROM_EMAIL. Provider: ${safeProviderMessage}`;
  }
  return `OTP email failed. Please check Resend setup, sender email, and Railway variables. Provider: ${safeProviderMessage}`;
}

async function handleRequestSignupOtp(request, response) {
  try {
    if (!canSendOtpEmail()) return sendJson(response, 500, { error: 'Email OTP is not configured yet. Please add RESEND_API_KEY and NOTIFICATION_FROM_EMAIL in Railway variables.' });
    const body = JSON.parse(await readRequestBody(request) || '{}');
    const name = clean(body.name);
    const email = clean(body.email).toLowerCase();
    const password = normalizePassword(body.password);
    if (name.length < 2) return sendJson(response, 400, { error: 'Please enter your full name.' });
    if (!isValidEmail(email)) return sendJson(response, 400, { error: 'Please enter a valid email address.' });
    if (password.length < 8) return sendJson(response, 400, { error: 'Password must be at least 8 characters.' });

    const users = readJsonStore(usersPath);
    if (users.some((user) => user.email === email)) return sendJson(response, 409, { error: 'An account already exists with this email. Please login or reset password.' });

    const existing = findOtpRecord(email, 'signup');
    if (existing && Date.parse(existing.nextAllowedAt || '') > Date.now()) {
      return sendJson(response, 429, { error: 'Please wait one minute before requesting another OTP.' });
    }

    const otp = generateOtp();
    const otpRecord = {
      id: `OTP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      purpose: 'signup',
      name,
      email,
      passwordHash: hashPassword(password),
      otpHash: hashOtp(email, 'signup', otp),
      attempts: 0,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      nextAllowedAt: new Date(Date.now() + 60 * 1000).toISOString()
    };

    try {
      await sendEmail(email, 'Your TRADEONIX account OTP', buildOtpMessage(name, otp, 'signup'));
    } catch (emailError) {
      console.warn(`Signup OTP email failed for ${email}: ${emailError.message}`);
      return sendJson(response, 502, { error: getEmailSetupError(emailError) });
    }
    saveOtpRecord(otpRecord);
    sendJson(response, 200, { ok: true, message: 'OTP sent to your email. Please verify to create account.' });
  } catch (error) {
    sendJson(response, 400, { error: error.message || 'Could not send OTP. Please try again.' });
  }
}

async function handleVerifySignupOtp(request, response) {
  try {
    const body = JSON.parse(await readRequestBody(request) || '{}');
    const email = clean(body.email).toLowerCase();
    const otp = clean(body.otp);
    if (!isValidEmail(email)) return sendJson(response, 400, { error: 'Please enter a valid email address.' });
    if (!/^\d{6}$/.test(otp)) return sendJson(response, 400, { error: 'Please enter the 6 digit OTP.' });

    const result = consumeOtp(email, 'signup', otp);
    if (!result.ok) return sendJson(response, 400, { error: 'OTP is incorrect or expired.' });

    const users = readJsonStore(usersPath);
    if (users.some((user) => user.email === email)) return sendJson(response, 409, { error: 'An account already exists with this email.' });
    const user = {
      id: `USR-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      name: result.record.name,
      email,
      passwordHash: result.record.passwordHash,
      createdAt: new Date().toISOString()
    };
    users.push(user);
    writeJsonStore(usersPath, users);
    const token = createSession(user.id);
    sendJson(response, 201, { ok: true, token, user: publicUser(user) });
  } catch (error) {
    sendJson(response, 400, { error: 'Could not verify OTP.' });
  }
}

async function handleRequestPasswordReset(request, response) {
  try {
    if (!canSendOtpEmail()) return sendJson(response, 500, { error: 'Email OTP is not configured yet. Please add RESEND_API_KEY and NOTIFICATION_FROM_EMAIL in Railway variables.' });
    const body = JSON.parse(await readRequestBody(request) || '{}');
    const email = clean(body.email).toLowerCase();
    if (!isValidEmail(email)) return sendJson(response, 400, { error: 'Please enter a valid email address.' });

    const user = readJsonStore(usersPath).find((item) => item.email === email);
    if (!user) return sendJson(response, 404, { error: 'No account exists with this email. Please sign up first.' });
    const existing = findOtpRecord(email, 'reset');
    if (existing && Date.parse(existing.nextAllowedAt || '') > Date.now()) {
      return sendJson(response, 429, { error: 'Please wait one minute before requesting another OTP.' });
    }

    const otp = generateOtp();
    const otpRecord = {
      id: `OTP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      purpose: 'reset',
      name: user.name,
      email,
      otpHash: hashOtp(email, 'reset', otp),
      attempts: 0,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      nextAllowedAt: new Date(Date.now() + 60 * 1000).toISOString()
    };
    try {
      await sendEmail(email, 'Your TRADEONIX password reset OTP', buildOtpMessage(user.name, otp, 'reset'));
    } catch (emailError) {
      console.warn(`Password reset OTP email failed for ${email}: ${emailError.message}`);
      return sendJson(response, 502, { error: getEmailSetupError(emailError) });
    }
    saveOtpRecord(otpRecord);

    sendJson(response, 200, { ok: true, message: 'Reset OTP sent to your email.' });
  } catch (error) {
    sendJson(response, 400, { error: error.message || 'Could not send reset OTP. Please try again.' });
  }
}

async function handleResetPassword(request, response) {
  try {
    const body = JSON.parse(await readRequestBody(request) || '{}');
    const email = clean(body.email).toLowerCase();
    const otp = clean(body.otp);
    const password = normalizePassword(body.password);
    if (!isValidEmail(email)) return sendJson(response, 400, { error: 'Please enter a valid email address.' });
    if (!/^\d{6}$/.test(otp)) return sendJson(response, 400, { error: 'Please enter the 6 digit OTP.' });
    if (password.length < 8) return sendJson(response, 400, { error: 'Password must be at least 8 characters.' });

    const result = consumeOtp(email, 'reset', otp);
    if (!result.ok) return sendJson(response, 400, { error: 'OTP is incorrect or expired.' });

    const users = readJsonStore(usersPath);
    const userIndex = users.findIndex((item) => item.email === email);
    if (userIndex < 0) return sendJson(response, 404, { error: 'Account not found.' });
    users[userIndex].passwordHash = hashPassword(password);
    users[userIndex].passwordUpdatedAt = new Date().toISOString();
    writeJsonStore(usersPath, users);
    removeSessionsForUser(users[userIndex].id);
    sendJson(response, 200, { ok: true, message: 'Password updated. Please login.' });
  } catch (error) {
    sendJson(response, 400, { error: 'Could not reset password.' });
  }
}

async function handleSignup(request, response) {
  sendJson(response, 410, { error: 'Signup now requires email OTP. Please request OTP first.' });
}

async function handleLogin(request, response) {
  try {
    const body = JSON.parse(await readRequestBody(request) || '{}');
    const email = clean(body.email).toLowerCase();
    const password = body.password;
    const user = readJsonStore(usersPath).find((item) => item.email === email);
    if (!user) {
      return sendJson(response, 404, { error: 'No account found with this email. Please sign up first.' });
    }
    if (!passwordMatches(password, user.passwordHash)) {
      return sendJson(response, 401, { error: 'Password is incorrect. Please try again or use forgot password.' });
    }
    const token = createSession(user.id);
    sendJson(response, 200, { ok: true, token, user: publicUser(user) });
  } catch (error) {
    sendJson(response, 400, { error: 'Could not sign in.' });
  }
}

function handleMe(request, response) {
  const session = getSessionUser(request);
  if (!session) return sendJson(response, 401, { error: 'Please sign in again.' });
  sendJson(response, 200, { user: publicUser(session.user) });
}

function handleLogout(request, response) {
  const token = getBearerToken(request);
  if (token) removeSession(token);
  sendJson(response, 200, { ok: true });
}

async function handleAdminClients(request, response) {
  if (!requireAdminKey(request, response)) return;
  if (request.method === 'GET') {
    sendJson(response, 200, { clients: readClients() });
    return;
  }
  try {
    const body = JSON.parse(await readRequestBody(request) || '{}');
    const name = clean(body.name);
    const phone = clean(body.phone);
    const email = clean(body.email).toLowerCase();
    if (name.length < 2) return sendJson(response, 400, { error: 'Client name is required.' });
    if (email && !isValidEmail(email)) return sendJson(response, 400, { error: 'Enter a valid client email.' });
    if (phone && !isValidPhone(phone)) return sendJson(response, 400, { error: 'Enter a valid client phone.' });

    const clients = readJsonStore(clientsPath);
    const now = new Date().toISOString();
    const client = {
      clientId: clean(body.clientId) || `CL-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      name,
      phone,
      email,
      address: clean(body.address),
      pan: clean(body.pan).toUpperCase(),
      aadhaar: clean(body.aadhaar),
      paymentMethods: Array.isArray(body.paymentMethods) ? body.paymentMethods.map((item) => clean(item)).filter(Boolean) : [],
      bankName: clean(body.bankName),
      bankAccount: clean(body.bankAccount),
      upiId: clean(body.upiId),
      kycFiles: Array.isArray(body.kycFiles) ? body.kycFiles.slice(0, 5).map((file) => ({
        name: clean(file.name).slice(0, 120),
        type: clean(file.type).slice(0, 80),
        dataUrl: String(file.dataUrl || '').slice(0, 4_000_000),
        uploadedAt: now
      })).filter((file) => file.dataUrl.startsWith('data:')) : [],
      notes: clean(body.notes),
      status: clean(body.status) || 'active',
      createdAt: now,
      updatedAt: now
    };
    clients.push(client);
    writeClients(clients);
    sendJson(response, 201, { ok: true, client });
  } catch (error) {
    sendJson(response, 400, { error: 'Could not save client.' });
  }
}

function handleDeleteAdminClient(request, response) {
  if (!requireAdminKey(request, response)) return;
  const clientId = decodeURIComponent(request.url.split('/').pop() || '');
  const clients = readJsonStore(clientsPath);
  const nextClients = clients.filter((client) => client.clientId !== clientId);
  if (clients.length === nextClients.length) return sendJson(response, 404, { error: 'Client not found.' });
  writeClients(nextClients);
  sendJson(response, 200, { ok: true });
}

async function handleAdminUsdtOrders(request, response) {
  if (!requireAdminKey(request, response)) return;
  if (request.method === 'GET') {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const query = clean(url.searchParams.get('search')).toLowerCase();
    let orders = readUsdtOrders();
    if (query) {
      orders = orders.filter((order) => [
        order.orderId,
        order.clientName,
        order.clientId,
        order.bankTransactionId,
        order.sellerAccountPaidTo,
        order.sellerPaymentMethod,
        order.sellerBankTransactionId,
        order.paymentMethod,
        order.orderSide
      ].some((value) => String(value || '').toLowerCase().includes(query)));
    }
    sendJson(response, 200, { orders });
    return;
  }
  try {
    const body = JSON.parse(await readRequestBody(request) || '{}');
    const clientId = clean(body.clientId);
    const orderSide = clean(body.orderSide);
    if (!clientId) return sendJson(response, 400, { error: 'Select a client.' });
    if (!['client_buy_usdt', 'client_sell_usdt'].includes(orderSide)) return sendJson(response, 400, { error: 'Select buy/sell order type.' });
    const calculated = calculateUsdtOrder({ ...body, orderSide });
    if (calculated.quantity <= 0) return sendJson(response, 400, { error: 'USDT quantity is required.' });
    if (orderSide === 'client_buy_usdt' && (!calculated.buyPrice || !calculated.sellPrice)) {
      return sendJson(response, 400, { error: 'Buy price and sell price are required to calculate profit.' });
    }

    const now = new Date().toISOString();
    const orderDate = clean(body.orderDate) || now.slice(0, 10);
    const orderTime = clean(body.orderTime);
    const order = {
      orderId: `USDT-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      clientId,
      clientName: getClientName(clientId),
      orderSide,
      orderDate,
      orderTime,
      transactionAt: orderTime ? `${orderDate}T${orderTime}:00` : orderDate,
      paymentMethod: clean(body.paymentMethod),
      bankTransactionId: clean(body.bankTransactionId),
      sellerAccountPaidTo: clean(body.sellerAccountPaidTo),
      sellerPaymentMethod: clean(body.sellerPaymentMethod),
      sellerBankTransactionId: clean(body.sellerBankTransactionId),
      status: clean(body.status) || 'completed',
      notes: clean(body.notes),
      createdAt: now,
      ...calculated
    };
    const orders = readJsonStore(usdtOrdersPath);
    orders.push(order);
    writeUsdtOrders(orders);
    sendJson(response, 201, { ok: true, order });
  } catch (error) {
    sendJson(response, 400, { error: 'Could not save USDT order.' });
  }
}

async function handleUpdateAdminUsdtOrder(request, response) {
  if (!requireAdminKey(request, response)) return;
  const orderId = decodeURIComponent(request.url.split('/').pop() || '');
  const orders = readJsonStore(usdtOrdersPath);
  const existingIndex = orders.findIndex((order) => order.orderId === orderId);
  if (existingIndex === -1) return sendJson(response, 404, { error: 'Order not found.' });

  try {
    const body = JSON.parse(await readRequestBody(request) || '{}');
    const existing = orders[existingIndex];
    const clientId = clean(body.clientId) || existing.clientId;
    const orderSide = clean(body.orderSide) || existing.orderSide;
    if (!clientId) return sendJson(response, 400, { error: 'Select a client.' });
    if (!['client_buy_usdt', 'client_sell_usdt'].includes(orderSide)) return sendJson(response, 400, { error: 'Select buy/sell order type.' });

    const calculated = calculateUsdtOrder({ ...existing, ...body, clientId, orderSide });
    if (calculated.quantity <= 0) return sendJson(response, 400, { error: 'USDT quantity is required.' });
    if (orderSide === 'client_buy_usdt' && (!calculated.buyPrice || !calculated.sellPrice)) {
      return sendJson(response, 400, { error: 'Buy price and sell price are required to calculate profit.' });
    }

    const now = new Date().toISOString();
    const orderDate = clean(body.orderDate) || existing.orderDate || now.slice(0, 10);
    const orderTime = clean(body.orderTime);
    const updatedOrder = {
      ...existing,
      clientId,
      clientName: getClientName(clientId) || existing.clientName,
      orderSide,
      orderDate,
      orderTime,
      transactionAt: orderTime ? `${orderDate}T${orderTime}:00` : orderDate,
      paymentMethod: clean(body.paymentMethod),
      bankTransactionId: clean(body.bankTransactionId),
      sellerAccountPaidTo: clean(body.sellerAccountPaidTo),
      sellerPaymentMethod: clean(body.sellerPaymentMethod),
      sellerBankTransactionId: clean(body.sellerBankTransactionId),
      status: clean(body.status) || existing.status || 'completed',
      notes: clean(body.notes),
      updatedAt: now,
      ...calculated
    };
    orders[existingIndex] = updatedOrder;
    writeUsdtOrders(orders);
    sendJson(response, 200, { ok: true, order: updatedOrder });
  } catch (error) {
    sendJson(response, 400, { error: 'Could not update USDT order.' });
  }
}

function handleDeleteAdminUsdtOrder(request, response) {
  if (!requireAdminKey(request, response)) return;
  const orderId = decodeURIComponent(request.url.split('/').pop() || '');
  const orders = readJsonStore(usdtOrdersPath);
  const nextOrders = orders.filter((order) => order.orderId !== orderId);
  if (orders.length === nextOrders.length) return sendJson(response, 404, { error: 'Order not found.' });
  writeUsdtOrders(nextOrders);
  sendJson(response, 200, { ok: true });
}

function handleAdminReports(request, response) {
  if (!requireAdminKey(request, response)) return;
  const orders = readUsdtOrders();
  const reports = buildReports(orders);
  const totals = reports.yearly.reduce((sum, row) => ({
    orders: sum.orders + row.orders,
    revenue: sum.revenue + row.revenue,
    profit: sum.profit + row.profit,
    usdtProfit: sum.usdtProfit + row.usdtProfit,
    estimatedProfitInr: sum.estimatedProfitInr + row.estimatedProfitInr,
    usdtPurchasedFromSellers: sum.usdtPurchasedFromSellers + row.usdtPurchasedFromSellers,
    usdtBoughtByClients: sum.usdtBoughtByClients + row.usdtBoughtByClients,
    usdtSoldByClients: sum.usdtSoldByClients + row.usdtSoldByClients
  }), { orders: 0, revenue: 0, profit: 0, usdtProfit: 0, estimatedProfitInr: 0, usdtPurchasedFromSellers: 0, usdtBoughtByClients: 0, usdtSoldByClients: 0 });
  sendJson(response, 200, { ...reports, totals });
}

function handleJournalList(request, response) {
  const session = getSessionUser(request);
  if (!session) return sendJson(response, 401, { error: 'Please sign in to view your journal.' });
  const entries = readJsonStore(journalsPath)
    .filter((entry) => entry.userId === session.user.id)
    .sort((a, b) => String(b.tradeDate || b.createdAt).localeCompare(String(a.tradeDate || a.createdAt)));
  sendJson(response, 200, { entries });
}

async function handleJournalCreate(request, response) {
  const session = getSessionUser(request);
  if (!session) return sendJson(response, 401, { error: 'Please sign in to add a journal entry.' });
  try {
    const body = JSON.parse(await readRequestBody(request) || '{}');
    const tradeDate = clean(body.tradeDate);
    const market = clean(body.market);
    const direction = clean(body.direction);
    const setup = clean(body.setup);
    const result = Number(body.result || 0);
    const riskReward = clean(body.riskReward);
    const emotion = clean(body.emotion);
    const notes = clean(body.notes);
    if (!tradeDate) return sendJson(response, 400, { error: 'Please select a trade date.' });
    if (!market) return sendJson(response, 400, { error: 'Please select a market.' });
    if (!direction) return sendJson(response, 400, { error: 'Please select trade direction.' });

    const entries = readJsonStore(journalsPath);
    const entry = {
      id: `JRN-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      userId: session.user.id,
      tradeDate,
      market,
      direction,
      setup,
      result: Number.isFinite(result) ? result : 0,
      riskReward,
      emotion,
      notes,
      createdAt: new Date().toISOString()
    };
    entries.push(entry);
    writeJsonStore(journalsPath, entries);
    sendJson(response, 201, { ok: true, entry });
  } catch (error) {
    sendJson(response, 400, { error: 'Could not save this journal entry.' });
  }
}

function handleJournalDelete(request, response) {
  const session = getSessionUser(request);
  if (!session) return sendJson(response, 401, { error: 'Please sign in to update your journal.' });
  const entryId = decodeURIComponent(request.url.split('/').pop() || '');
  const entries = readJsonStore(journalsPath);
  const nextEntries = entries.filter((entry) => !(entry.id === entryId && entry.userId === session.user.id));
  if (nextEntries.length === entries.length) return sendJson(response, 404, { error: 'Journal entry not found.' });
  writeJsonStore(journalsPath, nextEntries);
  sendJson(response, 200, { ok: true });
}

function deletePurchaseRequest(referenceId) {
  const requests = readPurchaseRequests().reverse();
  const nextRequests = requests.filter((item) => item.referenceId !== referenceId);
  if (nextRequests.length === requests.length) return false;
  writePurchaseRequests(nextRequests);
  return true;
}

function findPurchaseRequest(referenceId) {
  return readPurchaseRequests().reverse().find((item) => item.referenceId === referenceId);
}

function findPurchaseRequestByOrderId(razorpayOrderId) {
  return readPurchaseRequests().reverse().find((item) => item.razorpayOrderId === razorpayOrderId);
}

function updatePaymentStatus(referenceId, paymentStatus) {
  const allowedStatuses = new Set(['pending', 'paid', 'failed', 'refunded']);
  if (!allowedStatuses.has(paymentStatus)) return { ok: false, reason: 'invalid' };

  const requests = readPurchaseRequests().reverse();
  const request = requests.find((item) => item.referenceId === referenceId);
  if (!request) return { ok: false, reason: 'missing' };

  request.paymentStatus = paymentStatus;
  request.paymentStatusUpdatedAt = new Date().toISOString();
  writePurchaseRequests(requests);
  if (paymentStatus === 'paid') {
    notifyPaymentSuccess(request);
  } else {
    runNotification('Admin email payment status update', () => sendEmail(adminEmail, `Payment status updated - ${request.referenceId}`, buildAdminMessage('Payment status updated', request)));
  }
  return { ok: true, request };
}

function updateRequest(referenceId, updater) {
  const requests = readPurchaseRequests().reverse();
  const request = requests.find((item) => item.referenceId === referenceId);
  if (!request) return null;
  updater(request);
  writePurchaseRequests(requests);
  return request;
}

function createRazorpayOrder({ amount, currency, receipt }) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64');
    const payload = JSON.stringify({ amount, currency, receipt });
    const request = https.request({
      hostname: 'api.razorpay.com',
      path: '/v1/orders',
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (apiResponse) => {
      let body = '';
      apiResponse.on('data', (chunk) => {
        body += chunk;
      });
      apiResponse.on('end', () => {
        let parsed = {};
        try {
          parsed = JSON.parse(body || '{}');
        } catch (error) {
          reject({ statusCode: 500, message: 'Invalid response from Razorpay.' });
          return;
        }
        if (apiResponse.statusCode === 401) {
          reject({ statusCode: 401, message: 'Razorpay authentication failed.' });
          return;
        }
        if (apiResponse.statusCode < 200 || apiResponse.statusCode >= 300) {
          reject({ statusCode: 500, message: parsed.error?.description || 'Razorpay order creation failed.' });
          return;
        }
        resolve(parsed);
      });
    });
    request.on('error', () => reject({ statusCode: 500, message: 'Could not reach Razorpay.' }));
    request.write(payload);
    request.end();
  });
}

function buildPaymentUrl(planId, plan, referenceId) {
  if (plan.checkoutUrl) {
    const url = new URL(plan.checkoutUrl);
    url.searchParams.set('reference', referenceId);
    url.searchParams.set('plan', planId);
    url.searchParams.set('amount', String(plan.price));
    return url.toString();
  }
  const params = new URLSearchParams({
    reference: referenceId,
    plan: planId,
    amount: String(plan.price)
  });
  return `/payment.html?${params.toString()}`;
}

async function handlePurchaseRequest(request, response) {
  try {
    const body = JSON.parse(await readRequestBody(request) || '{}');
    const plan = plans[clean(body.planId)];
    const name = clean(body.name);
    const email = clean(body.email).toLowerCase();
    const phone = clean(body.phone);
    const message = clean(body.message);
    const planId = clean(body.planId);

    if (!plan) return sendJson(response, 400, { error: 'Please choose a valid plan.' });
    if (name.length < 2) return sendJson(response, 400, { error: 'Please enter your full name.' });
    if (email && !isValidEmail(email)) return sendJson(response, 400, { error: 'Please enter a valid email address.' });
    if (!isValidPhone(phone)) return sendJson(response, 400, { error: 'Please enter a valid phone number.' });

    fs.mkdirSync(dataDir, { recursive: true });
    const referenceId = `TXN-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const paymentUrl = buildPaymentUrl(planId, plan, referenceId);
    const record = {
      referenceId,
      status: 'payment_redirected',
      paymentStatus: plan.price ? 'pending' : 'not_required',
      planId,
      planName: plan.name,
      planPrice: plan.price,
      checkoutUrl: paymentUrl,
      customer: { name, email, phone },
      message,
      createdAt: new Date().toISOString()
    };

    fs.appendFileSync(requestLog, `${JSON.stringify(record)}\n`, 'utf8');
    notifyNewRequest(record);
    sendJson(response, 201, {
      ok: true,
      referenceId,
      paymentUrl,
      message: 'Purchase request received.'
    });
  } catch (error) {
    sendJson(response, 400, { error: 'Could not process this request.' });
  }
}

async function handleCreateOrder(request, response) {
  try {
    if (!razorpayKeyId || !razorpayKeySecret) {
      sendJson(response, 500, { error: 'Razorpay credentials are not configured.' });
      return;
    }

    const body = JSON.parse(await readRequestBody(request) || '{}');
    const planId = clean(body.planId);
    const plan = plans[planId];
    const name = clean(body.name);
    const email = clean(body.email).toLowerCase();
    const phone = clean(body.phone);
    const message = clean(body.message);
    const couponCode = normalizeCouponCode(body.couponCode);
    const pricing = calculatePlanPricing(planId, couponCode);
    const amount = pricing.payablePaise;
    const currency = clean(body.currency || 'INR').toUpperCase();

    if (!plan) return sendJson(response, 400, { error: 'Please choose a valid plan.' });
    if (name.length < 2) return sendJson(response, 400, { error: 'Please enter your full name.' });
    if (!isValidEmail(email)) return sendJson(response, 400, { error: 'Please enter a valid email address.' });
    if (!isValidPhone(phone)) return sendJson(response, 400, { error: 'Please enter a valid phone number.' });
    if (!Number.isInteger(amount) || amount < 100) return sendJson(response, 400, { error: 'Amount must be at least 100 paise.' });

    const referenceId = `TXN-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const receipt = referenceId.slice(0, 40);
    const order = await createRazorpayOrder({ amount, currency, receipt });

    fs.mkdirSync(dataDir, { recursive: true });
    const record = {
      referenceId,
      status: 'razorpay_order_created',
      paymentStatus: 'pending',
      planId,
      planName: plan.name,
      planPrice: plan.price,
      originalPlanPrice: pricing.originalPaise / 100,
      discountAmount: pricing.discountPaise / 100,
      finalPlanPrice: pricing.payablePaise / 100,
      coupon: pricing.coupon,
      razorpayOrderId: order.id,
      customer: { name, email, phone },
      message,
      createdAt: new Date().toISOString()
    };
    fs.appendFileSync(requestLog, `${JSON.stringify(record)}\n`, 'utf8');
    notifyOrderCreated(record);

    sendJson(response, 201, {
      key_id: razorpayKeyId,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      originalAmount: pricing.originalPaise,
      discountAmount: pricing.discountPaise,
      payableAmount: pricing.payablePaise,
      coupon: pricing.coupon,
      referenceId
    });
  } catch (error) {
    sendJson(response, error.statusCode || 500, { error: error.message || 'Could not create Razorpay order.' });
  }
}

async function handleVerifyPayment(request, response) {
  try {
    const body = JSON.parse(await readRequestBody(request) || '{}');
    const referenceId = clean(body.referenceId);
    const razorpayPaymentId = clean(body.razorpay_payment_id);
    const razorpayOrderId = clean(body.razorpay_order_id);
    const razorpaySignature = clean(body.razorpay_signature);

    if (!referenceId || !razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      sendJson(response, 400, { error: 'Missing payment verification fields.' });
      return;
    }

    const savedRequest = findPurchaseRequest(referenceId);
    if (!savedRequest || savedRequest.razorpayOrderId !== razorpayOrderId) {
      sendJson(response, 400, { error: 'Order does not match this request.' });
      return;
    }

    const expectedSignature = crypto
      .createHmac('sha256', razorpayKeySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    const isValidSignature = crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(razorpaySignature)
    );

    if (!isValidSignature) {
      sendJson(response, 400, { error: 'Payment signature mismatch.' });
      return;
    }

    const wasAlreadyPaid = savedRequest.paymentStatus === 'paid';
    const updatedRequest = updateRequest(referenceId, (item) => {
      item.status = 'payment_verified';
      item.paymentStatus = 'paid';
      item.razorpayPaymentId = razorpayPaymentId;
      item.razorpaySignature = razorpaySignature;
      item.paymentStatusUpdatedAt = new Date().toISOString();
    });
    if (!wasAlreadyPaid) notifyPaymentSuccess(updatedRequest);

    sendJson(response, 200, { ok: true, request: updatedRequest });
  } catch (error) {
    sendJson(response, 400, { error: 'Could not verify payment.' });
  }
}

async function handleRazorpayWebhook(request, response) {
  try {
    if (!razorpayWebhookSecret) {
      sendJson(response, 500, { error: 'Razorpay webhook secret is not configured.' });
      return;
    }

    const rawBody = await readRequestBody(request);
    const razorpaySignature = clean(request.headers['x-razorpay-signature']);
    if (!razorpaySignature) {
      sendJson(response, 400, { error: 'Missing Razorpay webhook signature.' });
      return;
    }

    const expectedSignature = crypto
      .createHmac('sha256', razorpayWebhookSecret)
      .update(rawBody)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature);
    const receivedBuffer = Buffer.from(razorpaySignature);
    if (expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
      sendJson(response, 400, { error: 'Invalid Razorpay webhook signature.' });
      return;
    }

    const event = JSON.parse(rawBody || '{}');
    const payment = event.payload?.payment?.entity;
    const orderId = clean(payment?.order_id);
    const paymentId = clean(payment?.id);
    const paymentStatus = clean(payment?.status);

    if (!orderId || !paymentId) {
      sendJson(response, 200, { ok: true, ignored: true, reason: 'No payment order found.' });
      return;
    }

    const savedRequest = findPurchaseRequestByOrderId(orderId);
    if (!savedRequest) {
      sendJson(response, 200, { ok: true, ignored: true, reason: 'Order is not linked to a request.' });
      return;
    }

    if (event.event === 'payment.captured' || paymentStatus === 'captured') {
      const wasAlreadyPaid = savedRequest.paymentStatus === 'paid';
      const updatedRequest = updateRequest(savedRequest.referenceId, (item) => {
        item.status = 'payment_webhook_verified';
        item.paymentStatus = 'paid';
        item.razorpayPaymentId = paymentId;
        item.razorpayWebhookEvent = event.event || 'payment.captured';
        item.paymentMethod = clean(payment?.method);
        item.paymentEmail = clean(payment?.email);
        item.paymentContact = clean(payment?.contact);
        item.paymentStatusUpdatedAt = new Date().toISOString();
      });
      if (!wasAlreadyPaid) notifyPaymentSuccess(updatedRequest);
      sendJson(response, 200, { ok: true, referenceId: updatedRequest.referenceId, paymentStatus: 'paid' });
      return;
    }

    if (event.event === 'payment.failed' || paymentStatus === 'failed') {
      const updatedRequest = updateRequest(savedRequest.referenceId, (item) => {
        item.status = 'payment_webhook_failed';
        item.paymentStatus = 'failed';
        item.razorpayPaymentId = paymentId;
        item.razorpayWebhookEvent = event.event || 'payment.failed';
        item.paymentStatusUpdatedAt = new Date().toISOString();
      });
      sendJson(response, 200, { ok: true, referenceId: updatedRequest.referenceId, paymentStatus: 'failed' });
      return;
    }

    sendJson(response, 200, { ok: true, ignored: true, event: event.event || 'unknown' });
  } catch (error) {
    sendJson(response, 400, { error: 'Could not process Razorpay webhook.' });
  }
}

function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = url.pathname === '/' ? '/black-gold-version.html' : url.pathname;
  const resolvedPath = path.resolve(root, `.${decodeURIComponent(requestedPath)}`);

  if (!resolvedPath.startsWith(root)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  if (resolvedPath.startsWith(path.resolve(dataDir)) || resolvedPath.startsWith(path.resolve(bundledDataDir))) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  fs.readFile(resolvedPath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': mimeTypes[path.extname(resolvedPath)] || 'application/octet-stream'
    });
    response.end(content);
  });
}

const server = http.createServer((request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Origin': '*'
    });
    response.end();
    return;
  }
  if (request.method === 'GET' && request.url === '/api/purchase-requests') {
    if (!requireAdminKey(request, response)) return;
    sendJson(response, 200, {
      requests: readPurchaseRequests()
    });
    return;
  }
  if (request.url === '/api/admin/clients' && ['GET', 'POST'].includes(request.method)) {
    handleAdminClients(request, response);
    return;
  }
  if (request.method === 'DELETE' && request.url.startsWith('/api/admin/clients/')) {
    handleDeleteAdminClient(request, response);
    return;
  }
  if (request.url.startsWith('/api/admin/usdt-orders') && ['GET', 'POST'].includes(request.method)) {
    handleAdminUsdtOrders(request, response);
    return;
  }
  if (request.method === 'DELETE' && request.url.startsWith('/api/admin/usdt-orders/')) {
    handleDeleteAdminUsdtOrder(request, response);
    return;
  }
  if (request.method === 'PATCH' && request.url.startsWith('/api/admin/usdt-orders/')) {
    handleUpdateAdminUsdtOrder(request, response);
    return;
  }
  if (request.method === 'GET' && request.url.startsWith('/api/admin/reports')) {
    handleAdminReports(request, response);
    return;
  }
  if (request.method === 'GET' && request.url === '/api/admin/storage') {
    handleAdminStorage(request, response);
    return;
  }
  if (request.method === 'POST' && request.url === '/api/admin/storage-test') {
    handleAdminStorageTest(request, response);
    return;
  }
  if (request.method === 'GET' && request.url === '/api/admin/export') {
    handleAdminExport(request, response);
    return;
  }
  if (request.method === 'GET' && request.url.startsWith('/api/market-data')) {
    handleMarketData(request, response);
    return;
  }
  if (request.method === 'GET' && request.url.startsWith('/api/market-news')) {
    handleMarketNews(request, response);
    return;
  }
  if (request.method === 'POST' && request.url === '/api/signup') {
    handleSignup(request, response);
    return;
  }
  if (request.method === 'POST' && request.url === '/api/auth/request-signup-otp') {
    handleRequestSignupOtp(request, response);
    return;
  }
  if (request.method === 'POST' && request.url === '/api/auth/verify-signup-otp') {
    handleVerifySignupOtp(request, response);
    return;
  }
  if (request.method === 'POST' && request.url === '/api/auth/request-password-reset') {
    handleRequestPasswordReset(request, response);
    return;
  }
  if (request.method === 'POST' && request.url === '/api/auth/reset-password') {
    handleResetPassword(request, response);
    return;
  }
  if (request.method === 'POST' && request.url === '/api/login') {
    handleLogin(request, response);
    return;
  }
  if (request.method === 'GET' && request.url === '/api/me') {
    handleMe(request, response);
    return;
  }
  if (request.method === 'POST' && request.url === '/api/logout') {
    handleLogout(request, response);
    return;
  }
  if (request.method === 'GET' && request.url === '/api/journal') {
    handleJournalList(request, response);
    return;
  }
  if (request.method === 'POST' && request.url === '/api/journal') {
    handleJournalCreate(request, response);
    return;
  }
  if (request.method === 'DELETE' && request.url.startsWith('/api/journal/')) {
    handleJournalDelete(request, response);
    return;
  }
  if (request.method === 'GET' && request.url.startsWith('/api/validate-coupon')) {
    handleValidateCoupon(request, response);
    return;
  }
  if (request.method === 'POST' && request.url === '/api/create-order') {
    handleCreateOrder(request, response);
    return;
  }
  if (request.method === 'POST' && request.url === '/api/verify-payment') {
    handleVerifyPayment(request, response);
    return;
  }
  if (request.method === 'POST' && request.url === '/api/razorpay-webhook') {
    handleRazorpayWebhook(request, response);
    return;
  }
  if (request.method === 'POST' && request.url === '/api/purchase-requests') {
    handlePurchaseRequest(request, response);
    return;
  }
  if (request.method === 'DELETE' && request.url.startsWith('/api/purchase-requests/')) {
    if (!requireAdminKey(request, response)) return;
    const referenceId = decodeURIComponent(request.url.split('/').pop() || '');
    if (!referenceId) {
      sendJson(response, 400, { error: 'Reference ID is required.' });
      return;
    }
    if (!deletePurchaseRequest(referenceId)) {
      sendJson(response, 404, { error: 'Request not found.' });
      return;
    }
    sendJson(response, 200, { ok: true, referenceId });
    return;
  }
  if (request.method === 'PATCH' && request.url.startsWith('/api/purchase-requests/')) {
    if (!requireAdminKey(request, response)) return;
    const referenceId = decodeURIComponent(request.url.split('/').pop() || '');
    readRequestBody(request)
      .then((bodyText) => {
        const body = JSON.parse(bodyText || '{}');
        const result = updatePaymentStatus(referenceId, clean(body.paymentStatus));
        if (result.reason === 'invalid') {
          sendJson(response, 400, { error: 'Invalid payment status.' });
          return;
        }
        if (result.reason === 'missing') {
          sendJson(response, 404, { error: 'Request not found.' });
          return;
        }
        sendJson(response, 200, { ok: true, request: result.request });
      })
      .catch(() => sendJson(response, 400, { error: 'Could not update payment status.' }));
    return;
  }
  if (request.method === 'GET') {
    serveStatic(request, response);
    return;
  }
  response.writeHead(405);
  response.end('Method not allowed');
});

server.listen(port, '0.0.0.0', () => {
  console.log(`TRADEONIX preview and backend running on port ${port} | persistent-data-ready 2026-07-09`);
});
