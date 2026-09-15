# Cockney Cards category SEO pages

Generated from the existing `cards-data.js` and `categories-data.js` catalogue.

## What is included
- 47 crawlable category pages.
- Pages contain real HTML links to the existing individual `/cards/<slug>/` pages.
- SEO title, meta description, canonical URL, Open Graph tags and CollectionPage JSON-LD.
- Clean URLs such as `/birthday-cards/`, `/birthday-cards/mum/`, `/football-cards/`, `/football-cards/premiership/chelsea/`, `/sports-cards/golf/`.

## Upload
Copy the contents of this `category-pages` folder into the root of the GitHub repository. Do NOT put the folder itself at `/category-pages/`.

Keep `category-page.css` in the website root. The category folders (birthday-cards, football-cards, sports-cards, etc.) should also be in the website root.

## Existing files not replaced
This package does not replace `editor.html`, `cards-data.js`, `categories-data.js`, or your existing individual `/cards/` pages.

## Regenerating later
If the catalogue changes, run `generate-category-pages.js` from a local copy of the repository. It reads the current `cards-data.js`, `categories-data.js` and `card-pages.js` and rebuilds the category pages.
