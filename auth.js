// Cockney Cards — shared account/session helper.
// Replaces the old Netlify Identity widget across every page.
// Login itself happens on account.html (magic-link email); this script
// just reflects logged-in/out state in the header and gates "My Orders".

function ccGetSession() { return localStorage.getItem("cc_session"); }
function ccGetEmail() { return localStorage.getItem("cc_email"); }
function ccIsLoggedIn() { return !!ccGetSession(); }

function ccUpdateLoginUI() {
    const btn = document.getElementById("login-button");
    if (!btn) return;
    if (ccIsLoggedIn()) {
        btn.innerHTML = "👤 Log Out";
        btn.onclick = ccLogout;
    } else {
        btn.innerHTML = "👤 Log In";
        btn.onclick = () => { window.location.href = "account.html"; };
    }
}

function ccLogout() {
    localStorage.removeItem("cc_session");
    localStorage.removeItem("cc_email");
    ccUpdateLoginUI();
    window.location.href = "index.html";
}

function handleMyOrdersClick(event) {
    event.preventDefault();
    if (ccIsLoggedIn()) {
        window.location.href = "orders.html";
    } else {
        alert("Please log in to view your order history.");
        window.location.href = "account.html";
    }
}

window.addEventListener("DOMContentLoaded", ccUpdateLoginUI);
