const requestRows = document.querySelector('#requestRows');
const statusText = document.querySelector('#statusText');
const totalRequests = document.querySelector('#totalRequests');
const latestRequest = document.querySelector('#latestRequest');
const totalValue = document.querySelector('#totalValue');
const refreshButton = document.querySelector('#refreshButton');
const logoutButton = document.querySelector('#logoutButton');
const adminLoginPanel = document.querySelector('#adminLoginPanel');
const adminLoginForm = document.querySelector('#adminLoginForm');
const adminContent = document.querySelector('#adminContent');
const loginStatus = document.querySelector('#loginStatus');
const authStorageKey = 'tradeonixAdminAuth';

let adminAuthToken = sessionStorage.getItem(authStorageKey) || '';

function showLogin(message = '') {
  adminAuthToken = '';
  sessionStorage.removeItem(authStorageKey);
  adminLoginPanel.hidden = false;
  adminContent.hidden = true;
  loginStatus.textContent = message;
}

function showAdmin() {
  adminLoginPanel.hidden = true;
  adminContent.hidden = false;
}

function getAdminHeaders(extraHeaders = {}) {
  return {
    ...extraHeaders,
    Authorization: `Basic ${adminAuthToken}`
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

function formatAmount(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`;
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function getPaymentStatus(item) {
  if (item.paymentStatus) return item.paymentStatus;
  if (!Number(item.planPrice || 0)) return 'not_required';
  if (item.status === 'payment_redirected' || item.status === 'checkout_submitted') return 'pending';
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

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderRequests(requests) {
  totalRequests.textContent = requests.length;
  latestRequest.textContent = requests[0] ? formatDate(requests[0].createdAt) : 'None';
  totalValue.textContent = formatAmount(requests.reduce((sum, item) => sum + Number(item.finalPlanPrice ?? item.planPrice ?? 0), 0));

  if (!requests.length) {
    requestRows.innerHTML = '<tr><td colspan="9" class="empty">No requests yet.</td></tr>';
    statusText.textContent = 'Waiting for the first user request.';
    return;
  }

  requestRows.innerHTML = requests.map((item) => `
    <tr>
      <td><span class="reference">${escapeHtml(item.referenceId)}</span><small>${escapeHtml(item.status || 'new')}</small></td>
      <td><strong>${escapeHtml(item.customer?.name)}</strong></td>
      <td><a href="mailto:${escapeHtml(item.customer?.email)}">${escapeHtml(item.customer?.email)}</a><small>${escapeHtml(item.customer?.phone)}</small></td>
      <td>${escapeHtml(item.planName)}</td>
      <td><strong>${formatAmount(item.finalPlanPrice ?? item.planPrice)}</strong>${item.coupon?.code ? `<small>Coupon ${escapeHtml(item.coupon.code)} saved ${formatAmount(item.discountAmount)}</small>` : ''}</td>
      <td>${renderPaymentStatus(item.referenceId, getPaymentStatus(item))}</td>
      <td>${escapeHtml(item.message || '-')}</td>
      <td>${formatDate(item.createdAt)}</td>
      <td><button class="delete-request" type="button" data-reference-id="${escapeHtml(item.referenceId)}">Delete</button></td>
    </tr>
  `).join('');
  statusText.textContent = `Showing ${requests.length} request${requests.length === 1 ? '' : 's'}.`;
}

async function loadRequests() {
  if (!adminAuthToken) {
    showLogin('Please log in to continue.');
    return;
  }

  showAdmin();
  statusText.textContent = 'Loading requests...';
  refreshButton.disabled = true;
  try {
    const response = await fetch('/api/purchase-requests', {
      cache: 'no-store',
      headers: getAdminHeaders()
    });
    const data = await readJsonResponse(response);
    if (response.status === 401) {
      showLogin('Wrong admin ID or password.');
      return;
    }
    if (!response.ok) throw new Error(data.error || 'Could not load requests.');
    renderRequests(data.requests || []);
  } catch (error) {
    statusText.textContent = error.message || 'Could not load requests.';
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener('click', loadRequests);
logoutButton.addEventListener('click', () => showLogin('Logged out.'));
adminLoginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = adminLoginForm.querySelector('button[type="submit"]');
  const formData = new FormData(adminLoginForm);
  const username = String(formData.get('username') || '').trim();
  const password = String(formData.get('password') || '');

  if (!username || !password) {
    loginStatus.textContent = 'Enter both admin ID and password.';
    return;
  }

  adminAuthToken = btoa(`${username}:${password}`);
  sessionStorage.setItem(authStorageKey, adminAuthToken);
  loginStatus.textContent = 'Checking login...';
  submitButton.disabled = true;
  await loadRequests();
  submitButton.disabled = false;
});
requestRows.addEventListener('click', async (event) => {
  const button = event.target.closest('.delete-request');
  if (!button) return;

  const referenceId = button.dataset.referenceId;
  const shouldDelete = window.confirm(`Delete request ${referenceId}?`);
  if (!shouldDelete) return;

  button.disabled = true;
  statusText.textContent = `Deleting ${referenceId}...`;
  try {
    const response = await fetch(`/api/purchase-requests/${encodeURIComponent(referenceId)}`, {
      method: 'DELETE',
      headers: getAdminHeaders()
    });
    const data = await readJsonResponse(response);
    if (response.status === 401) {
      showLogin('Please log in again.');
      return;
    }
    if (!response.ok) throw new Error(data.error || 'Could not delete request.');
    await loadRequests();
  } catch (error) {
    statusText.textContent = error.message || 'Could not delete request.';
    button.disabled = false;
  }
});
requestRows.addEventListener('change', async (event) => {
  const select = event.target.closest('.payment-status');
  if (!select) return;

  const referenceId = select.dataset.referenceId;
  const paymentStatus = select.value;
  select.disabled = true;
  statusText.textContent = `Updating ${referenceId} payment status...`;

  try {
    const response = await fetch(`/api/purchase-requests/${encodeURIComponent(referenceId)}`, {
      method: 'PATCH',
      headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ paymentStatus })
    });
    const data = await readJsonResponse(response);
    if (response.status === 401) {
      showLogin('Please log in again.');
      return;
    }
    if (!response.ok) throw new Error(data.error || 'Could not update payment status.');
    await loadRequests();
  } catch (error) {
    statusText.textContent = error.message || 'Could not update payment status.';
    select.disabled = false;
  }
});
loadRequests();
