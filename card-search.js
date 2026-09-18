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
    if (!form.classList.contains('search-active')) {
        event.preventDefault();
        form.classList.add('search-active');
        form.querySelector('input[type="search"]').focus();
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
