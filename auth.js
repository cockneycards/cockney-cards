// Cockney Cards — shared account/session helper.
// Replaces the old Netlify Identity widget across every page.
// Login itself happens on account.html (magic-link email); this script
// just reflects logged-in/out state in the header and gates "My Orders".

function ccGetSession() { return localStorage.getItem("cc_session"); }
function ccGetEmail() { return localStorage.getItem("cc_email"); }
function ccIsLoggedIn() { return !!ccGetSession(); }

// Refer a Friend — captures ?ref=CODE from a shared referral link and
// remembers it in localStorage so it's still there whenever the visitor
// eventually logs in or signs up, no matter which page they landed on or
// how long they browse first. Deliberately never overwrites an existing
// stored code with an empty one — if they land again later without a
// ?ref= (e.g. just typing the URL from memory), the original referral
// should still get credit rather than being silently dropped.
function ccCaptureReferralCode() {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
        localStorage.setItem("cc_ref_code", ref.trim().toUpperCase().slice(0, 20));
    }
}
function ccGetReferralCode() { return localStorage.getItem("cc_ref_code") || null; }

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

window.addEventListener("DOMContentLoaded", () => {
    ccCaptureReferralCode();
    ccUpdateLoginUI();
});
