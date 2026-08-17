// cart.js — shared basket used across every page (index, shop-cards,
// shop-prints, editor, editor-prints, account, basket). Include it after
// auth.js on every page and it will, on its own:
//   - turn every ".cart-icon" element into a link to basket.html
//   - show a live item-count badge on it (a small ".cart-badge" pill)
//   - keep multiple open tabs in sync (via the 'storage' event)
//
// Cart line items look like:
//   {
//     id,                 // unique line id
//     kind: 'card'|'print',
//     templateId, variantId,
//     title,               // e.g. "11+ Boy Card"
//     thumbnail,            // preview image URL, for the basket list
//     optionsSummary,       // e.g. "Name: Jack · Age: 5" or "Size: A4"
//     price,                // display string, e.g. "£4.99"
//     priceValue,           // number, e.g. 4.99 — used for the subtotal
//     quantity,
//     addedAt
//   }
// The print-ready PDF for that line (built once, at "Add to Basket" time,
// by the same capture code the old single-item "Buy Now" flow already
// used) is stored separately in IndexedDB, keyed by the same id — PDFs can
// run into several MB each once you've got a handful of items in the
// basket, and localStorage's ~5MB-per-origin quota doesn't leave much
// headroom for that, so only the lightweight metadata above lives there.
(function () {
    const CART_KEY = 'cc_cart_v1';
    const DB_NAME = 'cc_cart_db';
    const DB_VERSION = 1;
    const PDF_STORE = 'pdfs';

    // ---------------------------------------------------------------
    // localStorage — cart metadata (small, synchronous)
    // ---------------------------------------------------------------
    function readCart() {
        try {
            const raw = localStorage.getItem(CART_KEY);
            const items = raw ? JSON.parse(raw) : [];
            return Array.isArray(items) ? items : [];
        } catch (err) {
            console.error('Cart data was corrupted — resetting basket.', err);
            return [];
        }
    }

    function writeCart(items) {
        try {
            localStorage.setItem(CART_KEY, JSON.stringify(items));
        } catch (err) {
            // Quota exceeded or storage disabled (e.g. private browsing in
            // some browsers) — surface it rather than silently losing the
            // change, since the in-memory `items` and what's on disk would
            // otherwise drift apart.
            console.error('Could not save basket:', err);
            alert("Your basket couldn't be saved — your browser's storage may be full or disabled.");
            return false;
        }
        updateCartBadge();
        window.dispatchEvent(new CustomEvent('cc-cart-updated', { detail: items }));
        return true;
    }

    // ---------------------------------------------------------------
    // IndexedDB — the print-ready PDF for each line item (larger, async)
    // ---------------------------------------------------------------
    function openDb() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                if (!req.result.objectStoreNames.contains(PDF_STORE)) {
                    req.result.createObjectStore(PDF_STORE);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function savePdf(id, dataUri) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(PDF_STORE, 'readwrite');
            tx.objectStore(PDF_STORE).put(dataUri, id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async function loadPdf(id) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(PDF_STORE, 'readonly');
            const req = tx.objectStore(PDF_STORE).get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    }

    async function deletePdf(id) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(PDF_STORE, 'readwrite');
            tx.objectStore(PDF_STORE).delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async function clearAllPdfs() {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(PDF_STORE, 'readwrite');
            tx.objectStore(PDF_STORE).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    // ---------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------

    // Metadata only — fine for rendering the basket list without waiting
    // on IndexedDB.
    function getCart() {
        return readCart();
    }

    function getCartCount() {
        return readCart().reduce((sum, item) => sum + (item.quantity || 1), 0);
    }

    function getCartTotal() {
        return readCart().reduce((sum, item) => sum + (item.priceValue || 0) * (item.quantity || 1), 0);
    }

    // item = { kind, templateId, variantId, title, thumbnail,
    //          optionsSummary, price, priceValue, pdfDataUri,
    //          labelPdfDataUri (optional, for a "send to recipient"
    //          delivery choice) }
    // Returns the new line item's id.
    async function addToCart(item) {
        const id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
        const { pdfDataUri, labelPdfDataUri, ...metadata } = item;

        if (pdfDataUri) {
            await savePdf(id, pdfDataUri);
        }
        if (labelPdfDataUri) {
            await savePdf(`${id}:label`, labelPdfDataUri);
        }

        const items = readCart();
        items.push(Object.assign({ id, quantity: 1, addedAt: Date.now() }, metadata));
        writeCart(items);
        return id;
    }

    async function removeFromCart(id) {
        writeCart(readCart().filter((i) => i.id !== id));
        await deletePdf(id);
        await deletePdf(`${id}:label`);
    }

    function updateCartQuantity(id, quantity) {
        const qty = Math.max(1, Math.min(20, Math.round(quantity) || 1));
        writeCart(readCart().map((i) => (i.id === id ? Object.assign({}, i, { quantity: qty }) : i)));
    }

    async function clearCart() {
        writeCart([]);
        await clearAllPdfs();
    }

    // For checkout: metadata + its PDF(s), per item, in cart order.
    async function getCartWithPdfs() {
        const items = readCart();
        const withPdfs = [];
        for (const item of items) {
            const pdfDataUri = await loadPdf(item.id);
            const labelPdfDataUri = await loadPdf(`${item.id}:label`);
            withPdfs.push(Object.assign({}, item, { pdfDataUri, labelPdfDataUri }));
        }
        return withPdfs;
    }

    function formatGBP(value) {
        return `£${(value || 0).toFixed(2)}`;
    }

    // ---------------------------------------------------------------
    // Cart icon / badge wiring — runs on every page automatically
    // ---------------------------------------------------------------
    function injectBadgeStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .cart-badge {
                position: absolute; top: -6px; right: -8px;
                background: var(--primary, #1A73E8); color: #fff;
                font-size: 10px; font-weight: bold; line-height: 1;
                min-width: 16px; height: 16px; border-radius: 8px;
                display: none; align-items: center; justify-content: center;
                padding: 0 4px; box-sizing: border-box;
                font-family: 'Helvetica Neue', Arial, sans-serif;
            }
        `;
        document.head.appendChild(style);
    }

    function updateCartBadge() {
        const count = getCartCount();
        document.querySelectorAll('.cart-badge').forEach((el) => {
            el.textContent = count > 0 ? String(count > 99 ? '99+' : count) : '';
            el.style.display = count > 0 ? 'flex' : 'none';
        });
    }

    function wireCartIcons() {
        document.querySelectorAll('.cart-icon').forEach((icon) => {
            if (!icon.querySelector('.cart-badge')) {
                const badge = document.createElement('span');
                badge.className = 'cart-badge';
                icon.appendChild(badge);
            }
            icon.setAttribute('role', 'link');
            icon.setAttribute('aria-label', 'View basket');
            icon.style.cursor = 'pointer';
            icon.addEventListener('click', () => {
                window.location.href = 'basket.html';
            });
        });
        updateCartBadge();
    }

    injectBadgeStyles();

    window.addEventListener('storage', (e) => {
        if (e.key === CART_KEY) updateCartBadge();
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wireCartIcons);
    } else {
        wireCartIcons(); // script loaded after DOM was already ready
    }

    window.ccCart = {
        getCart, getCartWithPdfs, getCartCount, getCartTotal,
        addToCart, removeFromCart, updateCartQuantity, clearCart,
        formatGBP, updateCartBadge
    };
})();
