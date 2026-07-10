const authPanel = document.getElementById('authPanel');
const journalPanel = document.getElementById('journalPanel');
const authForm = document.getElementById('authForm');
const journalForm = document.getElementById('journalForm');
const authStatus = document.getElementById('authStatus');
const journalStatus = document.getElementById('journalStatus');
const nameField = document.getElementById('nameField');
const otpField = document.getElementById('otpField');
const confirmPasswordField = document.getElementById('confirmPasswordField');
const forgotPasswordButton = document.getElementById('forgotPasswordButton');
const backToLoginButton = document.getElementById('backToLoginButton');
const welcomeText = document.getElementById('welcomeText');
const entriesList = document.getElementById('entriesList');
const entryCount = document.getElementById('entryCount');
const logoutButton = document.getElementById('logoutButton');
const processScore = document.getElementById('processScore');
const totalTrades = document.getElementById('totalTrades');
const winRate = document.getElementById('winRate');
const netResult = document.getElementById('netResult');

let authMode = 'login';
let pendingSignup = null;
let resetEmail = '';
let sessionToken = localStorage.getItem('tradeonix_session') || '';

function setStatus(element, message, isError = false) {
  element.textContent = message || '';
  element.style.color = isError ? '#ff8a75' : '#ffeaa2';
}

function normalizePassword(value) {
  return String(value || '').trim();
}

function setBusy(container, button, busy, message = 'Please wait...') {
  container.classList.toggle('is-loading', busy);
  if (!button) return;
  if (busy) {
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="button-loader" aria-hidden="true"></span>${message}`;
    return;
  }
  button.disabled = false;
  if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
  delete button.dataset.originalHtml;
}

function authHeaders() {
  return sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {};
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function updateRequiredFields() {
  const needsConfirmPassword = authMode === 'signup' || authMode === 'reset-password';
  authForm.elements.name.required = authMode === 'signup';
  authForm.elements.otp.required = authMode === 'verify-signup' || authMode === 'reset-password';
  authForm.elements.password.required = authMode !== 'forgot';
  authForm.elements.confirmPassword.required = needsConfirmPassword;
}

function applyAuthButtonLabel() {
  const button = authForm.querySelector('.primary-action');
  const labels = {
    login: 'Login to journal <span>&rarr;</span>',
    signup: 'Send signup OTP <span>&rarr;</span>',
    'verify-signup': 'Verify OTP & create account <span>&rarr;</span>',
    forgot: 'Send reset OTP <span>&rarr;</span>',
    'reset-password': 'Reset password <span>&rarr;</span>'
  };
  button.innerHTML = labels[authMode] || labels.login;
}

function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll('[data-auth-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.authTab === mode);
  });

  nameField.classList.toggle('hidden', mode !== 'signup');
  otpField.classList.toggle('hidden', mode !== 'verify-signup' && mode !== 'reset-password');
  confirmPasswordField.classList.toggle('hidden', mode !== 'signup' && mode !== 'reset-password');
  forgotPasswordButton.classList.toggle('hidden', mode !== 'login');
  backToLoginButton.classList.toggle('hidden', mode === 'login');

  const passwordLabel = authForm.elements.password.closest('label');
  passwordLabel.classList.toggle('hidden', mode === 'forgot');
  authForm.elements.password.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  authForm.elements.password.placeholder = mode === 'reset-password' ? 'Enter new password' : '';
  authForm.elements.confirmPassword.placeholder = mode === 'reset-password' ? 'Confirm new password' : '';

  const emailInput = authForm.elements.email;
  emailInput.readOnly = mode === 'verify-signup' || mode === 'reset-password';

  applyAuthButtonLabel();
  updateRequiredFields();
  setStatus(authStatus, '');
}

function showApp(user) {
  authPanel.classList.add('hidden');
  journalPanel.classList.remove('hidden');
  welcomeText.textContent = `Welcome, ${user.name.split(' ')[0] || user.name}`;
  loadJournal();
}

function showAuth() {
  authPanel.classList.remove('hidden');
  journalPanel.classList.add('hidden');
  sessionToken = '';
  localStorage.removeItem('tradeonix_session');
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function renderStats(entries) {
  const total = entries.length;
  const wins = entries.filter((entry) => Number(entry.result) > 0).length;
  const result = entries.reduce((sum, entry) => sum + (Number(entry.result) || 0), 0);
  const rate = total ? Math.round((wins / total) * 100) : 0;
  const score = Math.min(100, Math.round((total / 20) * 100));
  totalTrades.textContent = total;
  winRate.textContent = `${rate}%`;
  netResult.textContent = result.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  processScore.textContent = `${score}%`;
  entryCount.textContent = total ? `${total} saved trade${total === 1 ? '' : 's'}` : 'No trades yet';
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function renderEntries(entries) {
  if (!entries.length) {
    entriesList.innerHTML = '<div class="entry-card"><div><b>No journal entries yet.</b><p>Add your first trade after market review.</p></div></div>';
    return;
  }
  entriesList.innerHTML = entries.map((entry) => {
    const result = Number(entry.result) || 0;
    const resultClass = result > 0 ? 'profit' : result < 0 ? 'loss' : '';
    return `
      <article class="entry-card">
        <div><b>${escapeHtml(entry.market)}</b><small>${formatDate(entry.tradeDate)} - ${escapeHtml(entry.direction)}</small></div>
        <div><b>${escapeHtml(entry.setup || 'Setup not added')}</b><small>${escapeHtml(entry.emotion || 'Emotion not added')}</small></div>
        <div><b class="${resultClass}">${result.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</b><small>${escapeHtml(entry.riskReward || 'Risk reward not added')}</small></div>
        <button class="delete-entry" data-delete="${entry.id}" type="button">Delete</button>
        ${entry.notes ? `<p class="wide">${escapeHtml(entry.notes)}</p>` : ''}
      </article>
    `;
  }).join('');
}

async function loadJournal() {
  try {
    setStatus(journalStatus, 'Loading journal...');
    const data = await api('/api/journal');
    renderStats(data.entries || []);
    renderEntries(data.entries || []);
    setStatus(journalStatus, '');
  } catch (error) {
    setStatus(journalStatus, error.message, true);
  }
}

async function completeLogin(payload) {
  payload.password = normalizePassword(payload.password);
  const data = await api('/api/login', { method: 'POST', body: JSON.stringify(payload) });
  sessionToken = data.token;
  localStorage.setItem('tradeonix_session', sessionToken);
  authForm.reset();
  showApp(data.user);
}

async function requestSignupOtp(payload) {
  payload.password = normalizePassword(payload.password);
  pendingSignup = { name: payload.name, email: payload.email, password: payload.password };
  await api('/api/auth/request-signup-otp', { method: 'POST', body: JSON.stringify(pendingSignup) });
  authForm.elements.otp.value = '';
  setAuthMode('verify-signup');
  setStatus(authStatus, 'OTP sent. Check your email and enter the 6 digit code.');
}

async function verifySignupOtp(payload) {
  const data = await api('/api/auth/verify-signup-otp', {
    method: 'POST',
    body: JSON.stringify({ email: pendingSignup?.email || payload.email, otp: payload.otp })
  });
  sessionToken = data.token;
  localStorage.setItem('tradeonix_session', sessionToken);
  pendingSignup = null;
  authForm.reset();
  showApp(data.user);
}

async function requestResetOtp(payload) {
  resetEmail = payload.email;
  await api('/api/auth/request-password-reset', {
    method: 'POST',
    body: JSON.stringify({ email: resetEmail })
  });
  authForm.elements.otp.value = '';
  authForm.elements.password.value = '';
  authForm.elements.confirmPassword.value = '';
  setAuthMode('reset-password');
  setStatus(authStatus, 'Reset OTP sent. Check your email and enter the 6 digit code.');
}

async function resetPassword(payload) {
  payload.password = normalizePassword(payload.password);
  await api('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email: resetEmail || payload.email, otp: payload.otp, password: payload.password })
  });
  authForm.reset();
  resetEmail = '';
  setAuthMode('login');
  setStatus(authStatus, 'Password changed. Please login with the new password.');
}

document.querySelectorAll('[data-auth-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    pendingSignup = null;
    resetEmail = '';
    authForm.reset();
    authForm.elements.email.readOnly = false;
    setAuthMode(button.dataset.authTab);
  });
});

forgotPasswordButton.addEventListener('click', () => {
  pendingSignup = null;
  authForm.reset();
  setAuthMode('forgot');
});

backToLoginButton.addEventListener('click', () => {
  pendingSignup = null;
  resetEmail = '';
  authForm.reset();
  authForm.elements.email.readOnly = false;
  setAuthMode('login');
});

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = authForm.querySelector('.primary-action');
  const payload = Object.fromEntries(new FormData(authForm).entries());
  payload.email = String(payload.email || '').toLowerCase().trim();
  payload.otp = String(payload.otp || '').trim();
  payload.password = normalizePassword(payload.password);
  payload.confirmPassword = normalizePassword(payload.confirmPassword);
  const busyLabels = {
    login: 'Opening journal...',
    signup: 'Sending OTP...',
    'verify-signup': 'Verifying OTP...',
    forgot: 'Sending reset OTP...',
    'reset-password': 'Updating password...'
  };
  try {
    if ((authMode === 'signup' || authMode === 'reset-password') && payload.password !== payload.confirmPassword) {
      throw new Error('Password and confirm password do not match.');
    }
    setStatus(authStatus, busyLabels[authMode] || 'Please wait...');
    setBusy(authForm, button, true, busyLabels[authMode]);
    if (authMode === 'login') await completeLogin(payload);
    if (authMode === 'signup') await requestSignupOtp(payload);
    if (authMode === 'verify-signup') await verifySignupOtp(payload);
    if (authMode === 'forgot') await requestResetOtp(payload);
    if (authMode === 'reset-password') await resetPassword(payload);
  } catch (error) {
    setStatus(authStatus, error.message, true);
  } finally {
    setBusy(authForm, button, false);
    applyAuthButtonLabel();
  }
});

journalForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = journalForm.querySelector('.primary-action');
  setStatus(journalStatus, 'Saving trade...');
  setBusy(journalForm, button, true, 'Saving trade...');
  try {
    const payload = Object.fromEntries(new FormData(journalForm).entries());
    await api('/api/journal', { method: 'POST', body: JSON.stringify(payload) });
    journalForm.reset();
    journalForm.elements.tradeDate.valueAsDate = new Date();
    setStatus(journalStatus, 'Trade saved.');
    loadJournal();
  } catch (error) {
    setStatus(journalStatus, error.message, true);
  } finally {
    setBusy(journalForm, button, false);
  }
});

entriesList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-delete]');
  if (!button) return;
  try {
    await api(`/api/journal/${encodeURIComponent(button.dataset.delete)}`, { method: 'DELETE' });
    loadJournal();
  } catch (error) {
    setStatus(journalStatus, error.message, true);
  }
});

logoutButton.addEventListener('click', async () => {
  try {
    await api('/api/logout', { method: 'POST' });
  } catch (error) {
    // Local logout should still happen even if the server call fails.
  }
  showAuth();
});

async function boot() {
  setAuthMode('login');
  if (journalForm.elements.tradeDate) journalForm.elements.tradeDate.valueAsDate = new Date();
  if (!sessionToken) return;
  try {
    const data = await api('/api/me');
    showApp(data.user);
  } catch (error) {
    showAuth();
  }
}

boot();
