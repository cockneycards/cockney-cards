const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const BASE_URL = 'https://www.cockneycards.com';
const dataSource = fs.readFileSync(path.join(ROOT, 'cards-data.js'), 'utf8');
const categorySource = fs.readFileSync(path.join(ROOT, 'categories-data.js'), 'utf8');

function loadGlobals(source, names) {
  const context = {};
  // cards-data.js assigns to window.CLOUD_BASE (so it can share a page with
  // prints-data.js without a duplicate-declaration error). Alias `window`
  // to the sandbox's own global object so that assignment also lands on
  // the bare identifier, which the extraction below relies on.
  context.window = context;
  vm.runInNewContext(source + '\n' + names.map(n => `globalThis.__${n} = ${n};`).join('\n'), context);
  return names.reduce((o, n) => (o[n] = context[`__${n}`], o), {});
}

const { CARD_CATALOGUE, CLOUD_BASE, DEFAULT_PRICE } = loadGlobals(dataSource, ['CARD_CATALOGUE', 'CLOUD_BASE', 'DEFAULT_PRICE']);
const { CARD_CATEGORIES } = loadGlobals(categorySource, ['CARD_CATEGORIES']);

function slugify(value) {
  return value
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'card';
}

function escHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function escJson(value) { return JSON.stringify(value).replace(/</g, '\\u003c'); }
function priceNumber(label) {
  const n = parseFloat(String(label).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

const labelMap = new Map();
function walk(nodes) {
  for (const node of nodes || []) {
    labelMap.set(node[0], node[1]);
    if (Array.isArray(node[2])) walk(node[2]);
  }
}
walk(CARD_CATEGORIES);

function categoryLabels(categories) {
  return (categories || []).filter(k => k !== 'all').map(k => labelMap.get(k)).filter(Boolean);
}
function descriptionFor(title, categories) {
  const labels = categoryLabels(categories);
  let context = labels.slice(0, 3).join(', ');
  let sentence = `Personalise the “${title}” greeting card from Cockney Cards online. Choose this design for a special celebration and customise it in our card editor before ordering.`;
  if (context) sentence += ` This design is listed under ${context}.`;
  return sentence;
}

const products = Object.entries(CARD_CATALOGUE)
  .filter(([id, c]) => c && c.title && c.preview)
  .map(([id, c]) => ({
    id, ...c,
    price: c.price || DEFAULT_PRICE,
    slug: slugify(c.title) + '-' + id,
  }));

// Use a stable, collision-free slug while keeping URLs readable.
const seen = new Map();
for (const p of products) {
  const base = slugify(p.title);
  const count = (seen.get(base) || 0) + 1;
  seen.set(base, count);
  p.slug = count === 1 ? base : `${base}-${count}`;
}

const cardsDir = path.join(ROOT, 'cards');
fs.rmSync(cardsDir, { recursive: true, force: true });
fs.mkdirSync(cardsDir, { recursive: true });

const manifest = {};

for (const p of products) {
  const dir = path.join(cardsDir, p.slug);
  fs.mkdirSync(dir, { recursive: true });
  const url = `${BASE_URL}/cards/${p.slug}/`;
  const image = `${CLOUD_BASE}${p.preview}`;
  const price = priceNumber(p.price);
  const description = descriptionFor(p.title, p.categories);
  const cats = categoryLabels(p.categories);
  const categoryText = cats.length ? cats.join(' · ') : 'Cockney Cards';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(p.title)} | Personalised Greeting Card | Cockney Cards</title>
  <meta name="description" content="${escHtml(description)}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="product">
  <meta property="og:title" content="${escHtml(p.title)} | Cockney Cards">
  <meta property="og:description" content="${escHtml(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${image}">
  <meta property="og:site_name" content="Cockney Cards">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escHtml(p.title)} | Cockney Cards">
  <meta name="twitter:description" content="${escHtml(description)}">
  <meta name="twitter:image" content="${image}">
  <link rel="stylesheet" href="../../card-page.css">
  <style>
    :root { --border-color: #e0e0e0; --font-family: 'Helvetica Neue', Arial, sans-serif; }
    header { background-color: white; padding: 15px 40px 10px 40px; border-bottom: 1px solid var(--border-color); }
    .header-top { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 20px; max-width: 1400px; margin: 0 auto; }
    .header-left { justify-self: end; padding-right: 20px; }
    .logo-container { justify-self: center; text-align: center; }
    .logo-container img { max-width: 120px; height: auto; cursor: pointer; }
    .header-right { justify-self: start; padding-left: 20px; display: flex; align-items: center; gap: 20px; }
    .cart-icon { position: relative; cursor: pointer; }
    .search-form { display: flex; align-items: center; border: 1px solid var(--border-color); border-radius: 20px; padding: 4px 6px 4px 14px; background: white; transition: border-color 0.2s; }
    .search-form:focus-within { border-color: #999; }
    .search-form input[type="search"] { border: none; outline: none; font-family: var(--font-family); font-size: 13px; color: #111; width: 160px; background: transparent; }
    .search-form input[type="search"]::placeholder { color: #999; }
    .search-form input[type="search"]::-webkit-search-cancel-button { cursor: pointer; }
    .search-form button { background: none; border: none; padding: 6px; margin: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; }
    .search-form button svg { stroke: #666; transition: stroke 0.2s; }
    .search-form button:hover svg { stroke: #111; }
    nav { margin-top: 15px; text-align: center; }
    .nav-links { display: inline-flex; gap: 30px; padding: 0; margin: 0; list-style: none; }
    .nav-links a { text-decoration: none; color: #111; font-size: 13px; letter-spacing: 1px; transition: color 0.2s; }
    .nav-links a:hover { color: #888; }
    .nav-links a.active { font-weight: bold; }
  </style>
  <link rel="stylesheet" href="/mobile.css">
  <script type="application/ld+json">${escJson({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.title,
    description,
    image: [image],
    url,
    brand: {'@type':'Brand', name:'Cockney Cards'},
    offers: {
      '@type':'Offer',
      url,
      priceCurrency:'GBP',
      price,
      availability:'https://schema.org/InStock'
    }
  })}</script>
</head>
<body>
  <header>
    <div class="header-top">
      <div class="header-left">
        <form class="search-form" role="search" action="/shop-cards.html" method="GET" onsubmit="return handleSiteSearch(event)">
          <input type="search" name="search" id="site-search-input" placeholder="Search for a card..." aria-label="Search for a card">
          <button type="submit" aria-label="Search" onclick="toggleMobileSearch(event)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>
        </form>
      </div>
      <div class="logo-container" onclick="window.location.href='/';">
        <img src="${CLOUD_BASE}logo.png" alt="Cockney Cards">
      </div>
      <div class="header-right">
        <div class="cart-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <path d="M16 10a4 4 0 0 1-8 0"></path>
          </svg>
        </div>
      </div>
    </div>
    <nav>
      <ul class="nav-links">
        <li><a href="/shop-cards.html">Shop Cards</a></li>
        <li><a href="/shop-prints.html">Shop Prints</a></li>
        <li><a href="/cockney-club.html">Cockney Club</a></li>
        <li><a href="/account.html">My Account</a></li>
      </ul>
    </nav>
  </header>


  <main class="product-page">
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/">Home</a><span>/</span><a href="/shop-cards.html">Cards</a><span>/</span><span aria-current="page">${escHtml(p.title)}</span>
    </nav>

    <section class="product-layout">
      <div class="product-image-panel">
        <img class="product-image" src="${image}" alt="${escHtml(p.title)} personalised greeting card" fetchpriority="high">
      </div>
      <div class="product-details">
        <p class="eyebrow">Cockney Cards</p>
        <h1>${escHtml(p.title)}</h1>
        <p class="price">${escHtml(p.price)}</p>
        <p class="description">${escHtml(description)}</p>
        <a class="personalise-button" href="/editor.html?card=${encodeURIComponent(p.id)}">Personalise this card</a>
        <p class="personalise-note">Use our online editor to personalise this design before ordering.</p>
        <div class="details-box">
          <strong>Card details</strong>
          <p>Design: ${escHtml(p.title)}</p>
          <p>Categories: ${escHtml(categoryText)}</p>
        </div>
      </div>
    </section>

    <section class="seo-copy">
      <h2>${escHtml(p.title)}</h2>
      <p>Looking for a personalised greeting card? The ${escHtml(p.title)} design is available from Cockney Cards and can be customised online before you place your order.</p>
      <p>When you are ready, select <strong>Personalise this card</strong> to open the existing Cockney Cards card editor and add your personal details.</p>
      <p><a href="/shop-cards.html">Browse all Cockney Cards</a> to see more designs.</p>
    </section>
  </main>

  <footer class="site-footer">© 2026 Cockney Cards.</footer>

  <script src="/auth.js"></script>
  <script src="/cart.js"></script>
  <script>
    // Mirrors index.html's search-toggle behaviour so the collapsed
    // mobile search icon (see mobile.css) works the same on every page.
    const isMobileSearchLayout = () => window.matchMedia('(max-width: 640px)').matches;
    function toggleMobileSearch(event) {
      if (!isMobileSearchLayout()) return;
      const wrapper = document.querySelector('.header-left');
      if (!wrapper.classList.contains('search-active')) {
        event.preventDefault();
        wrapper.classList.add('search-active');
        document.getElementById('site-search-input').focus();
      }
    }
    document.addEventListener('click', (event) => {
      if (!isMobileSearchLayout()) return;
      const wrapper = document.querySelector('.header-left');
      if (wrapper.classList.contains('search-active') && !wrapper.contains(event.target)) {
        wrapper.classList.remove('search-active');
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const wrapper = document.querySelector('.header-left');
      if (wrapper.classList.contains('search-active')) {
        wrapper.classList.remove('search-active');
      }
    });
    function handleSiteSearch(event) {
      const input = document.getElementById('site-search-input');
      const value = input.value.trim();
      if (!value) { event.preventDefault(); return false; }
      input.value = value;
      return true;
    }
  </script>

  <script>window.CURRENT_CARD_ID = ${JSON.stringify(p.id)};</script>
  <script src="../../cards-data.js"></script>
  <script src="../../related-cards.js"></script>
</body>
</html>`;

  fs.writeFileSync(path.join(dir, 'index.html'), html);
  manifest[p.id] = { slug: p.slug, url, title: p.title, image, price: p.price, categories: p.categories };
}

fs.writeFileSync(path.join(cardsDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

// Regenerate card-pages.js (CARD_PAGE_SLUGS) from the same slugs used to
// build the pages above, so shop-cards.html's `CARD_PAGE_SLUGS[p.id]`
// lookup can never drift out of sync with the actual /cards/<slug>/ pages
// -- previously this file was a static, hand-maintained snapshot that
// silently went stale for any card added after it was last generated.
const slugEntries = products.map(p => `  ${JSON.stringify(p.id)}: ${JSON.stringify(p.slug)}`).join(',\n');
const cardPagesJs = `// Generated from cards-data.js. Maps each card id to its crawlable SEO page.
const CARD_PAGE_SLUGS = {
${slugEntries}
};
`;
fs.writeFileSync(path.join(ROOT, 'card-pages.js'), cardPagesJs);

console.log(`Generated ${products.length} individual card pages in ${cardsDir}`);
console.log(`Regenerated card-pages.js (${products.length} slugs) so shop-cards.html links stay in sync.`);
