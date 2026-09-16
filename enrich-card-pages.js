/**
 * enrich-card-pages.js
 * ------------------------------------------------------------------
 * The /cards/<slug>/index.html pages already have the right bones —
 * title, canonical, OG tags, Product schema, a real <img>, a real
 * <h1>. The thing working against them is the copy: every single
 * page currently says almost exactly the same three sentences, with
 * only the product name and category name swapped in:
 *
 *   "Personalise the '<title>' greeting card from Cockney Cards
 *    online. Choose this design for a special celebration and
 *    customise it in our card editor before ordering. This design
 *    is listed under <categories>."
 *
 * That's not a technical problem (Google will happily fetch and
 * index all 200), it's a THIN CONTENT problem — there's barely any
 * real information here that's actually specific to this product, so
 * there's very little for Google to reward with a ranking. This
 * script rewrites that copy using facts already sitting in
 * cards-data.js (what fields the card actually supports — a name, an
 * age, a shirt number, a photo, an event/date/time trio — and its
 * full category list) so each page says something genuinely true and
 * specific about that one product, rather than a mad-lib.
 *
 * It also:
 *  - adds BreadcrumbList JSON-LD matching the visible breadcrumb
 *  - writes fuller, more specific image alt text
 *  - adds a "You might also like" block linking to sibling cards in
 *    the same category, for internal linking between product pages
 *
 * It edits the HTML files in place — nothing about the URLs, the
 * <title>, canonical, or the surrounding page chrome changes.
 *
 * HOW TO RUN
 *   node enrich-card-pages.js
 * Run it from the folder that contains cards-data.js AND the /cards/
 * folder (the unzipped contents of cards.zip, alongside cards-data.js
 * copied in next to it). Commit the result.
 * ------------------------------------------------------------------
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_DIR = __dirname;
const CARDS_DIR = path.join(REPO_DIR, 'cards');

function loadCatalogue(filename) {
    const filePath = path.join(REPO_DIR, filename);
    if (!fs.existsSync(filePath)) return null;
    const code = fs.readFileSync(filePath, 'utf8');
    const extract = `
;globalThis.__extracted = {
  CARD_CATALOGUE: typeof CARD_CATALOGUE !== 'undefined' ? CARD_CATALOGUE : undefined,
};`;
    const sandbox = {};
    vm.createContext(sandbox);
    vm.runInContext(code + extract, sandbox, { filename });
    return (sandbox.__extracted || {}).CARD_CATALOGUE || null;
}

const catalogue = loadCatalogue('cards-data.js');
if (!catalogue) {
    console.error('Could not find CARD_CATALOGUE in cards-data.js — aborting.');
    process.exit(1);
}

const CATEGORY_LABELS = {
    'all': null, 'achievements': 'Achievement', 'arsenal': 'Arsenal', 'arsenalw': 'Arsenal Women',
    'birthday': 'Birthday', 'birthdays': 'Birthday', 'boxing': 'Boxing', 'brightonw': 'Brighton Women',
    'cardiff': 'Cardiff', 'championship': 'Championship', 'charlton': 'Charlton', 'chelsea': 'Chelsea',
    'children': "Children's", 'christmas': 'Christmas', 'cricket': 'Cricket', 'dad': 'Dad', 'darts': 'Darts',
    'football': 'Football', 'formula1': 'F1', 'golf': 'Golf', 'grandad': 'Grandad', 'home': null,
    'horseracing': 'Horse Racing', 'liverpool': 'Liverpool', 'liverpoolw': 'Liverpool Women',
    'london-cityw': 'London City Women', 'man-cityw': 'Man City Women', 'man-utdw': 'Man Utd Women',
    'middlesbrough': 'Middlesbrough', 'milddlesbrough': 'Middlesbrough', 'millwall': 'Millwall',
    'mothersday-fathersday': "Mother's & Father's Day", 'mum': 'Mum', 'nan': 'Nan', 'netball': 'Netball',
    'newbaby': 'New Baby', 'norwich': 'Norwich', 'photo-upload': null, 'premiership': 'Premier League',
    'qpr': 'QPR', 'running': 'Running', 'school-cards': 'School', 'sports': 'Sports', 'tottenham': 'Tottenham',
    'tottenhamw': 'Tottenham Women', 'tv-movies': 'TV & Movies', 'weddings-engagements': 'Wedding & Engagement',
    'west-ham': 'West Ham', 'westhamw': 'West Ham Women', 'wrexham': 'Wrexham', 'wsl': "Women's Super League",
    'work-related': 'Work',
};

function categoryLabels(categories) {
    return (categories || []).map(c => CATEGORY_LABELS[c]).filter(Boolean);
}

// ---------------------------------------------------------------
// Work out what this card actually lets you personalise, from the
// real fields in cards-data.js, and describe it in plain English.
// ---------------------------------------------------------------
function personalisationClause(card) {
    // Every card — even ones with no editable front-cover fields —
    // still lets the customer write their own message inside via the
    // editor's universal inside-message step (confirmed in
    // editor.html: insideTexts / "Tick here if you have added your
    // own personal message"). So "no personalising at all" is never
    // true; the only real distinction is whether the FRONT design
    // also has editable fields on top of that inside message.
    const frontParts = [];
    if (card.name) frontParts.push('a name');
    if (card.age) {
        const label = card.age.label === 'Shirt' ? 'a shirt/squad number' : 'an age';
        frontParts.push(label);
    }
    if (Array.isArray(card.extraFields) && card.extraFields.length) {
        frontParts.push(card.extraFields.map(f => f.label.toLowerCase()).join(', '));
    }
    if (card.photo) frontParts.push('your own photo');

    if (!frontParts.length) {
        return { hasFields: true, text: 'Write your own personal message inside using our online editor — the front design stays exactly as shown.' };
    }
    const joined = frontParts.length === 1 ? frontParts[0] : frontParts.slice(0, -1).join(', ') + ' and ' + frontParts[frontParts.length - 1];
    return { hasFields: true, text: `Add ${joined} to the front design, then write your own message inside — both update instantly in the online editor.` };
}

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, '&#39;');
}
function jsonEscape(str) {
    // for embedding inside an already-double-quoted JSON string value
    return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildDescription(title, card, labels) {
    const price = card.price || '£3.99';
    const catText = labels.length ? labels.join(', ') : 'Cockney Cards';
    const pClause = personalisationClause(card);
    return `The '${title}' card is one of our ${catText} designs. ${pClause.text} ${price}, free UK delivery, printed and dispatched by Cockney Cards.`.replace(/\s+/g, ' ').trim();
}

function buildSeoCopy(title, card, labels, related) {
    const pClause = personalisationClause(card);
    const catText = labels.length ? labels.join(', ') : 'our range';
    const relatedLine = related.length
        ? `If this one isn't quite right, we've also got ${related.map(r => r.title).join(', ')} in the same range.`
        : '';
    return `
    <section class="seo-copy">
      <h2>About the ${escapeHtml(title)} card</h2>
      <p>The ${escapeHtml(title)} design sits in our ${escapeHtml(catText)} range. ${pClause.text}</p>
      <p>${relatedLine ? escapeHtml(relatedLine) : `<a href="/shop-cards.html">Browse the full range</a> to compare it against similar designs.`}</p>
    </section>`;
}

function buildRelatedSection(related) {
    if (!related.length) return '';
    return `
    <section class="related">
      <h2>You might also like</h2>
      <ul class="related-grid">
        ${related.map(r => `<li>
          <a href="/cards/${r.slug}/">
            <img src="https://images.cockneycards.com/${r.preview}" alt="${escapeAttr(r.title)} personalised card" loading="lazy">
            <span>${escapeHtml(r.title)}</span>
          </a>
        </li>`).join('\n        ')}
      </ul>
    </section>`;
}

// ---------------------------------------------------------------
// Pass 1: map every folder slug -> catalogue key (read from the
// existing personalise-button href), so related-card links can
// point at real slugs, not raw data keys.
// ---------------------------------------------------------------
const slugDirs = fs.readdirSync(CARDS_DIR).filter(d => fs.statSync(path.join(CARDS_DIR, d)).isDirectory());
const slugToKey = {};
const keyToSlug = {};
for (const slug of slugDirs) {
    const file = path.join(CARDS_DIR, slug, 'index.html');
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    const m = html.match(/editor\.html\?card=([^"]+)/);
    if (!m) { console.warn(`No card key found for ${slug}`); continue; }
    slugToKey[slug] = m[1];
    keyToSlug[m[1]] = slug;
}

// ---------------------------------------------------------------
// Pass 2: rewrite each page
// ---------------------------------------------------------------
let updated = 0, skipped = 0;

for (const slug of slugDirs) {
    const key = slugToKey[slug];
    const card = catalogue[key];
    const file = path.join(CARDS_DIR, slug, 'index.html');
    if (!card) { console.warn(`Skipping ${slug} — key "${key}" not in catalogue.`); skipped++; continue; }

    let html = fs.readFileSync(file, 'utf8');
    const title = card.title;
    const labels = categoryLabels(card.categories);
    const description = buildDescription(title, card, labels);

    // Related cards: up to 4 others sharing a category, excluding self,
    // resolved to real slugs via the map built above.
    const related = Object.entries(catalogue)
        .filter(([k, c]) => k !== key && keyToSlug[k] && (c.categories || []).some(cat => (card.categories || []).includes(cat)))
        .slice(0, 4)
        .map(([k, c]) => ({ slug: keyToSlug[k], title: c.title, preview: c.preview }));

    // 1. meta description
    html = html.replace(
        /(<meta name="description" content=")[^"]*(")/,
        `$1${escapeAttr(description)}$2`
    );
    // 2. og:description
    html = html.replace(
        /(<meta property="og:description" content=")[^"]*(")/,
        `$1${escapeAttr(description)}$2`
    );
    // 3. twitter:description
    html = html.replace(
        /(<meta name="twitter:description" content=")[^"]*(")/,
        `$1${escapeAttr(description)}$2`
    );
    // 4. JSON-LD Product "description" field (inside the minified JSON blob)
    html = html.replace(
        /("@type":"Product"[\s\S]*?"description":")[^"]*(")/,
        `$1${jsonEscape(description)}$2`
    );
    // 5. visible product description paragraph
    html = html.replace(
        /(<p class="description">)[^<]*(<\/p>)/,
        `$1${escapeHtml(description)}$2`
    );
    // 6. product image alt text — more specific
    const primaryLabel = labels[0] || 'personalised';
    html = html.replace(
        /(<img class="product-image" src="[^"]*" alt=")[^"]*(")/,
        `$1${escapeAttr(`${title} personalised ${primaryLabel} card - Cockney Cards`)}$2`
    );
    // 7. replace the seo-copy section entirely
    html = html.replace(
        /\s*<section class="seo-copy">[\s\S]*?<\/section>/,
        buildSeoCopy(title, card, labels, related)
    );
    // 8. insert related-cards section right after seo-copy, before </main>
    const relatedHtml = buildRelatedSection(related);
    if (relatedHtml) {
        html = html.replace(/(\s*)<\/main>/, `${relatedHtml}\n  </main>`);
    }
    // 9. add BreadcrumbList JSON-LD (matching the two-level breadcrumb
    // actually shown: Home > Cards > Title) right after the existing
    // Product JSON-LD script tag.
    const canonicalMatch = html.match(/<link rel="canonical" href="([^"]+)">/);
    const canonical = canonicalMatch ? canonicalMatch[1] : '';
    const breadcrumbJsonLd = `
  <script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.cockneycards.com/" },
            { "@type": "ListItem", "position": 2, "name": "Cards", "item": "https://www.cockneycards.com/shop-cards.html" },
            { "@type": "ListItem", "position": 3, "name": title, "item": canonical }
        ]
    })}</script>`;
    if (!html.includes('"@type":"BreadcrumbList"')) {
        html = html.replace(
            /(<script type="application\/ld\+json">\{"@context":"https:\/\/schema\.org","@type":"Product"[\s\S]*?<\/script>)/,
            `$1${breadcrumbJsonLd}`
        );
    }

    fs.writeFileSync(file, html, 'utf8');
    updated++;
}

console.log(`Updated ${updated} pages, skipped ${skipped}.`);
