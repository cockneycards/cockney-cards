// Shared by every /cards/<slug>/index.html page, alongside card-page.css.
//
// Below 800px the search form collapses to just its icon (see
// card-page.css). First tap opens the input as its own row below the
// header instead of submitting; once it's open, a tap on the icon (or
// Enter in the field) submits as normal. Above 800px the form is already
// fully visible, so the icon keeps its plain "submit the search"
// behaviour untouched.
const isMobileSearchLayout = () => window.matchMedia('(max-width: 800px)').matches;

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
