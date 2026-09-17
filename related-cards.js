// ---- Cockney Cards | "You might also like" randomiser ----
//
// Runs on individual card pages (e.g. /cards/11-plus-girl/index.html).
// Picks 4 random cards that share a category with the current card,
// so the grid isn't the same 4 cards on every visit.
//
// Requires, in this order, before this script runs:
//   1. cards-data.js loaded (provides CARD_CATALOGUE, window.CLOUD_BASE)
//   2. window.CURRENT_CARD_ID set to this page's catalogue id, e.g.:
//        <script>window.CURRENT_CARD_ID = "11plus-girl";</script>
//        <script src="../../cards-data.js"></script>
//        <script src="../../related-cards.js"></script>
//
// If anything above is missing, or fewer than 1 match is found, this
// leaves the grid's existing (hardcoded) markup alone rather than
// clearing it -- so a page still shows *something* if the data files
// fail to load.

(function () {
    const grid = document.querySelector(".related-grid");
    if (!grid) return;
    if (typeof CARD_CATALOGUE === "undefined" || !window.CURRENT_CARD_ID) return;

    const current = CARD_CATALOGUE[window.CURRENT_CARD_ID];
    if (!current) return;

    // Other titled cards that share at least one non-generic category
    // with the current card.
    const candidates = Object.entries(CARD_CATALOGUE).filter(([id, c]) => {
        if (id === window.CURRENT_CARD_ID) return false;
        if (!c.title || !c.categories) return false;
        return c.categories.some((cat) => cat !== "all" && current.categories.includes(cat));
    });

    if (!candidates.length) return;

    // Fisher-Yates shuffle, then take up to 4.
    for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const picks = candidates.slice(0, 4);

    // URL folders follow the card's TITLE, slugified -- e.g.
    // "Driving Test Pass Boy" -> /cards/driving-test-pass-boy/
    // (confirmed against the existing hardcoded links; catalogue ids
    // like "drivingtest-boy1" don't match the folder names directly).
    const slugify = (title) =>
        title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

    grid.innerHTML = picks
        .map(([id, c]) => `
        <li>
            <a href="/cards/${slugify(c.title)}/">
                <img src="${window.CLOUD_BASE}${c.preview || c.full}" alt="${c.title} personalised card" loading="lazy">
                <span>${c.title}</span>
            </a>
        </li>`)
        .join("");
})();
