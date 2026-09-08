// functions/royal-mail.js
//
// Wraps Royal Mail's Click & Drop Orders API so stripe-webhook.js can
// create a shipment and get back a tracking number + label automatically
// for any order shipped as Tracked24 or Tracked24 (signed) — First Class
// orders are still posted manually, so they never call this.
//
// Requires (Cloudflare env vars/secrets):
//   ROYAL_MAIL_API_KEY   - from Click & Drop: Settings > Integrations >
//                           Click & Drop API. This is a single API key
//                           sent as the Authorization header value AS-IS
//                           (not "Bearer <key>") — see Royal Mail's own
//                           Click & Drop API help centre article.
//   ROYAL_MAIL_SENDER_*  - your return-address details (see buildSender
//                           below) — set these once you know what you
//                           want printed on the label as "from".
//
// ⚠️ NOT YET LIVE-TESTED. This is built from Royal Mail's public Click &
// Drop API help-centre docs (https://help.parcel.royalmail.com — search
// "Integrating with the Click & Drop API") rather than the full Swagger
// reference, which sits behind an approved account. Before going live,
// confirm against your account's actual API reference (Click & Drop >
// Settings > Integrations > Click & Drop API > API documentation link)
// in particular:
//   - the exact `packageFormatIdentifier` enum value for a small
//     parcel / large letter (used below as placeholders)
//   - the exact `serviceCode` values for Tracked24 vs Tracked24 with
//     signature (Royal Mail's own term is often "Signed For")
//   - whether weightInGrams has a required minimum/maximum for these
//     formats
// Everything else (endpoint, auth header shape, one-order-per-call
// pattern, label-in-response limit) is confirmed from their docs.

const ORDERS_ENDPOINT = 'https://api.parcel.royalmail.com/api/v1/Orders';

// TODO: confirm these two against your account's API reference — these
// are placeholders based on Royal Mail's general size categories, not
// confirmed enum strings.
const PACKAGE_FORMAT = {
    A5: 'largeLetter',
    A4: 'largeLetter',
    A3: 'smallParcel', // A3 ships as a small parcel, not a letter — see postage.js
};

// TODO: confirm these against your account's API reference.
const SERVICE_CODE = {
    tracked24: 'CRL24',
    tracked24_signed: 'CRL24S',
};

// Rough default weights (grams) per size — used only as a fallback when
// no real weight is available. Adjust once you know your actual
// card/print + envelope weights, since Royal Mail may price/format
// differently outside these bands.
const DEFAULT_WEIGHT_GRAMS = { A5: 100, A4: 150, A3: 300 };

function isConfigured(env) {
    return !!(env.ROYAL_MAIL_API_KEY && env.ROYAL_MAIL_SENDER_NAME && env.ROYAL_MAIL_SENDER_ADDRESS1 && env.ROYAL_MAIL_SENDER_POSTCODE);
}

function buildSender(env) {
    return {
        name: env.ROYAL_MAIL_SENDER_NAME,
        addressLine1: env.ROYAL_MAIL_SENDER_ADDRESS1,
        addressLine2: env.ROYAL_MAIL_SENDER_ADDRESS2 || undefined,
        city: env.ROYAL_MAIL_SENDER_CITY || undefined,
        county: env.ROYAL_MAIL_SENDER_COUNTY || undefined,
        postcode: env.ROYAL_MAIL_SENDER_POSTCODE,
        countryCode: 'GB',
    };
}

// Creates a single shipment for one destination parcel and returns
// { trackingNumber, labelBase64 } (labelBase64 is a PDF, null if the API
// didn't return one). Throws on any failure — callers should catch this
// so a Royal Mail outage never blocks the rest of order processing
// (email/D1 writes), same pattern as the rest of stripe-webhook.js.
//
// `recipient` — { name, address1, address2, city, county, postcode, country }
//   (same shape already used everywhere else in this codebase for
//   delivery addresses — see postage.js/stripe-webhook.js).
// `size` — 'A5' | 'A4' | 'A3' (from tierForItem/highestTier in postage.js).
// `method` — 'tracked24' | 'tracked24_signed' (POSTAGE_METHODS in postage.js).
// `orderReference` — your own order id, so the shipment is traceable back
//   to the Stripe order in your Click & Drop dashboard.
export async function createShipment(env, { recipient, size, method, orderReference, weightGrams }) {
    if (!isConfigured(env)) {
        throw new Error('Royal Mail API is not configured (missing ROYAL_MAIL_* env vars) — set these up once your Click & Drop account and API key are ready.');
    }
    const serviceCode = SERVICE_CODE[method];
    if (!serviceCode) {
        throw new Error(`No Royal Mail service code configured for shipping method "${method}"`);
    }

    const body = {
        items: [
            {
                orderReference: orderReference,
                recipient: {
                    name: recipient.name,
                    addressLine1: recipient.address1,
                    addressLine2: recipient.address2 || undefined,
                    city: recipient.city || undefined,
                    county: recipient.county || undefined,
                    postcode: recipient.postcode,
                    countryCode: recipient.country === 'United Kingdom' ? 'GB' : recipient.country,
                },
                sender: buildSender(env),
                billing: {
                    service: serviceCode,
                },
                packages: [
                    {
                        weightInGrams: weightGrams || DEFAULT_WEIGHT_GRAMS[size] || DEFAULT_WEIGHT_GRAMS.A5,
                        packageFormatIdentifier: PACKAGE_FORMAT[size] || PACKAGE_FORMAT.A5,
                    },
                ],
                // Requests the label back in this same response — Royal
                // Mail caps this at 1 label across the whole request, which
                // is fine since we always send exactly one order per call.
                labelGenerationRequest: {
                    includeLabelInResponse: true,
                },
            },
        ],
    };

    const res = await fetch(ORDERS_ENDPOINT, {
        method: 'POST',
        headers: {
            Authorization: env.ROYAL_MAIL_API_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
        console.error('Royal Mail Orders API error:', res.status, json);
        throw new Error(`Royal Mail Orders API returned ${res.status}`);
    }

    // TODO: confirm the exact response shape against your account's API
    // reference — this reads the fields Royal Mail's docs describe
    // (createdOrders[].trackingNumber / .label.contentBytes), but hasn't
    // been checked against a real response yet.
    const created = json?.createdOrders?.[0] || json?.orders?.[0] || null;
    const trackingNumber = created?.trackingNumber || created?.trackingNumbers?.[0] || null;
    const labelBase64 = created?.label?.contentBytes || created?.labelInResponse?.[0]?.contentBytes || null;

    if (!trackingNumber) {
        console.error('Royal Mail Orders API: no tracking number in response', json);
    }

    return { trackingNumber, labelBase64 };
}
