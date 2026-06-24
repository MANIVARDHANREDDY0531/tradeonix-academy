const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = __dirname;
const dataDir = path.join(root, 'data');
const requestLog = path.join(dataDir, 'purchase-requests.jsonl');
const port = Number(process.env.PORT || 8766);

loadEnv();

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
  '.svg': 'image/svg+xml; charset=utf-8'
};

const marketFeeds = {
  nifty: { symbol: '^NSEI', decimals: 2, alwaysOpen: false },
  banknifty: { symbol: '^NSEBANK', decimals: 2, alwaysOpen: false },
  gold: { symbol: 'XAUUSD=X', decimals: 2, alwaysOpen: false },
  bitcoin: { symbol: 'BTC-USD', decimals: 2, alwaysOpen: true }
};

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
  if (!resendApiKey || !notificationFromEmail || !to) return;
  await postJson('api.resend.com', '/emails', {
    Authorization: `Bearer ${resendApiKey}`
  }, {
    from: notificationFromEmail,
    to: [to],
    subject,
    text
  });
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
    `Amount: ${formatCurrency(record.planPrice)}`,
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
    `Amount: ${formatCurrency(record.planPrice)}`,
    `Our team will contact you shortly.`
  ].join('\n');
}

function buildUserPaymentMessage(record) {
  return [
    `Hi ${record.customer?.name || 'there'},`,
    `Your payment for ${siteName} was successful.`,
    `Reference: ${record.referenceId}`,
    `Plan: ${record.planName}`,
    `Amount: ${formatCurrency(record.planPrice)}`,
    `Thank you for enrolling.`
  ].join('\n');
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

  const symbol = encodeURIComponent(feed.symbol);
  const yahooPath = `/v8/finance/chart/${symbol}?interval=15m&range=5d`;
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
  const payload = {
    price,
    change,
    prices: prices.length > 1 ? prices : makeServerSparkline(price, change),
    decimals: feed.decimals,
    lastPrice: Boolean(isClosed),
    marketState: meta.marketState || 'UNKNOWN'
  };

  marketCache.set(market, { createdAt: Date.now(), payload });
  return payload;
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

function parseNewsItems(xml, category) {
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)]
    .slice(0, 8)
    .map((match) => {
      const item = match[1];
      return {
        category,
        title: readRssTag(item, 'title'),
        source: readRssTag(item, 'source') || 'Market news',
        url: readRssTag(item, 'link'),
        publishedAt: readRssTag(item, 'pubDate')
      };
    })
    .filter((item) => item.title && item.url);
}

async function fetchNewsCategory(category, query) {
  const rssPath = `/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
  const xml = await getText('news.google.com', rssPath);
  return parseNewsItems(xml, category);
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
      category: 'Global',
      title: 'Global markets are tracking US yields, dollar movement, gold, crude oil, and central-bank commentary.',
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
    const [india, global] = await Promise.all([
      fetchNewsCategory('India', 'India stock market OR Nifty OR Sensex OR RBI financial markets'),
      fetchNewsCategory('Global', 'global financial markets OR US stocks OR gold OR crude oil OR forex')
    ]);
    const items = [...india.slice(0, 5), ...global.slice(0, 5)].slice(0, 10);
    if (!items.length) throw new Error('No news items');
    const payload = { updatedAt: new Date().toISOString(), items };
    marketNewsCache.set('latest', { createdAt: Date.now(), payload });
    return payload;
  } catch (error) {
    return { updatedAt: new Date().toISOString(), items: fallbackMarketNews(), fallback: true };
  }
}

async function handleMarketNews(request, response) {
  sendJson(response, 200, await fetchMarketNews());
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

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
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
    if (!isValidEmail(email)) return sendJson(response, 400, { error: 'Please enter a valid email address.' });
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
    const amount = Number(body.amount || (plan ? plan.price * 100 : 0));
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Origin': '*'
    });
    response.end();
    return;
  }
  if (isAdminRequest(request) && !isAdminAuthorized(request)) {
    requestAdminLogin(response);
    return;
  }
  if (request.method === 'GET' && request.url === '/api/purchase-requests') {
    sendJson(response, 200, {
      requests: readPurchaseRequests()
    });
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
  console.log(`TRADEONIX preview and backend running on port ${port}`);
});
