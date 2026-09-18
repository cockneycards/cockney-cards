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
  <header class="site-header">
    <a class="logo" href="/" aria-label="Cockney Cards home">
      <img src="${CLOUD_BASE}logo.png" alt="Cockney Cards">
    </a>
    <nav aria-label="Main navigation">
      <a href="/shop-cards.html">Shop Cards</a>
      <a href="/shop-prints.html">Shop Prints</a>
      <a href="/cockney-club.html">Cockney Club</a>
      <a href="/account.html">My Account</a>
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

  <script>window.CURRENT_CARD_ID = ${JSON.stringify(p.id)};</script>
  <script src="../../cards-data.js"></script>
  <script src="../../related-cards.js"></script>
</body>
</html>`;

  fs.writeFileSync(path.join(dir, 'index.html'), html);
  manifest[p.id] = { slug: p.slug, url, title: p.title, image, price: p.price, categories: p.categories };
}

fs.writeFileSync(path.join(cardsDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Generated ${products.length} individual card pages in ${cardsDir}`);
