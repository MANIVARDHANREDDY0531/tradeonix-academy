const indiaNewsList = document.querySelector('#indiaNewsList');
const cryptoNewsList = document.querySelector('#cryptoNewsList');
const forexNewsList = document.querySelector('#forexNewsList');
const globalNewsList = document.querySelector('#globalNewsList');
const newsPageUpdated = document.querySelector('#newsPageUpdated');
const newsPageRefresh = document.querySelector('#newsPageRefresh');

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function timeAgo(value) {
  const published = value ? new Date(value).getTime() : 0;
  if (!published || Number.isNaN(published)) return 'Live update';
  const minutes = Math.max(1, Math.round((Date.now() - published) / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} day ago`;
}

function renderList(container, items, category) {
  const fallback = [{
    category,
    title: getFallbackTitle(category),
    source: 'TRADEONIX market brief',
    url: 'black-gold-version.html#courses'
  }];
  const cleanItems = items.length ? items : fallback;
  container.innerHTML = cleanItems.map((item) => `
    <article class="news-item ${category.toLowerCase()}">
      <b>${escapeHtml(item.category || category)}</b>
      <h2><a href="${escapeHtml(item.url || '#')}" target="${item.url && item.url.startsWith('http') ? '_blank' : '_self'}" rel="noopener">${escapeHtml(item.title)}</a></h2>
      <p>${escapeHtml(item.source || 'Market news')} · ${escapeHtml(timeAgo(item.publishedAt))}</p>
    </article>
  `).join('');
}

function getFallbackTitle(category) {
  const titles = {
    India: 'Nifty, Bank Nifty, RBI cues, rupee, and sector rotation remain key Indian market watchpoints.',
    Crypto: 'Crypto traders are watching Bitcoin, Ethereum, ETF flows, liquidity, and risk sentiment.',
    Forex: 'Forex markets are tracking USD/INR, dollar index, yields, crude oil, and central-bank guidance.',
    Global: 'Global traders are watching US yields, gold, crude oil, equities, and central-bank commentary.'
  };
  return titles[category] || titles.Global;
}

function hasCategory(item, category) {
  return String(item.category || '').toLowerCase().includes(category.toLowerCase());
}

async function loadNewsPage() {
  newsPageRefresh.disabled = true;
  newsPageUpdated.textContent = 'Refreshing...';
  try {
    const response = await fetch('/api/market-news', { cache: 'no-store' });
    if (!response.ok) throw new Error('News unavailable');
    const data = await response.json();
    const items = data.items || [];
    renderList(indiaNewsList, items.filter((item) => hasCategory(item, 'India')), 'India');
    renderList(cryptoNewsList, items.filter((item) => hasCategory(item, 'Crypto')), 'Crypto');
    renderList(forexNewsList, items.filter((item) => hasCategory(item, 'Forex')), 'Forex');
    renderList(globalNewsList, items.filter((item) => hasCategory(item, 'Global')), 'Global');
    newsPageUpdated.textContent = data.updatedAt
      ? `Updated ${new Date(data.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : 'Live updates';
  } catch (error) {
    renderList(indiaNewsList, [], 'India');
    renderList(cryptoNewsList, [], 'Crypto');
    renderList(forexNewsList, [], 'Forex');
    renderList(globalNewsList, [], 'Global');
    newsPageUpdated.textContent = 'Showing market brief';
  } finally {
    newsPageRefresh.disabled = false;
  }
}

newsPageRefresh.addEventListener('click', loadNewsPage);
loadNewsPage();
setInterval(loadNewsPage, 600000);
