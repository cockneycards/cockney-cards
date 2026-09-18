// Shared by every /cards/<slug>/index.html page, alongside card-page.css.
//
// The search form collapses to just its icon (see card-page.css) at every
// screen width. First tap opens the input as its own row below the header
// instead of submitting; once it's open, a tap on the icon (or Enter in
// the field) submits as normal.
const isMobileSearchLayout = () => true;

function toggleMobileSearch(event) {
    if (!isMobileSearchLayout()) return;
    const form = document.querySelector('.search-form');
    const input = form.querySelector('input[type="search"]');
    if (!form.classList.contains('search-active')) {
        event.preventDefault();
        // Size the popped-open input to match the nav links below it,
        // rather than stretching it edge to edge.
        const navLinks = document.querySelectorAll('header nav a');
        if (navLinks.length) {
            const first = navLinks[0].getBoundingClientRect();
            const last = navLinks[navLinks.length - 1].getBoundingClientRect();
            input.style.setProperty('--search-width', (last.right - first.left) + 'px');
        }
        form.classList.add('search-active');
        input.focus();
    }
}

document.addEventListener('click', (event) => {
    if (!isMobileSearchLayout()) return;
    const form = document.querySelector('.search-form');
    if (form.classList.contains('search-active') && !form.contains(event.target)) {
        form.classList.remove('search-active');
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const form = document.querySelector('.search-form');
    if (form.classList.contains('search-active')) {
        form.classList.remove('search-active');
    }
});
