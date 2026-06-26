const menuButton = document.querySelector('#menuButton');
const navLinks = document.querySelector('#navLinks');

menuButton.addEventListener('click', () => {
  const isOpen = navLinks.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(isOpen));
});

navLinks.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
  });
});

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;

    event.preventDefault();
    navLinks.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');

    const headerHeight = document.querySelector('.nav-wrap')?.offsetHeight || 0;
    const top = target.getBoundingClientRect().top + window.scrollY - headerHeight - 18;
    window.scrollTo({ top, behavior: 'smooth' });

    window.setTimeout(() => {
      if (window.location.hash) {
        history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      }
    }, 450);
  });
});

document.querySelectorAll('.enroll-box[href]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const targetUrl = link.getAttribute('href');
    if (!targetUrl || targetUrl.startsWith('#')) return;
    event.preventDefault();
    window.location.assign(targetUrl);
  });
});

document.querySelectorAll('details').forEach((item) => {
  item.addEventListener('toggle', () => {
    if (!item.open) return;
    document.querySelectorAll('details').forEach((other) => {
      if (other !== item) other.open = false;
    });
  });
});

const carousel = document.querySelector('#marketCarousel');
const marketTrack = document.querySelector('#marketTrack');
const marketSlides = [...document.querySelectorAll('.market-slide')];
const marketDots = [...document.querySelectorAll('.market-pagination button')];
let activeMarket = 0;
let swipeStart = 0;
let swipeDelta = 0;

function showMarket(index) {
  activeMarket = (index + marketSlides.length) % marketSlides.length;
  marketTrack.style.transform = `translateX(-${activeMarket * 100}%)`;
  marketDots.forEach((dot, i) => {
    dot.classList.toggle('active', i === activeMarket);
    dot.setAttribute('aria-selected', String(i === activeMarket));
  });
}

document.querySelector('#marketPrev').addEventListener('click', () => showMarket(activeMarket - 1));
document.querySelector('#marketNext').addEventListener('click', () => showMarket(activeMarket + 1));
marketDots.forEach((dot) => dot.addEventListener('click', () => showMarket(Number(dot.dataset.index))));
carousel.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') showMarket(activeMarket - 1);
  if (event.key === 'ArrowRight') showMarket(activeMarket + 1);
});
carousel.addEventListener('pointerdown', (event) => {
  swipeStart = event.clientX;
  swipeDelta = 0;
  carousel.setPointerCapture(event.pointerId);
});
carousel.addEventListener('pointermove', (event) => {
  if (!swipeStart) return;
  swipeDelta = event.clientX - swipeStart;
});
carousel.addEventListener('pointerup', () => {
  if (Math.abs(swipeDelta) > 45) showMarket(activeMarket + (swipeDelta < 0 ? 1 : -1));
  swipeStart = 0;
  swipeDelta = 0;
});

const feeds = {
  nifty: {
    url: '/api/market-data?market=nifty',
    parse(data) { return data; }
  },
  gold: {
    url: '/api/market-data?market=gold',
    parse(data) { return data; }
  },
  bitcoin: {
    url: '/api/market-data?market=bitcoin',
    parse(data) { return data; }
  }
};

function makeSparkline(price, change = 0) {
  const start = price / (1 + (Number(change) || 0) / 100);
  return Array.from({ length: 24 }, (_, i) => start + (price - start) * (i / 23));
}

const fallbackFeeds = {
  nifty: { price: 25112.40, change: 0.42, prices: makeSparkline(25112.40, 0.42), decimals: 2, lastPrice: true },
  banknifty: { price: 56825.20, change: 0.36, prices: makeSparkline(56825.20, 0.36), decimals: 2, lastPrice: true },
  gold: { price: 4191.50, change: 0.18, prices: makeSparkline(4191.50, 0.18), decimals: 2, lastPrice: true },
  bitcoin: { price: 104250.00, change: -0.31, prices: makeSparkline(104250.00, -0.31), decimals: 2 }
};

const headerMarketFeeds = {
  nifty: '/api/market-data?market=nifty',
  banknifty: '/api/market-data?market=banknifty',
  bitcoin: '/api/market-data?market=bitcoin',
  gold: '/api/market-data?market=gold'
};

function formatMarketPrice(quote) {
  const decimals = Number.isInteger(quote.decimals) ? quote.decimals : 2;
  return Number(quote.price).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function renderHeaderMarket(name, quote) {
  document.querySelectorAll(`.header-market-item[data-market="${name}"]`).forEach((item) => {
    const price = item.querySelector('strong');
    const change = item.querySelector('em');
    price.textContent = formatMarketPrice(quote);
    if (quote.lastPrice) {
      change.textContent = 'LAST';
      change.classList.remove('negative');
    } else if (Number.isFinite(quote.change)) {
      change.textContent = `${quote.change >= 0 ? '+' : ''}${quote.change.toFixed(2)}%`;
      change.classList.toggle('negative', quote.change < 0);
    } else {
      change.textContent = 'LIVE';
      change.classList.remove('negative');
    }
  });
}

async function updateHeaderMarket(name) {
  try {
    const response = await fetch(headerMarketFeeds[name], { cache: 'no-store' });
    if (!response.ok) throw new Error(`Market ${response.status}`);
    renderHeaderMarket(name, await response.json());
  } catch (error) {
    renderHeaderMarket(name, fallbackFeeds[name]);
  }
}

function updateHeaderMarkets() {
  Object.keys(headerMarketFeeds).forEach(updateHeaderMarket);
}

function chartPath(values) {
  const clean = values.filter(Number.isFinite);
  if (clean.length < 2) return null;
  const sampled = clean.filter((_, i) => i % Math.max(1, Math.floor(clean.length / 45)) === 0).slice(-46);
  const min = Math.min(...sampled);
  const max = Math.max(...sampled);
  const spread = max - min || 1;
  const points = sampled.map((value, i) => [i * (620 / (sampled.length - 1)), 220 - ((value - min) / spread) * 180]);
  const line = `M${points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')}`;
  return { line, area: `${line} L620,260 L0,260 Z`, end: points.at(-1) };
}

function renderMarket(slide, quote) {
  if (!Number.isFinite(quote.price)) throw new Error('Price unavailable');
  const path = chartPath(quote.prices);
  slide.classList.remove('loading', 'error', 'preview');
  slide.classList.toggle('preview', quote.preview === true || quote.lastPrice === true);
  slide.querySelector('.live-price').textContent = quote.price.toLocaleString('en-US', { minimumFractionDigits: quote.decimals, maximumFractionDigits: quote.decimals });
  const change = slide.querySelector('.live-change');
  change.textContent = quote.lastPrice ? 'LAST PRICE' : quote.preview ? 'PREVIEW' : Number.isFinite(quote.change) ? `${quote.change >= 0 ? '+' : ''}${quote.change.toFixed(2)}%` : 'LIVE';
  change.classList.toggle('negative', !quote.preview && !quote.lastPrice && quote.change < 0);
  if (path) {
    slide.querySelector('.live-line').setAttribute('d', path.line);
    slide.querySelector('.live-area').setAttribute('d', path.area);
    slide.querySelector('.live-dot').setAttribute('cx', path.end[0]);
    slide.querySelector('.live-dot').setAttribute('cy', path.end[1]);
  }
  slide.querySelector('.updated-time').textContent = quote.lastPrice ? 'Last close' : quote.preview ? 'Preview' : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function updateFeed(name) {
  const slide = document.querySelector(`[data-market="${name}"]`);
  slide.classList.add('loading');
  try {
    const response = await fetch(feeds[name].url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Feed ${response.status}`);
    renderMarket(slide, feeds[name].parse(await response.json()));
    return true;
  } catch (error) {
    renderMarket(slide, { ...fallbackFeeds[name], preview: true, lastPrice: name !== 'bitcoin' });
    return false;
  }
}

async function updateAllMarkets() {
  const results = await Promise.all(Object.keys(feeds).map(updateFeed));
  const feedState = document.querySelector('.feed-state');
  const online = results.filter(Boolean).length;
  feedState.classList.remove('error');
  document.querySelector('#feedLabel').textContent = online ? `LIVE MARKET • ${online}/3 FEEDS` : 'LAST MARKET PRICE';
}

showMarket(0);
updateAllMarkets();
setInterval(updateAllMarkets, 30000);
updateHeaderMarkets();
setInterval(updateHeaderMarkets, 20000);

function ensureMarketNewsSection() {
  const courses = document.querySelector('#courses');
  if (!courses || document.querySelector('#market-news')) return;
  const section = document.createElement('section');
  section.className = 'market-news section container';
  section.id = 'market-news';
  section.innerHTML = `
    <div class="section-heading news-heading"><div><div class="eyebrow muted">Live market brief</div><h2>Financial news<br><em>made readable.</em></h2></div><p>Quick updates for Indian stocks, crypto, forex, commodities, and global markets from multiple live news sources.</p></div>
    <div class="news-shell">
      <div class="news-ticker" aria-label="Live financial market news ticker">
        <div class="news-ticker-track" id="newsTickerTrack">
          <span>Loading India and global market headlines...</span>
          <span>Loading India and global market headlines...</span>
        </div>
      </div>
      <div class="news-toolbar">
        <div><span class="news-live-dot"></span><strong>Multi-source briefing</strong><small id="newsUpdated">Refreshing...</small></div>
        <div class="news-actions"><a class="news-open-page" href="news.html">Open full news</a><button class="news-refresh" id="newsRefresh" type="button">Refresh</button></div>
      </div>
      <div class="news-grid" id="newsGrid">
        <article class="news-card loading"><span>India</span><h3>Loading Indian market headlines...</h3><p>Connecting to live news feed.</p><b>Read update</b></article>
        <article class="news-card loading"><span>Global</span><h3>Loading crypto, forex, and global headlines...</h3><p>Connecting to live news feed.</p><b>Read update</b></article>
      </div>
    </div>
  `;
  courses.insertAdjacentElement('afterend', section);
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

function renderMarketNews(items = [], updatedAt) {
  const grid = document.querySelector('#newsGrid');
  const ticker = document.querySelector('#newsTickerTrack');
  const updated = document.querySelector('#newsUpdated');
  if (!grid || !ticker) return;
  const cleanItems = items.length ? items : [
    { category: 'India', title: 'Nifty, Bank Nifty, RBI cues, and sector rotation remain in focus.', source: 'TRADEONIX market brief', url: '#courses' },
    { category: 'Global', title: 'Global markets watch US yields, gold, crude oil, and dollar movement.', source: 'TRADEONIX market brief', url: '#courses' }
  ];
  grid.innerHTML = cleanItems.slice(0, 6).map((item) => `
    <article class="news-card ${String(item.category || '').toLowerCase().includes('india') ? 'india-news' : 'global-news'}">
      <span>${escapeNews(item.category || 'Market')}</span>
      <h3><a href="${escapeNews(item.url || '#')}" target="${item.url && item.url.startsWith('http') ? '_blank' : '_self'}" rel="noopener">${escapeNews(item.title)}</a></h3>
      <p>${escapeNews(item.source || 'Market news')} · ${escapeNews(timeAgo(item.publishedAt))}</p>
      <b>Read update</b>
    </article>
  `).join('');
  const tickerText = cleanItems.slice(0, 8).map((item) => `${item.category || 'Market'}: ${item.title}`).join('   •   ');
  ticker.innerHTML = `<span>${escapeNews(tickerText)}</span><span>${escapeNews(tickerText)}</span>`;
  if (updated) updated.textContent = updatedAt ? `Updated ${new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Live updates';
}

function escapeNews(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function updateMarketNews() {
  ensureMarketNewsSection();
  try {
    const response = await fetch('/api/market-news', { cache: 'no-store' });
    if (!response.ok) throw new Error('News unavailable');
    const data = await response.json();
    renderMarketNews(data.items, data.updatedAt);
  } catch (error) {
    renderMarketNews();
  }
}

ensureMarketNewsSection();
document.querySelector('#newsRefresh')?.addEventListener('click', updateMarketNews);
updateMarketNews();
setInterval(updateMarketNews, 600000);

const revealItems = document.querySelectorAll('.section-heading, .course-card, .news-card, .step, .market-brand-strip, .market-focus-card, .lead-panel, .testimonial-grid blockquote, .faq details, .cta-inner > div');
if ('IntersectionObserver' in window) {
  revealItems.forEach((item) => item.classList.add('reveal-ready'));
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.14 });
  revealItems.forEach((item) => revealObserver.observe(item));
}

const checkoutDrawer = document.querySelector('#checkout');
const checkoutForm = document.querySelector('#checkoutForm');
const checkoutPlan = document.querySelector('#checkoutPlan');
const checkoutStatus = document.querySelector('#checkoutStatus');
const checkoutClose = document.querySelector('.checkout-close');
const purchaseRequestEndpoint = window.location.protocol === 'file:'
  ? 'http://127.0.0.1:8768/api/purchase-requests'
  : '/api/purchase-requests';

function formatPlanPrice(price) {
  const amount = Number(price);
  if (!amount) return 'Our team will help you choose the right plan.';
  return `Plan amount: Rs. ${amount.toLocaleString('en-IN')}`;
}

function openCheckout(trigger) {
  if (!checkoutDrawer || !checkoutForm) return;
  checkoutForm.reset();
  checkoutStatus.textContent = '';
  checkoutForm.planId.value = trigger.dataset.planId || '';
  checkoutForm.planName.value = trigger.dataset.planName || '';
  checkoutForm.planPrice.value = trigger.dataset.planPrice || '0';
  checkoutPlan.textContent = `${checkoutForm.planName.value}. ${formatPlanPrice(checkoutForm.planPrice.value)}`;
  checkoutDrawer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('checkout-open');
  checkoutForm.name.focus();
}

function closeCheckout() {
  if (!checkoutDrawer) return;
  checkoutDrawer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('checkout-open');
}

document.querySelectorAll('.purchase-trigger').forEach((trigger) => {
  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    openCheckout(trigger);
  });
});

checkoutClose?.addEventListener('click', closeCheckout);
checkoutDrawer?.addEventListener('click', (event) => {
  if (event.target === checkoutDrawer) closeCheckout();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeCheckout();
});

checkoutForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  checkoutStatus.textContent = 'Submitting your request...';
  const submitButton = checkoutForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const payload = Object.fromEntries(new FormData(checkoutForm).entries());
    const response = await fetch(purchaseRequestEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to submit request');
    checkoutStatus.textContent = `Request received. Reference: ${result.referenceId}`;
    checkoutForm.reset();
  } catch (error) {
    checkoutStatus.textContent = error.message || 'Please try again in a moment.';
  } finally {
    submitButton.disabled = false;
  }
});
