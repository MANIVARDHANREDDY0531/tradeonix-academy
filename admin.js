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
const editOrderId = document.querySelector('#editOrderId');
const orderSubmitButton = document.querySelector('#orderSubmitButton');
const cancelEditOrder = document.querySelector('#cancelEditOrder');
const orderClientSelect = document.querySelector('#orderClientSelect');
const orderRows = document.querySelector('#orderRows');
const orderSearch = document.querySelector('#orderSearch');
const profitRows = document.querySelector('#profitRows');
const monthlyReport = document.querySelector('#monthlyReport');
const yearlyReport = document.querySelector('#yearlyReport');
const storageStatus = document.querySelector('#storageStatus');
const storageTestButton = document.querySelector('#storageTestButton');
const downloadBackupButton = document.querySelector('#downloadBackupButton');
const tabButtons = document.querySelectorAll('.admin-tabs button');
const sections = {
  requests: document.querySelector('#requestsSection'),
  clients: document.querySelector('#clientsSection'),
  orders: document.querySelector('#ordersSection'),
  profits: document.querySelector('#profitsSection'),
  reports: document.querySelector('#reportsSection'),
  storage: document.querySelector('#storageSection')
};

const storageKey = 'tradeonixAdminKeyword';
let adminKey = sessionStorage.getItem(storageKey) || '';
let state = {
  requests: [],
  clients: [],
  orders: [],
  reports: { monthly: [], yearly: [] },
  storage: null
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
    showLogin('Keyword is wrong.');
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

function formatOrderDateTime(order) {
  if (order.transactionAt) return formatDate(order.transactionAt);
  if (order.orderDate && order.orderTime) return `${order.orderDate} ${order.orderTime}`;
  return formatDate(order.orderDate || order.createdAt);
}

function setStatus(message) {
  statusText.textContent = message;
}

function orderSideLabel(value) {
  return value === 'client_sell_usdt' ? 'Client sold USDT to us' : 'Client bought USDT from us';
}

function orderProfitUsdt(order) {
  if (order.profitUsdt !== undefined) return Number(order.profitUsdt || 0);
  if (order.estimatedProfitInr !== undefined && Number(order.sellPrice || 0) > 0) {
    return Number(order.estimatedProfitInr || 0) / Number(order.sellPrice || 1);
  }
  if (Number(order.sellPrice || 0) > 0 && Number(order.profit || 0) > 0) {
    return Number(order.profit || 0) / Number(order.sellPrice || 1);
  }
  return Number(order.profit || 0);
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
  const profit = state.orders.reduce((sum, item) => sum + orderProfitUsdt(item), 0);
  totalProfit.textContent = `${formatNumber(profit, 4)} USDT`;
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
    orderRows.innerHTML = '<tr><td colspan="12" class="empty">No USDT orders yet.</td></tr>';
    return;
  }

  orderRows.innerHTML = state.orders.map((order) => `
    <tr>
      <td><span class="reference">${escapeHtml(order.orderId)}</span><small>${escapeHtml(order.status || 'completed')}</small></td>
      <td><strong>${escapeHtml(order.clientName)}</strong><small>${escapeHtml(order.clientId)}</small></td>
      <td><span class="side-pill ${order.orderSide === 'client_sell_usdt' ? 'sell' : 'buy'}">${escapeHtml(orderSideLabel(order.orderSide))}</span></td>
      <td>${formatAmount(order.inrAmount)}</td>
      <td>${formatAmount(order.buyPrice)}</td>
      <td>${formatAmount(order.sellPrice)}</td>
      <td>${formatNumber(order.sellerUsdtReceived, 4)} USDT</td>
      <td>${formatNumber(order.clientUsdtDelivered ?? order.quantity, 4)} USDT</td>
      <td><strong class="${orderProfitUsdt(order) >= 0 ? 'profit-positive' : 'profit-negative'}">${formatNumber(orderProfitUsdt(order), 4)} USDT</strong><small>${formatAmount(order.estimatedProfitInr)}</small></td>
      <td>${escapeHtml(order.sellerAccountPaidTo || '-')}<small>${escapeHtml(order.sellerPaymentMethod || order.paymentMethod || '-')} / ${escapeHtml(order.sellerBankTransactionId || order.bankTransactionId || 'No tx ID')}</small></td>
      <td>${formatOrderDateTime(order)}</td>
      <td class="row-actions"><button class="edit-button edit-order" type="button" data-order-id="${escapeAttr(order.orderId)}">Edit</button><button class="danger-button delete-order" type="button" data-order-id="${escapeAttr(order.orderId)}">Delete</button></td>
    </tr>
  `).join('');
}

function renderProfits() {
  const profitOrders = state.orders.filter((order) => orderProfitUsdt(order) !== 0);
  if (!profitOrders.length) {
    profitRows.innerHTML = '<p class="empty-card">No USDT profit records yet.</p>';
    return;
  }

  profitRows.innerHTML = profitOrders.map((order) => `
    <article class="profit-card">
      <div>
        <span class="reference">${escapeHtml(order.orderId)}</span>
        <h3>${escapeHtml(order.clientName || 'Client')}</h3>
        <p>${formatAmount(order.inrAmount)} paid to seller account: <strong>${escapeHtml(order.sellerAccountPaidTo || '-')}</strong></p>
      </div>
      <div class="profit-math">
        <span>Seller gave <strong>${formatNumber(order.sellerUsdtReceived, 4)} USDT</strong></span>
        <span>Client received <strong>${formatNumber(order.clientUsdtDelivered ?? order.quantity, 4)} USDT</strong></span>
        <b>Profit ${formatNumber(orderProfitUsdt(order), 4)} USDT</b>
      </div>
    </article>
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
      <span>USDT bought from seller ${formatNumber(item.usdtPurchasedFromSellers, 4)}</span>
      <span>USDT in ${formatNumber(item.usdtSoldByClients, 4)}</span>
      <span>Value ${formatAmount(item.revenue)}</span>
      <b>Profit ${formatNumber(item.usdtProfit ?? item.profit, 4)} USDT</b>
    </div>
  `).join('');
}

function renderReports() {
  monthlyReport.innerHTML = reportRows(state.reports.monthly);
  yearlyReport.innerHTML = reportRows(state.reports.yearly);
}

function renderStorage() {
  if (!storageStatus) return;
  if (!state.storage) {
    storageStatus.innerHTML = '<p>Storage check not loaded yet.</p>';
    return;
  }
  const statusClass = state.storage.ok ? 'safe' : 'danger';
  const files = state.storage.files || {};
  const counts = state.storage.counts || {};
  const writeTest = state.storage.writeTest || {};
  storageStatus.innerHTML = `
    <div class="storage-banner ${statusClass}">
      <strong>${escapeHtml(state.storage.mode || 'unknown')}</strong>
      <span>${escapeHtml(state.storage.message || '')}</span>
      <small>DATA_DIR detected: ${state.storage.configured ? 'Yes' : 'No'}${state.storage.configuredDataDir ? ` (${escapeHtml(state.storage.configuredDataDir)})` : ''}</small>
    </div>
    <div class="storage-grid">
      <article><span>Clients</span><strong>${counts.clients || 0}</strong><small>${files.clients?.bytes || 0} bytes</small></article>
      <article><span>USDT orders</span><strong>${counts.usdtOrders || 0}</strong><small>${files.usdtOrders?.bytes || 0} bytes</small></article>
      <article><span>Purchase requests</span><strong>${counts.purchaseRequests || 0}</strong><small>${files.purchaseRequests?.bytes || 0} bytes</small></article>
      <article><span>Journal users</span><strong>${counts.users || 0}</strong><small>${files.users?.bytes || 0} bytes</small></article>
      <article><span>Journal entries</span><strong>${counts.journalEntries || 0}</strong><small>${files.journalEntries?.bytes || 0} bytes</small></article>
      <article><span>Write test</span><strong>${writeTest.writes || 0}</strong><small>${escapeHtml(writeTest.testId || 'Not tested yet')}</small></article>
    </div>
    <p class="storage-note">Click Write storage test, redeploy once, then refresh. If the same test count stays, Railway storage is working.</p>
  `;
}

function renderAll() {
  renderSummary();
  renderRequests();
  renderClients();
  renderOrders();
  renderProfits();
  renderReports();
  renderStorage();
}

async function loadOrders(search = '') {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  const data = await apiFetch(`/api/admin/usdt-orders${query}`);
  state.orders = data.orders || [];
  renderSummary();
  renderOrders();
  renderProfits();
}

async function loadAll() {
  showAdmin();
  refreshButton.disabled = true;
  setStatus('Loading secure admin database...');
  try {
    const [requestsData, clientsData, ordersData, reportsData, storageData] = await Promise.all([
      apiFetch('/api/purchase-requests'),
      apiFetch('/api/admin/clients'),
      apiFetch('/api/admin/usdt-orders'),
      apiFetch('/api/admin/reports'),
      apiFetch('/api/admin/storage')
    ]);
    state.requests = requestsData.requests || [];
    state.clients = clientsData.clients || [];
    state.orders = ordersData.orders || [];
    state.reports = reportsData.reports || reportsData || { monthly: [], yearly: [] };
    state.storage = storageData;
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
  const orderId = editOrderId.value.trim();
  setStatus(orderId ? 'Updating USDT order...' : 'Generating USDT order...');
  try {
    const formData = new FormData(orderForm);
    const payload = Object.fromEntries(formData.entries());
    if (!payload.orderId) delete payload.orderId;
    await apiFetch(orderId ? `/api/admin/usdt-orders/${encodeURIComponent(orderId)}` : '/api/admin/usdt-orders', {
      method: orderId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    resetOrderForm();
    await loadAll();
    activateTab('orders');
    setStatus(orderId ? 'USDT order updated and reports refreshed.' : 'USDT order generated and report updated.');
  } catch (error) {
    setStatus(error.message || (orderId ? 'Could not update order.' : 'Could not generate order.'));
  } finally {
    button.disabled = false;
  }
}

function resetOrderForm() {
  orderForm.reset();
  editOrderId.value = '';
  orderSubmitButton.textContent = 'Generate order';
  cancelEditOrder.hidden = true;
}

function fillOrderForm(order) {
  editOrderId.value = order.orderId || '';
  orderForm.elements.clientId.value = order.clientId || '';
  orderForm.elements.orderSide.value = order.orderSide || 'client_buy_usdt';
  orderForm.elements.orderDate.value = order.orderDate || '';
  orderForm.elements.orderTime.value = order.orderTime || '';
  orderForm.elements.inrAmount.value = order.inrAmount ?? '';
  orderForm.elements.buyPrice.value = order.buyPrice ?? '';
  orderForm.elements.sellPrice.value = order.sellPrice ?? '';
  orderForm.elements.quantity.value = order.orderSide === 'client_sell_usdt' ? (order.quantity ?? '') : '';
  orderForm.elements.sellerAccountPaidTo.value = order.sellerAccountPaidTo || '';
  orderForm.elements.sellerPaymentMethod.value = order.sellerPaymentMethod || 'UPI';
  orderForm.elements.sellerBankTransactionId.value = order.sellerBankTransactionId || '';
  orderForm.elements.paymentMethod.value = order.paymentMethod || 'UPI';
  orderForm.elements.bankTransactionId.value = order.bankTransactionId || '';
  orderForm.elements.status.value = order.status || 'completed';
  orderForm.elements.notes.value = order.notes || '';
  orderSubmitButton.textContent = 'Update order';
  cancelEditOrder.hidden = false;
  orderForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
cancelEditOrder.addEventListener('click', resetOrderForm);

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
  const editButton = event.target.closest('.edit-order');
  if (editButton) {
    const order = state.orders.find((item) => item.orderId === editButton.dataset.orderId);
    if (!order) {
      setStatus('Order not found. Please refresh and try again.');
      return;
    }
    fillOrderForm(order);
    setStatus(`Editing ${order.orderId}. Update the fields and click Update order.`);
    return;
  }

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

if (downloadBackupButton) {
  downloadBackupButton.addEventListener('click', async () => {
    downloadBackupButton.disabled = true;
    setStatus('Preparing admin backup...');
    try {
      const response = await fetch('/api/admin/export', {
        cache: 'no-store',
        headers: getAdminHeaders()
      });
      if (!response.ok) throw new Error('Could not download backup.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tradeonix-admin-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatus('Backup downloaded.');
    } catch (error) {
      setStatus(error.message || 'Could not download backup.');
    } finally {
      downloadBackupButton.disabled = false;
    }
  });
}

if (storageTestButton) {
  storageTestButton.addEventListener('click', async () => {
    storageTestButton.disabled = true;
    setStatus('Writing storage test...');
    try {
      const data = await apiFetch('/api/admin/storage-test', { method: 'POST' });
      state.storage = data.storage;
      renderStorage();
      setStatus('Storage test written. Redeploy once, then refresh this tab to confirm it stays.');
    } catch (error) {
      setStatus(error.message || 'Could not write storage test.');
    } finally {
      storageTestButton.disabled = false;
    }
  });
}

if (adminKey) {
  loadAll();
} else {
  showLogin();
}
