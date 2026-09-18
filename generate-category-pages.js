const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'categories');
const BASE_URL = 'https://www.cockneycards.com';
const CLOUD_BASE = 'https://images.cockneycards.com/';

function loadGlobals(file) {
  const code = fs.readFileSync(file, 'utf8');
  const ctx = {};
  // cards-data.js assigns to window.CLOUD_BASE; alias window to the
  // sandbox's own global object so that assignment doesn't throw.
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(code + "\nif (typeof CARD_CATALOGUE !== 'undefined') this.CARD_CATALOGUE = CARD_CATALOGUE; if (typeof DEFAULT_PRICE !== 'undefined') this.DEFAULT_PRICE = DEFAULT_PRICE; if (typeof CARD_CATEGORIES !== 'undefined') this.CARD_CATEGORIES = CARD_CATEGORIES;", ctx);
  return ctx;
}

const catCtx = loadGlobals(path.join(ROOT, 'categories-data.js'));
const cardCtx = loadGlobals(path.join(ROOT, 'cards-data.js'));
const CARD_CATEGORIES = cardCtx.CARD_CATALOGUE ? catCtx.CARD_CATEGORIES : catCtx.CARD_CATEGORIES;
const CARD_CATALOGUE = cardCtx.CARD_CATALOGUE;
const DEFAULT_PRICE = cardCtx.DEFAULT_PRICE || '£3.99';

// Recover the same card-page slugs used by the existing individual SEO pages.
const slugMap = {};
try {
  const code = fs.readFileSync(path.join(ROOT, 'card-pages.js'), 'utf8');
  const m = code.match(/const CARD_PAGE_SLUGS\s*=\s*(\{[\s\S]*?\});/);
  if (m) Object.assign(slugMap, vm.runInNewContext('(' + m[1] + ')'));
} catch (e) {}

function slugify(s) {
  return s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}

function nodeChildren(node) { return Array.isArray(node[2]) ? node[2] : []; }
function hasCard(id) { const c = CARD_CATALOGUE[id]; return c && c.preview && c.full; }
const activeCards = Object.entries(CARD_CATALOGUE).filter(([id,c]) => c && c.title && c.preview && c.full);

function collectKeys(node) {
  const [key] = node;
  const set = new Set([key]);
  for (const child of nodeChildren(node)) for (const x of collectKeys(child)) set.add(x);
  return set;
}
function directProducts(key) {
  return activeCards.filter(([id,c]) => Array.isArray(c.categories) && c.categories.includes(key));
}
function productsForNode(node) {
  const keys = collectKeys(node);
  if (node[0] === 'all') return activeCards;
  return activeCards.filter(([id,c]) => Array.isArray(c.categories) && c.categories.some(k => keys.has(k)));
}

const overrides = {
  all: {slug:'all-cards', title:'All Personalised Greeting Cards', description:'Browse all of our personalised greeting cards, with designs for birthdays, new babies, weddings, achievements, sport, Christmas and more.'},
  'photo-upload': {slug:'photo-upload-cards', title:'Personalised Photo Greeting Cards', description:'Create a personalised greeting card with your own photo. Choose from our photo-upload card designs and make it uniquely yours.'},
  birthdays: {slug:'birthday-cards', title:'Personalised Birthday Cards', description:'Shop personalised birthday cards for Mum, Dad, Nan, Grandad, kids and more. Choose a design and personalise it before ordering.'},
  mum: {slug:'birthday-cards/mum', title:'Personalised Birthday Cards for Mum', description:'Find a personalised birthday card for Mum from our collection of fun, thoughtful and photo card designs.'},
  dad: {slug:'birthday-cards/dad', title:'Personalised Birthday Cards for Dad', description:'Find a personalised birthday card for Dad, including funny, photo and hobby-inspired designs.'},
  nan: {slug:'birthday-cards/nan', title:'Personalised Birthday Cards for Nan', description:'Browse personalised birthday cards for Nan, including sweet, funny and family-themed designs.'},
  grandad: {slug:'birthday-cards/grandad', title:'Personalised Birthday Cards for Grandad', description:'Browse personalised birthday cards for Grandad, including garden, fishing, football and other fun designs.'},
  children: {slug:'birthday-cards/kids', title:'Personalised Birthday Cards for Kids', description:'Fun personalised birthday cards for children, with colourful designs for boys and girls.'},
  newbaby: {slug:'new-baby-cards', title:'Personalised New Baby Cards', description:'Browse personalised new baby cards for baby boys, baby girls and growing families, including photo card designs.'},
  'thank-you': {slug:'thank-you-cards', title:'Personalised Thank You Cards', description:'Say thank you with a personalised greeting card from Cockney Cards.'},
  'weddings-engagements': {slug:'wedding-engagement-cards', title:'Wedding & Engagement Cards', description:'Browse personalised wedding, engagement and hen party cards.'},
  home: {slug:'new-home-cards', title:'Personalised New Home Cards', description:'Celebrate a new home with a personalised new home greeting card.'},
  'school-cards': {slug:'school-cards', title:'Personalised School Cards', description:'Personalised school cards for teachers, teaching assistants, exams, achievements and more.'},
  'work-related': {slug:'work-cards', title:'Personalised Work Cards', description:'Browse personalised cards for colleagues and workplace occasions, including leaving cards.'},
  achievements: {slug:'achievement-cards', title:'Personalised Achievement Cards', description:'Celebrate passing exams, driving tests, running achievements and other personal milestones with a personalised card.'},
  'tv-movies': {slug:'tv-movie-cards', title:'TV & Movie Cards', description:'Browse personalised greeting cards inspired by popular TV and movie themes.'},
  christmas: {slug:'christmas-cards', title:'Personalised Christmas Cards', description:'Browse personalised Christmas cards, including fun Santa designs and photo Christmas cards.'},
  sports: {slug:'sports-cards', title:'Personalised Sports Cards', description:'Browse personalised sports greeting cards for football, golf, cricket, Formula 1, rugby, netball, darts and horse racing.'},
  football: {slug:'football-cards', title:'Personalised Football Cards', description:'Browse personalised football greeting cards for fans of clubs across the Premier League, Championship, League One, League Two and WSL.'},
  golf: {slug:'sports-cards/golf', title:'Personalised Golf Cards', description:'Personalised greeting cards for golfers, including fun and achievement designs.'},
  cricket: {slug:'sports-cards/cricket', title:'Personalised Cricket Cards', description:'Personalised greeting cards for cricket fans and players.'},
  formula1: {slug:'sports-cards/formula-1', title:'Personalised Formula 1 Cards', description:'Browse personalised Formula 1 greeting cards for racing fans.'},
  rugby: {slug:'sports-cards/rugby', title:'Personalised Rugby Cards', description:'Personalised greeting cards for rugby fans and players.'},
  netball: {slug:'sports-cards/netball', title:'Personalised Netball Cards', description:'Personalised greeting cards for netball players and fans.'},
  darts: {slug:'sports-cards/darts', title:'Personalised Darts Cards', description:'Personalised greeting cards for darts fans and players.'},
  horseracing: {slug:'sports-cards/horse-racing', title:'Personalised Horse Racing Cards', description:'Personalised greeting cards for horse racing fans.'},
};

const seenSlugs = new Set(Object.values(overrides).map(x=>x.slug));
function pathSlugFor(keys, labels, key) {
  if (key === 'all') return 'all-cards';
  if (key === 'sports') return 'sports-cards';
  if (keys.includes('football')) {
    const idx = keys.indexOf('football');
    const parts = ['football-cards'];
    for (let i = idx + 1; i < keys.length; i++) parts.push(slugify(labels[i]));
    return parts.join('/');
  }
  if (keys.includes('sports')) {
    const idx = keys.indexOf('sports');
    const parts = ['sports-cards'];
    for (let i = idx + 1; i < keys.length; i++) parts.push(slugify(labels[i]));
    return parts.join('/');
  }
  if (keys.includes('birthdays')) {
    const idx = keys.indexOf('birthdays');
    const parts = ['birthday-cards'];
    for (let i = idx + 1; i < keys.length; i++) parts.push(slugify(labels[i]));
    return parts.join('/');
  }
  return labels.map(slugify).join('/');
}
function categoryMeta(key,label,pathLabels,pathKeys) {
  if (overrides[key]) return overrides[key];
  const slug = pathSlugFor(pathKeys || [], pathLabels || [], key);
  const title = `Personalised ${label} Cards`;
  const description = `Browse our personalised ${label.toLowerCase()} cards and choose a design to personalise and order online.`;
  return {slug, title, description};
}
function walk(nodes, parentLabels=[], parentKeys=[]) {
  for (const node of nodes) {
    const [key,label] = node;
    const children = nodeChildren(node);
    const products = productsForNode(node);
    if (products.length) {
      const meta = categoryMeta(key,label,[...parentLabels,label],[...parentKeys,key]);
      if (!seenSlugs.has(meta.slug) || overrides[key]) {
        seenSlugs.add(meta.slug);
        pages.push({key,label,node,products,meta,parentLabels,parentKeys});
      }
    }
    if (children.length) walk(children,[...parentLabels,label],[...parentKeys,key]);
  }
}
const pages=[];
walk(CARD_CATEGORIES);

function escapeHtml(s='') { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function cardUrl(id) { return `/cards/${slugMap[id] || slugify(CARD_CATALOGUE[id].title)}/`; }
function priceValue(price) { return parseFloat(String(price||DEFAULT_PRICE).replace(/[^0-9.]/g,'')) || 3.99; }
function pagePath(slug) { return path.join(OUT, ...slug.split('/'), 'index.html'); }
function pageUrl(slug) { return `${BASE_URL}/${slug}/`; }
function breadcrumbs(p) {
  const arr=[['Home','/'],['Cards','/shop-cards.html']];
  const found=[];
  function findPath(nodes,target,trail=[]) { for(const n of nodes){ const t=[...trail,n]; if(n[0]===target)return t; const f=findPath(nodeChildren(n),target,t); if(f)return f;} return null; }
  const chain=findPath(CARD_CATEGORIES,p.key)||[];
  for (let i=0;i<chain.length;i++) {
    const n=chain[i];
    if(n[0]==='all') continue;
    const keys=chain.slice(0,i+1).map(x=>x[0]);
    const labels=chain.slice(0,i+1).map(x=>x[1]);
    const m=overrides[n[0]] || categoryMeta(n[0],n[1],labels,keys);
    const target=pages.find(x=>x.key===n[0]);
    if(target) arr.push([n[1], `/${target.meta.slug}/`]);
  }
  return arr.map((x,i)=>i===arr.length-1?`<span class="current">${escapeHtml(x[0])}</span>`:`<a href="${x[1]}">${escapeHtml(x[0])}</a>`).join('<span class="sep">›</span>');
}
fs.rmSync(OUT,{recursive:true,force:true});
fs.mkdirSync(OUT,{recursive:true});

for (const p of pages) {
  const dir=path.dirname(pagePath(p.meta.slug)); fs.mkdirSync(dir,{recursive:true});
  const cardsHtml=p.products.map(([id,c])=>{
    const price=c.price||DEFAULT_PRICE;
    return `<article class="card"><a href="${cardUrl(id)}"><img src="${CLOUD_BASE}${escapeHtml(c.preview)}" alt="${escapeHtml(c.title)} personalised greeting card" loading="lazy"><h2>${escapeHtml(c.title)}</h2><p>${escapeHtml(price)}</p></a><a class="button" href="${cardUrl(id)}">View card</a></article>`;
  }).join('\n');
  const childLinks=nodeChildren(p.node).map(n=>{
    const child=pages.find(x=>x.key===n[0]); if(!child)return ''; return `<a class="subcat" href="/categories/${child.meta.slug}/">${escapeHtml(n[1])}</a>`;
  }).filter(Boolean).join('');
  const jsonld={"@context":"https://schema.org","@type":"CollectionPage","name":p.meta.title,"description":p.meta.description,"url":pageUrl(p.meta.slug),"isPartOf":{"@type":"WebSite","name":"Cockney Cards","url":BASE_URL}};
  const html=`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(p.meta.title)} | Cockney Cards</title><meta name="description" content="${escapeHtml(p.meta.description)}"><link rel="canonical" href="${pageUrl(p.meta.slug)}"><meta property="og:type" content="website"><meta property="og:title" content="${escapeHtml(p.meta.title)} | Cockney Cards"><meta property="og:description" content="${escapeHtml(p.meta.description)}"><meta property="og:url" content="${pageUrl(p.meta.slug)}"><link rel="stylesheet" href="/category-page.css"><script type="application/ld+json">${JSON.stringify(jsonld)}</script></head><body><header><a class="logo" href="/"><img src="${CLOUD_BASE}logo.png" alt="Cockney Cards"></a><nav><a href="/shop-cards.html">Shop Cards</a><a href="/shop-prints.html">Shop Prints</a><a href="/cockney-club.html">Cockney Club</a><a href="/account.html">My Account</a></nav></header><main><div class="breadcrumbs">${breadcrumbs(p)}</div><section class="intro"><h1>${escapeHtml(p.meta.title)}</h1><p>${escapeHtml(p.meta.description)}</p></section>${childLinks?`<div class="subcategories">${childLinks}</div>`:''}<section class="grid" aria-label="${escapeHtml(p.meta.title)}">${cardsHtml}</section></main><footer><a href="/shop-cards.html">Back to all cards</a></footer></body></html>`;
  fs.writeFileSync(pagePath(p.meta.slug),html);
}

const manifest=pages.map(p=>({key:p.key,label:p.label,url:`/${p.meta.slug}/`,cards:p.products.length}));
fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify({generatedAt:new Date().toISOString(),pageCount:pages.length,pages:manifest},null,2));
console.log(`Generated ${pages.length} category pages from ${activeCards.length} active cards.`);
for(const p of pages) console.log(`${p.key}: ${p.products.length} -> /categories/${p.meta.slug}/`);
