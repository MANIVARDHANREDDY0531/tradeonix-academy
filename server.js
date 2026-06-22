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

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(payload));
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

function updatePaymentStatus(referenceId, paymentStatus) {
  const allowedStatuses = new Set(['pending', 'paid', 'failed', 'refunded']);
  if (!allowedStatuses.has(paymentStatus)) return { ok: false, reason: 'invalid' };

  const requests = readPurchaseRequests().reverse();
  const request = requests.find((item) => item.referenceId === referenceId);
  if (!request) return { ok: false, reason: 'missing' };

  request.paymentStatus = paymentStatus;
  request.paymentStatusUpdatedAt = new Date().toISOString();
  writePurchaseRequests(requests);
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

    const updatedRequest = updateRequest(referenceId, (item) => {
      item.status = 'payment_verified';
      item.paymentStatus = 'paid';
      item.razorpayPaymentId = razorpayPaymentId;
      item.razorpaySignature = razorpaySignature;
      item.paymentStatusUpdatedAt = new Date().toISOString();
    });

    sendJson(response, 200, { ok: true, request: updatedRequest });
  } catch (error) {
    sendJson(response, 400, { error: 'Could not verify payment.' });
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
    response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(resolvedPath)] || 'application/octet-stream' });
    response.end(content);
  });
}

const server = http.createServer((request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Origin': '*'
    });
    response.end();
    return;
  }
  if (request.method === 'GET' && request.url === '/api/purchase-requests') {
    sendJson(response, 200, {
      requests: readPurchaseRequests()
    });
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
