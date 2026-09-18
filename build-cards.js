/**
 * build-cards.js
 * ------------------------------------------------------------------
 * Single entry point that runs the three card/category generation
 * steps in the order they need to run:
 *
 *   1. generate-card-pages.js     — builds /cards/<slug>/ pages from
 *                                    cards-data.js (creates pages for
 *                                    any new cards you've added)
 *   2. enrich-card-pages.js       — rewrites the SEO copy on those
 *                                    pages (must run AFTER step 1,
 *                                    since it edits files step 1
 *                                    creates)
 *   3. generate-category-pages.js — rebuilds /categories/ pages so
 *                                    new cards show up in the right
 *                                    category listings
 *
 * USAGE
 *   node build-cards.js
 * Run it from the same folder as cards-data.js, categories-data.js,
 * card-pages.js, and the three generator scripts listed above.
 * ------------------------------------------------------------------
 */

const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = __dirname;
const steps = [
  'generate-card-pages.js',
  'enrich-card-pages.js',
  'generate-category-pages.js',
];

for (const step of steps) {
  console.log(`\n=== Running ${step} ===`);
  try {
    execFileSync('node', [path.join(ROOT, step)], { stdio: 'inherit' });
  } catch (err) {
    console.error(`\n✖ ${step} failed — stopping build.`);
    process.exit(1);
  }
}

console.log('\n✔ All steps completed.');
