const adminLoginPanel = document.querySelector('#adminLoginPanel');
const adminLoginForm = document.querySelector('#adminLoginForm');
const adminKeyword = document.querySelector('#adminKeyword');
const adminContent = document.querySelector('#adminContent');
const loginStatus = document.querySelector('#loginStatus');
const refreshButton = document.querySelector('#refreshButton');
const logoutButton = document.querySelector('#logoutButton');
const statusText = document.querySelector('#statusText');
const totalClients = document.querySelector('#totalClients');
const totalOrders = document.querySelector('#totalOrders');
const totalProfit = document.querySelector('#totalProfit');
const totalRequests = document.querySelector('#totalRequests');
const requestRows = document.querySelector('#requestRows');
const clientForm = document.querySelector('#clientForm');
const clientCards = document.querySelector('#clientCards');
const orderForm = document.querySelector('#orderForm');
const orderClientSelect = document.querySelector('#orderClientSelect');
const orderRows = document.querySelector('#orderRows');
const orderSearch = document.querySelector('#orderSearch');
const monthlyReport = document.querySelector('#monthlyReport');
const yearlyReport = document.querySelector('#yearlyReport');
const tabButtons = document.querySelectorAll('.admin-tabs button');
const sections = {
  requests: document.querySelector('#requestsSection'),
  clients: document.querySelector('#clientsSection'),
  orders: document.querySelector('#ordersSection'),
  reports: document.querySelector('#reportsSection')
};

const storageKey = 'tradeonixAdminKeyword';
let adminKey = sessionStorage.getItem(storageKey) || '';
let state = {
  requests: [],
  clients: [],
  orders: [],
  reports: { monthly: [], yearly: [] }
};

function showLogin(message = '') {
  adminKey = '';
  sessionStorage.removeItem(storageKey);
  adminLoginPanel.hidden = false;
  adminContent.hidden = true;
  loginStatus.textContent = message;
  setTimeout(() => adminKeyword.focus(), 50);
}

function showAdmin() {
  adminLoginPanel.hidden = true;
  adminContent.hidden = false;
}

function getAdminHeaders(extraHeaders = {}) {
  return {
    'X-Admin-Key': adminKey,
    ...extraHeaders
  };
}

async function readJsonResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (error) {
    return { error: text || 'Request failed.' };
  }
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    cache: 'no-store',
    headers: getAdminHeaders(options.headers || {})
  });
  const data = await readJsonResponse(response);
  if (response.status === 401) {
    showLogin('Wrong keyword. Please enter SVMJM5 or your Railway ADMIN_ACCESS_KEY.');
    throw new Error('Admin access required.');
  }
  if (!response.ok) {
    throw new Error(data.error || 'Request failed.');
  }
  return data;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}

function formatAmount(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2
  })}`;
}

function formatNumber(value, digits = 2) {
  return Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: digits
  });
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function setStatus(message) {
  statusText.textContent = message;
}

function orderSideLabel(value) {
  return value === 'client_sell_usdt' ? 'Client sold USDT to us' : 'Client bought USDT from us';
}

function getPaymentStatus(item) {
  if (item.paymentStatus) return item.paymentStatus;
  if (!Number(item.planPrice || 0)) return 'not_required';
  return 'pending';
}

function renderPaymentStatus(referenceId, status) {
  const options = [
    ['pending', 'Pending'],
    ['paid', 'Paid'],
    ['failed', 'Failed'],
    ['refunded', 'Refunded'],
    ['not_required', 'Not required']
  ];
  return `
    <select class="payment-status status-${escapeHtml(status)}" data-reference-id="${escapeHtml(referenceId)}">
      ${options.map(([value, label]) => `<option value="${value}" ${value === status ? 'selected' : ''}>${label}</option>`).join('')}
    </select>
  `;
}

function renderSummary() {
  totalClients.textContent = state.clients.length;
  totalOrders.textContent = state.orders.length;
  totalRequests.textContent = state.requests.length;
  const profit = state.orders.reduce((sum, item) => sum + Number(item.profit || 0), 0);
  totalProfit.textContent = formatAmount(profit);
}

function renderRequests() {
  if (!state.requests.length) {
    requestRows.innerHTML = '<tr><td colspan="9" class="empty">No purchase requests yet.</td></tr>';
    return;
  }

  requestRows.innerHTML = state.requests.map((item) => `
    <tr>
      <td><span class="reference">${escapeHtml(item.referenceId)}</span><small>${escapeHtml(item.status || 'new')}</small></td>
      <td><strong>${escapeHtml(item.customer?.name)}</strong></td>
      <td><a href="mailto:${escapeAttr(item.customer?.email)}">${escapeHtml(item.customer?.email)}</a><small>${escapeHtml(item.customer?.phone)}</small></td>
      <td>${escapeHtml(item.planName)}</td>
      <td><strong>${formatAmount(item.finalPlanPrice ?? item.planPrice)}</strong>${item.coupon?.code ? `<small>Coupon ${escapeHtml(item.coupon.code)}</small>` : ''}</td>
      <td>${renderPaymentStatus(item.referenceId, getPaymentStatus(item))}</td>
      <td>${escapeHtml(item.message || '-')}</td>
      <td>${formatDate(item.createdAt)}</td>
      <td><button class="danger-button delete-request" type="button" data-reference-id="${escapeAttr(item.referenceId)}">Delete</button></td>
    </tr>
  `).join('');
}

function renderClients() {
  orderClientSelect.innerHTML = '<option value="">Select client</option>' + state.clients.map((client) => (
    `<option value="${escapeAttr(client.clientId)}">${escapeHtml(client.name)} - ${escapeHtml(client.phone || client.email || client.clientId)}</option>`
  )).join('');

  if (!state.clients.length) {
    clientCards.innerHTML = '<p class="empty-card">No clients stored yet. Add your first client with KYC details.</p>';
    return;
  }

  clientCards.innerHTML = state.clients.map((client) => {
    const methods = (client.paymentMethods || []).map((item) => `<span>${escapeHtml(item)}</span>`).join('');
    const kyc = (client.kycFiles || []).map((file) => `
      <a class="kyc-link" href="${escapeAttr(file.dataUrl)}" target="_blank" rel="noopener" download="${escapeAttr(file.name || 'kyc-file')}">
        ${file.type?.startsWith('image/') ? `<img src="${escapeAttr(file.dataUrl)}" alt="" />` : '<span class="file-icon">PDF</span>'}
        <strong>${escapeHtml(file.name || 'KYC file')}</strong>
      </a>
    `).join('');
    return `
      <article class="client-card">
        <div class="card-top">
          <div>
            <span class="reference">${escapeHtml(client.clientId)}</span>
            <h3>${escapeHtml(client.name)}</h3>
          </div>
          <button class="danger-button delete-client" type="button" data-client-id="${escapeAttr(client.clientId)}">Delete</button>
        </div>
        <dl>
          <div><dt>Phone</dt><dd>${escapeHtml(client.phone || '-')}</dd></div>
          <div><dt>Email</dt><dd>${escapeHtml(client.email || '-')}</dd></div>
          <div><dt>PAN</dt><dd>${escapeHtml(client.pan || '-')}</dd></div>
          <div><dt>Aadhaar / ID</dt><dd>${escapeHtml(client.aadhaar || '-')}</dd></div>
          <div><dt>UPI</dt><dd>${escapeHtml(client.upiId || '-')}</dd></div>
          <div><dt>Bank</dt><dd>${escapeHtml(client.bankName || '-')}</dd></div>
        </dl>
        <p>${escapeHtml(client.address || client.notes || 'No extra notes.')}</p>
        <div class="method-tags">${methods || '<span>No method selected</span>'}</div>
        <div class="kyc-list">${kyc || '<small>No KYC file uploaded.</small>'}</div>
      </article>
    `;
  }).join('');
}

function renderOrders() {
  if (!state.orders.length) {
    orderRows.innerHTML = '<tr><td colspan="11" class="empty">No USDT orders yet.</td></tr>';
    return;
  }

  orderRows.innerHTML = state.orders.map((order) => `
    <tr>
      <td><span class="reference">${escapeHtml(order.orderId)}</span><small>${escapeHtml(order.status || 'completed')}</small></td>
      <td><strong>${escapeHtml(order.clientName)}</strong><small>${escapeHtml(order.clientId)}</small></td>
      <td><span class="side-pill ${order.orderSide === 'client_sell_usdt' ? 'sell' : 'buy'}">${escapeHtml(orderSideLabel(order.orderSide))}</span></td>
      <td>${formatNumber(order.quantity, 4)} USDT</td>
      <td>${formatAmount(order.buyPrice)}</td>
      <td>${formatAmount(order.sellPrice)}</td>
      <td>${formatAmount(order.inrAmount)}</td>
      <td><strong class="${Number(order.profit || 0) >= 0 ? 'profit-positive' : 'profit-negative'}">${formatAmount(order.profit)}</strong></td>
      <td>${escapeHtml(order.paymentMethod || '-')}<small>${escapeHtml(order.bankTransactionId || 'No bank tx ID')}</small></td>
      <td>${formatDate(order.orderDate || order.createdAt)}</td>
      <td><button class="danger-button delete-order" type="button" data-order-id="${escapeAttr(order.orderId)}">Delete</button></td>
    </tr>
  `).join('');
}

function reportRows(items) {
  if (!items || !items.length) {
    return '<p class="empty-card">No report data yet.</p>';
  }
  return items.map((item) => `
    <div class="report-row">
      <strong>${escapeHtml(item.period)}</strong>
      <span>Orders ${formatNumber(item.orders, 0)}</span>
      <span>Client buys ${formatNumber(item.buyOrders, 0)}</span>
      <span>Client sells ${formatNumber(item.sellOrders, 0)}</span>
      <span>USDT out ${formatNumber(item.usdtBoughtByClients, 4)}</span>
      <span>USDT in ${formatNumber(item.usdtSoldByClients, 4)}</span>
      <span>Value ${formatAmount(item.revenue)}</span>
      <b>Profit ${formatAmount(item.profit)}</b>
    </div>
  `).join('');
}

function renderReports() {
  monthlyReport.innerHTML = reportRows(state.reports.monthly);
  yearlyReport.innerHTML = reportRows(state.reports.yearly);
}

function renderAll() {
  renderSummary();
  renderRequests();
  renderClients();
  renderOrders();
  renderReports();
}

async function loadOrders(search = '') {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  const data = await apiFetch(`/api/admin/usdt-orders${query}`);
  state.orders = data.orders || [];
  renderSummary();
  renderOrders();
}

async function loadAll() {
  showAdmin();
  refreshButton.disabled = true;
  setStatus('Loading secure admin database...');
  try {
    const [requestsData, clientsData, ordersData, reportsData] = await Promise.all([
      apiFetch('/api/purchase-requests'),
      apiFetch('/api/admin/clients'),
      apiFetch('/api/admin/usdt-orders'),
      apiFetch('/api/admin/reports')
    ]);
    state.requests = requestsData.requests || [];
    state.clients = clientsData.clients || [];
    state.orders = ordersData.orders || [];
    state.reports = reportsData.reports || reportsData || { monthly: [], yearly: [] };
    renderAll();
    setStatus(`Loaded ${state.clients.length} clients, ${state.orders.length} USDT orders, and ${state.requests.length} purchase requests.`);
  } catch (error) {
    if (error.message !== 'Admin access required.') {
      setStatus(error.message || 'Could not load admin data.');
    }
  } finally {
    refreshButton.disabled = false;
  }
}

function activateTab(tabName) {
  tabButtons.forEach((button) => button.classList.toggle('active', button.dataset.tab === tabName));
  Object.entries(sections).forEach(([name, section]) => section.classList.toggle('active', name === tabName));
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name,
      type: file.type,
      size: file.size,
      dataUrl: reader.result
    });
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

async function handleClientSubmit(event) {
  event.preventDefault();
  const button = clientForm.querySelector('button[type="submit"]');
  button.disabled = true;
  setStatus('Saving client and KYC files...');
  try {
    const formData = new FormData(clientForm);
    const kycFiles = await Promise.all(Array.from(formData.getAll('kycFiles')).filter((file) => file.size).map(fileToDataUrl));
    const payload = {
      name: formData.get('name'),
      phone: formData.get('phone'),
      email: formData.get('email'),
      pan: formData.get('pan'),
      aadhaar: formData.get('aadhaar'),
      upiId: formData.get('upiId'),
      bankName: formData.get('bankName'),
      bankAccount: formData.get('bankAccount'),
      address: formData.get('address'),
      notes: formData.get('notes'),
      paymentMethods: formData.getAll('paymentMethods'),
      kycFiles
    };
    await apiFetch('/api/admin/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    clientForm.reset();
    await loadAll();
    activateTab('clients');
    setStatus('Client saved successfully.');
  } catch (error) {
    setStatus(error.message || 'Could not save client.');
  } finally {
    button.disabled = false;
  }
}

async function handleOrderSubmit(event) {
  event.preventDefault();
  const button = orderForm.querySelector('button[type="submit"]');
  button.disabled = true;
  setStatus('Generating USDT order...');
  try {
    const formData = new FormData(orderForm);
    const payload = Object.fromEntries(formData.entries());
    await apiFetch('/api/admin/usdt-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    orderForm.reset();
    await loadAll();
    activateTab('orders');
    setStatus('USDT order generated and report updated.');
  } catch (error) {
    setStatus(error.message || 'Could not generate order.');
  } finally {
    button.disabled = false;
  }
}

adminLoginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const keyword = adminKeyword.value.trim();
  if (!keyword) {
    loginStatus.textContent = 'Enter the admin keyword.';
    return;
  }
  adminKey = keyword;
  sessionStorage.setItem(storageKey, adminKey);
  loadAll();
});

refreshButton.addEventListener('click', loadAll);
logoutButton.addEventListener('click', () => showLogin('Admin portal locked.'));
tabButtons.forEach((button) => button.addEventListener('click', () => activateTab(button.dataset.tab)));
clientForm.addEventListener('submit', handleClientSubmit);
orderForm.addEventListener('submit', handleOrderSubmit);

requestRows.addEventListener('click', async (event) => {
  const button = event.target.closest('.delete-request');
  if (!button) return;
  const referenceId = button.dataset.referenceId;
  if (!window.confirm(`Delete request ${referenceId}?`)) return;
  button.disabled = true;
  try {
    await apiFetch(`/api/purchase-requests/${encodeURIComponent(referenceId)}`, { method: 'DELETE' });
    await loadAll();
    setStatus('Purchase request deleted.');
  } catch (error) {
    setStatus(error.message || 'Could not delete request.');
    button.disabled = false;
  }
});

requestRows.addEventListener('change', async (event) => {
  const select = event.target.closest('.payment-status');
  if (!select) return;
  select.disabled = true;
  try {
    await apiFetch(`/api/purchase-requests/${encodeURIComponent(select.dataset.referenceId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentStatus: select.value })
    });
    await loadAll();
    setStatus('Payment status updated.');
  } catch (error) {
    setStatus(error.message || 'Could not update payment status.');
    select.disabled = false;
  }
});

clientCards.addEventListener('click', async (event) => {
  const button = event.target.closest('.delete-client');
  if (!button) return;
  const clientId = button.dataset.clientId;
  if (!window.confirm(`Delete client ${clientId}?`)) return;
  button.disabled = true;
  try {
    await apiFetch(`/api/admin/clients/${encodeURIComponent(clientId)}`, { method: 'DELETE' });
    await loadAll();
    setStatus('Client deleted.');
  } catch (error) {
    setStatus(error.message || 'Could not delete client.');
    button.disabled = false;
  }
});

orderRows.addEventListener('click', async (event) => {
  const button = event.target.closest('.delete-order');
  if (!button) return;
  const orderId = button.dataset.orderId;
  if (!window.confirm(`Delete order ${orderId}?`)) return;
  button.disabled = true;
  try {
    await apiFetch(`/api/admin/usdt-orders/${encodeURIComponent(orderId)}`, { method: 'DELETE' });
    await loadAll();
    setStatus('USDT order deleted.');
  } catch (error) {
    setStatus(error.message || 'Could not delete order.');
    button.disabled = false;
  }
});

let searchTimer;
orderSearch.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    try {
      await loadOrders(orderSearch.value.trim());
      setStatus(orderSearch.value.trim() ? 'Showing matching USDT orders.' : 'Showing all USDT orders.');
    } catch (error) {
      setStatus(error.message || 'Could not search orders.');
    }
  }, 300);
});

if (adminKey) {
  loadAll();
} else {
  showLogin();
}
