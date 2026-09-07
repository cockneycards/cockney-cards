-- Saved Addresses — run once against cockney-cards-db.
-- Same field shape as the recipient address object create-checkout-basket.js
-- / stripe-webhook.js already use for gifted items ("self" vs "recipient"
-- deliveries), so a saved address can be dropped straight into item.delivery
-- elsewhere without reshaping it.

CREATE TABLE IF NOT EXISTS addresses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    label TEXT,
    name TEXT NOT NULL,
    address1 TEXT NOT NULL,
    address2 TEXT,
    city TEXT NOT NULL,
    county TEXT,
    postcode TEXT NOT NULL,
    country TEXT DEFAULT 'United Kingdom',
    is_default INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);
