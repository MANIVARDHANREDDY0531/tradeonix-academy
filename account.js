const authPanel = document.getElementById('authPanel');
const journalPanel = document.getElementById('journalPanel');
const authForm = document.getElementById('authForm');
const journalForm = document.getElementById('journalForm');
const authStatus = document.getElementById('authStatus');
const journalStatus = document.getElementById('journalStatus');
const nameField = document.getElementById('nameField');
const welcomeText = document.getElementById('welcomeText');
const entriesList = document.getElementById('entriesList');
const entryCount = document.getElementById('entryCount');
const logoutButton = document.getElementById('logoutButton');
const processScore = document.getElementById('processScore');
const totalTrades = document.getElementById('totalTrades');
const winRate = document.getElementById('winRate');
const netResult = document.getElementById('netResult');

let authMode = 'login';
let sessionToken = localStorage.getItem('tradeonix_session') || '';

function setStatus(element, message, isError = false) {
  element.textContent = message || '';
  element.style.color = isError ? '#ff8a75' : '#ffeaa2';
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

function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll('[data-auth-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.authTab === mode);
  });
  nameField.classList.toggle('hidden', mode === 'login');
  authForm.elements.password.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  authForm.querySelector('.primary-action').innerHTML = mode === 'login'
    ? 'Login to journal <span>&rarr;</span>'
    : 'Create account <span>&rarr;</span>';
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
        <div><b>${entry.market}</b><small>${formatDate(entry.tradeDate)} - ${entry.direction}</small></div>
        <div><b>${entry.setup || 'Setup not added'}</b><small>${entry.emotion || 'Emotion not added'}</small></div>
        <div><b class="${resultClass}">${result.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</b><small>${entry.riskReward || 'Risk reward not added'}</small></div>
        <button class="delete-entry" data-delete="${entry.id}" type="button">Delete</button>
        ${entry.notes ? `<p class="wide">${entry.notes}</p>` : ''}
      </article>
    `;
  }).join('');
}

async function loadJournal() {
  try {
    const data = await api('/api/journal');
    renderStats(data.entries || []);
    renderEntries(data.entries || []);
  } catch (error) {
    setStatus(journalStatus, error.message, true);
  }
}

document.querySelectorAll('[data-auth-tab]').forEach((button) => {
  button.addEventListener('click', () => setAuthMode(button.dataset.authTab));
});

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus(authStatus, 'Checking your account...');
  const formData = new FormData(authForm);
  const payload = Object.fromEntries(formData.entries());
  if (authMode === 'login') delete payload.name;
  try {
    const data = await api(authMode === 'login' ? '/api/login' : '/api/signup', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    sessionToken = data.token;
    localStorage.setItem('tradeonix_session', sessionToken);
    authForm.reset();
    showApp(data.user);
  } catch (error) {
    setStatus(authStatus, error.message, true);
  }
});

journalForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus(journalStatus, 'Saving trade...');
  try {
    const payload = Object.fromEntries(new FormData(journalForm).entries());
    await api('/api/journal', { method: 'POST', body: JSON.stringify(payload) });
    journalForm.reset();
    journalForm.elements.tradeDate.valueAsDate = new Date();
    setStatus(journalStatus, 'Trade saved.');
    loadJournal();
  } catch (error) {
    setStatus(journalStatus, error.message, true);
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
