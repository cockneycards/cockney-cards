#!/usr/bin/env python3
"""
Fixes the header search on the individual card pages (cards/<name>/index.html)
so it matches the shared /mobile.css.

mobile.css collapses the search bar to just its icon at EVERY screen width and
expects two things from the page that the older card pages don't have:

  1. The search <input> wrapped in <span class="search-drop">...</span>, so the
     open bar can drop onto its own row under the logo row.
  2. A toggleMobileSearch() that works at every width (the old copy only worked
     at 640px and under, so on desktop/tablet the icon did nothing) and sets
     --search-width so the bar matches the nav links.

It also swaps handleSiteSearch() for a version that navigates to
/shop-cards.html?search=... itself, and just focuses the box when it's empty.

Usage (run from the folder that holds your site, e.g. the one containing cards/):

    python3 fix-card-search.py --dry-run     # list what would change
    python3 fix-card-search.py               # patch in place

Safe to run more than once, and safe to run on pages you already patched with
the earlier version of this script: each fix is applied only where it's missing.
Pages that have search code that doesn't match the old card-page code exactly
(e.g. the home page's own version) are left alone and listed at the end.
"""
import re
import sys
from pathlib import Path

ROOT = Path(".")
DRY_RUN = "--dry-run" in sys.argv
SKIP_DIRS = {".git", "node_modules"}


def ws_flexible(block):
    """Regex that matches `block` regardless of how whitespace is laid out."""
    return r"\s+".join(re.escape(tok) for tok in block.split())


# ---- 1. Old (mobile-only) toggle block, exactly as generated on card pages ----
OLD_TOGGLE = re.compile(
    r"(?P<indent>[ \t]*)"
    r"(?:" + ws_flexible(
        "// Mirrors index.html's search-toggle behaviour so the collapsed "
        "// mobile search icon (see mobile.css) works the same on every page."
    ) + r"\s+)?"
    + ws_flexible("""
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
    """)
)

NEW_TOGGLE = [
    "// Header search toggle. mobile.css collapses the search bar to just its icon",
    "// at every screen width, so tapping the icon has to open it everywhere, not",
    "// only on phones. It adds .search-active to .header-left (mobile.css turns",
    "// that into a full-width row under the logo row) and sizes the bar to match",
    "// the nav links below it via --search-width.",
    "function setSearchWidth() {",
    "  const wrapper = document.querySelector('.header-left');",
    "  const links = document.querySelector('.nav-links');",
    "  if (wrapper && links) {",
    "    wrapper.style.setProperty('--search-width', links.getBoundingClientRect().width + 'px');",
    "  }",
    "}",
    "function toggleMobileSearch(event) {",
    "  const wrapper = document.querySelector('.header-left');",
    "  if (!wrapper.classList.contains('search-active')) {",
    "    event.preventDefault();",
    "    setSearchWidth();",
    "    wrapper.classList.add('search-active');",
    "    document.getElementById('site-search-input').focus();",
    "  }",
    "}",
    "document.addEventListener('click', (event) => {",
    "  const wrapper = document.querySelector('.header-left');",
    "  if (wrapper && wrapper.classList.contains('search-active') && !wrapper.contains(event.target)) {",
    "    wrapper.classList.remove('search-active');",
    "  }",
    "});",
    "document.addEventListener('keydown', (event) => {",
    "  if (event.key !== 'Escape') return;",
    "  const wrapper = document.querySelector('.header-left');",
    "  if (wrapper && wrapper.classList.contains('search-active')) {",
    "    wrapper.classList.remove('search-active');",
    "  }",
    "});",
    "window.addEventListener('resize', () => {",
    "  const wrapper = document.querySelector('.header-left');",
    "  if (wrapper && wrapper.classList.contains('search-active')) setSearchWidth();",
    "});",
]

# ---- 2. Wrap the search input in <span class="search-drop"> ----
INPUT = re.compile(r'(<input type="search" name="search" id="site-search-input"[^>]*>)')

# ---- 3. Search submit handler (old: relied on the browser's default submit) ----
OLD_SUBMIT = re.compile(
    r"(?P<indent>[ \t]*)function handleSiteSearch\(event\) \{\s*"
    r"const input = document\.getElementById\('site-search-input'\);\s*"
    r"const value = input\.value\.trim\(\);\s*"
    r"if \(!value\) \{ event\.preventDefault\(\); return false; \}\s*"
    r"input\.value = value;\s*"
    r"return true;\s*"
    r"\}"
)
NEW_SUBMIT = [
    "// Header search. Takes over from the browser's default form submit and",
    "// navigates to /shop-cards.html?search=... itself (the same way the logo",
    "// navigates), because a plain form submit can silently do nothing in some",
    "// preview/embedded contexts. An empty box just puts the cursor in it. The",
    "// form's own action/method stay in the markup as a no-JavaScript fallback.",
    "function handleSiteSearch(event) {",
    "  event.preventDefault();",
    "  const input = document.getElementById('site-search-input');",
    "  const value = input.value.trim();",
    "  if (!value) { input.focus(); return false; }",
    "  input.value = value;",
    "  window.location.href = '/shop-cards.html?search=' + encodeURIComponent(value);",
    "  return false;",
    "}",
]


def block(lines, indent, eol):
    return eol.join(indent + line for line in lines)


def patch(text):
    """Returns (new_text, [names of fixes applied])."""
    eol = "\r\n" if "\r\n" in text else "\n"
    applied = []

    new, n = OLD_TOGGLE.subn(lambda m: block(NEW_TOGGLE, m.group("indent"), eol), text)
    if n:
        text = new
        applied.append("search icon opens the bar at every width")
        # The wrapper only matters together with the new toggle, and only if
        # the page doesn't already have it.
        if "search-drop" not in text:
            text, n2 = INPUT.subn(r'<span class="search-drop">\1</span>', text)
            if n2:
                applied.append("input wrapped in .search-drop")

    new, n = OLD_SUBMIT.subn(lambda m: block(NEW_SUBMIT, m.group("indent"), eol), text)
    if n:
        text = new
        applied.append("search submit navigates directly")

    return text, applied


patched, fully_ok, needs_review = [], 0, []

for path in sorted(ROOT.rglob("*.html")):
    if any(part in SKIP_DIRS for part in path.parts):
        continue
    with open(path, encoding="utf-8", newline="") as f:
        text = f.read()
    if "toggleMobileSearch" not in text and "handleSiteSearch" not in text:
        continue

    new_text, applied = patch(text)
    if applied:
        patched.append((path, applied))
        if not DRY_RUN:
            with open(path, "w", encoding="utf-8", newline="") as f:
                f.write(new_text)
    elif "setSearchWidth" in text or "search-drop" in text:
        fully_ok += 1
    elif "toggleMobileSearch" in text:
        needs_review.append(path)

verb = "Would patch" if DRY_RUN else "Patched"
print(f"{verb} {len(patched)} file(s):")
for p, applied in patched[:20]:
    print("  ", p, "->", "; ".join(applied))
if len(patched) > 20:
    print(f"   ... and {len(patched) - 20} more")
print(f"Already up to date: {fully_ok}")
if needs_review:
    print(f"Left alone - different search code, check by hand ({len(needs_review)}):")
    for p in needs_review:
        print("  ", p)
