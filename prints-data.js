// ---- Cockney Cards | PRINTS catalogue ----
//
// Mirrors the idea of cards-data.js, but for prints: no photo-upload, no
// inside-spread/message boxes — a print is just a single personalised page
// (page 1) plus a fixed logo-only page (page 2) added automatically at
// export time.
//
// Add one entry per print design. The editor reads the id from the URL,
// e.g. editor-prints.html?print=your-id-here
//
// Each entry supports:
//   full        — required. Path (appended to CLOUD_BASE) to this print's
//                 full-bleed artwork. This image is stretched to fill the
//                 entire on-screen canvas (595.5 x 840) and, at export
//                 time, the entire A3 page — so upload it already cropped
//                 to a 595.5:840 (≈ A3 portrait) aspect ratio.
//   name        — optional. Personalisation settings for a Name field,
//                 merged onto DEFAULT_NAME_SETTINGS in editor-prints.html.
//                 Omit entirely if this print has no name personalisation.
//   age         — optional, same idea, for an Age field.
//   name2, age2 — optional. A SECOND name/age field, for two-person prints
//                 (e.g. "First Name: / Age: / Second Name: / Age:"). Same
//                 shape as name/age, merged onto DEFAULT_NAME2_SETTINGS /
//                 DEFAULT_AGE2_SETTINGS. Use `label` to set what each input
//                 is called (see the two-name example below).
//   extraFields — optional, same idea, for any number of extra label+value
//                 fields (e.g. "Event:", "Date:").
//
// Leave out `name`/`age`/`name2`/`age2`/`extraFields` completely for a
// print that's just artwork with no personalisation at all.
//
// ---- Shop-facing fields (shop-prints.html reads these directly) ----
//   title       — required to appear in the shop. Entries WITHOUT a title
//                 (like the reference examples below) are skipped by
//                 shop-prints.html — they only exist for the editor.
//   sizes       — required. Per-size pricing, one entry per size the print
//                 is sold at:
//                   sizes: {
//                       A5: { price: "£4.99", priceValue: 4.99 },
//                       A4: { price: "£6.99", priceValue: 6.99 },
//                       A3: { price: "£9.99", priceValue: 9.99 }
//                   }
//                 editor-prints.html reads this to build the size picker
//                 and price display. All three A-sizes share the same
//                 portrait aspect ratio, so no artwork/coordinate changes
//                 are needed per size — only the price and physical output
//                 size change.
//   price, priceValue — required for the shop grid's "from £X.99" price
//                 and for sorting. Set these to the CHEAPEST size's price
//                 (normally the A5 entry in `sizes`) so the grid shows a
//                 starting price.
//   preview     — optional. Path (appended to CLOUD_BASE) to a separate,
//                 lighter thumbnail for the shop grid. Falls back to `full`
//                 if omitted.
//   categories  — required to appear under anything but "All Prints".
//                 Must match the sidebar's filter keys exactly:
//                 'all', 'sports', 'music', 'black & White', 'childrens'.

const CLOUD_BASE = "https://res.cloudinary.com/uzf4eeky/image/upload/";

const PRINT_CATALOGUE = {
    // These two used to live in shop-prints.html's own PRODUCTS list —
    // moved here so this file is the one place you edit for either the
    // shop grid or the editor.
    "itsnotwhatwehave": {
        title: "It's Not What We Have In Life...",
        price: "£4.99", priceValue: 4.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£4.99", priceValue: 4.99 },
            A4: { price: "£6.99", priceValue: 6.99 },
            A3: { price: "£9.99", priceValue: 9.99 }
        },
        categories: ["all", "b&w"],
        preview: "v1785838174/itsnotwhatwehave-preview_xnh2nr.png",
        full: "v1785838415/itsnotwhatwehave_qey0yj.png"
         },
    "oasis-dontlookback": {
        title: "Oasis - Dont Look Back...",
        price: "£4.99", priceValue: 4.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£4.99", priceValue: 4.99 },
            A4: { price: "£6.99", priceValue: 6.99 },
            A3: { price: "£9.99", priceValue: 9.99 }
        },
        categories: ["all", "b&w", "music"],
        preview: "v1785823903/oasis-dontlookback-preview_yuwvyy.png",
        full: "v1785823561/oasis-dontlookback_tjupo3.png"
    },
    "oasis-dontlookback": {
        title: "Oasis - Dont Look Back...",
        price: "£4.99", priceValue: 4.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£4.99", priceValue: 4.99 },
            A4: { price: "£6.99", priceValue: 6.99 },
            A3: { price: "£9.99", priceValue: 9.99 }
        },
        categories: ["all", "b&w", "music"],
        preview: "v1785823903/oasis-dontlookback-preview_yuwvyy.png",
        full: "v1785823561/oasis-dontlookback_tjupo3.png"
    },
    "wham-massive": {
        title: "West Ham Are Massive!",
        price: "£4.99", priceValue: 4.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£4.99", priceValue: 4.99 },
            A4: { price: "£6.99", priceValue: 6.99 },
            A3: { price: "£9.99", priceValue: 9.99 }
        },
        categories: ["all", "sports"],
        preview: "v1785823902/wham-massive-preview_vljrfh.png",
        full: "v1785823561/wham-massive_vj4kxq.png"
    },
    "mfc-stone": {
        title: "MFC Stone Island",
        price: "£4.99", priceValue: 4.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£4.99", priceValue: 4.99 },
            A4: { price: "£6.99", priceValue: 6.99 },
            A3: { price: "£9.99", priceValue: 9.99 }
        },
        categories: ["all", "sports"],
        preview: "v1785823903/mfc-stone-preview_bqjjdm.png",
        full: "v1785823561/mfc-stone_otcbr5.png"
    },
    "mfc-boy1": {
        title: "MFC Boy 1",
        price: "£4.99", priceValue: 4.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£4.99", priceValue: 4.99 },
            A4: { price: "£6.99", priceValue: 6.99 },
            A3: { price: "£9.99", priceValue: 9.99 }
        },
        categories: ["all", "sports"],
        preview: "v1785827230/mfc-boy1-preview_atd6yj.png",
        full: "v1785827576/mfc-boy1_bwwx7b.png",
        name: { label: "First Name", left: 287, top: 585, startSize: 30, minSize: 25, maxSize: 35, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: false, canMove: false, canRotate: false, isCurved: true, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 12 },
        age: { label: "Age", left: 287, top: 650, startSize: 70, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" },
    },
    "mfc-boy2": {
        title: "MFC Boy 2",
        price: "£4.99", priceValue: 4.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£4.99", priceValue: 4.99 },
            A4: { price: "£6.99", priceValue: 6.99 },
            A3: { price: "£9.99", priceValue: 9.99 }
        },
        categories: ["all", "sports"],
        preview: "v1785827231/mfc-boy2-preview_acy95s.png",
        full: "v1785827577/mfc-boy2_yfxjex.png",
        name: { label: "First Name", left: 287, top: 585, startSize: 30, minSize: 25, maxSize: 35, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: false, canMove: false, canRotate: false, isCurved: true, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 12 },
        age: { label: "Age", left: 287, top: 650, startSize: 70, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" },
    },
    "afc-boy1": {
        title: "AFC Boy 1",
        price: "£4.99", priceValue: 4.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£4.99", priceValue: 4.99 },
            A4: { price: "£6.99", priceValue: 6.99 },
            A3: { price: "£9.99", priceValue: 9.99 }
        },
        categories: ["all", "sports"],
        preview: "v1785832868/afc-boy1-preview_fk1pkz.png",
        full: "v1785833148/afc-boy1_yubhjz.png",
        name: { label: "First Name", left: 286, top: 610, startSize: 30, minSize: 25, maxSize: 35, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: false, canMove: false, canRotate: false, isCurved: true, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 12 },
        age: { label: "Age", left: 286, top: 675, startSize: 70, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" },
    },
    "afc-boy2": {
        title: "AFC Boy 2",
        price: "£4.99", priceValue: 4.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£4.99", priceValue: 4.99 },
            A4: { price: "£6.99", priceValue: 6.99 },
            A3: { price: "£9.99", priceValue: 9.99 }
        },
        categories: ["all", "sports"],
        preview: "v1785832868/afc-boy2-preview_ex1356.png",
        full: "v1785833148/afc-boy2_e6m5vw.png",
        name: { label: "First Name", left: 286, top: 610, startSize: 30, minSize: 25, maxSize: 35, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: false, canMove: false, canRotate: false, isCurved: true, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 12 },
        age: { label: "Age", left: 286, top: 675, startSize: 70, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" },
    },
    "afc-boy3": {
        title: "AFC Boy 3",
        price: "£4.99", priceValue: 4.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£4.99", priceValue: 4.99 },
            A4: { price: "£6.99", priceValue: 6.99 },
            A3: { price: "£9.99", priceValue: 9.99 }
        },
        categories: ["all", "sports"],
        preview: "v1785832868/afc-boy3-preview_sbq2z8.png",
        full: "v1785833148/afc-boy3_mwlwu0.png",
        name: { label: "First Name", left: 286, top: 610, startSize: 30, minSize: 25, maxSize: 35, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: false, canMove: false, canRotate: false, isCurved: true, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 12 },
        age: { label: "Age", left: 286, top: 673, startSize: 70, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" }, 
    },
    "afc-girl1": {
        title: "AFC Girl 1",
        price: "£4.99", priceValue: 4.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£4.99", priceValue: 4.99 },
            A4: { price: "£6.99", priceValue: 6.99 },
            A3: { price: "£9.99", priceValue: 9.99 }
        },
        categories: ["all", "sports"],
        preview: "v1785832868/afc-girl1-preview_w99q5x.png",
        full: "v1785833147/afc-girl1_lnszx9.png",
        name: { label: "First Name", left: 305, top: 615, startSize: 28, minSize: 23, maxSize: 30, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: false, canMove: false, canRotate: false, isCurved: true, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 12 },
        age: { label: "Age", left: 305, top: 675, startSize: 70, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" },
    },
    "afc-girl2": {
        title: "AFC Girl 2",
        price: "£4.99", priceValue: 4.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£4.99", priceValue: 4.99 },
            A4: { price: "£6.99", priceValue: 6.99 },
            A3: { price: "£9.99", priceValue: 9.99 }
        },
        categories: ["all", "sports"],
        preview: "v1785832868/afc-girl2-preview_vbyq9q.png",
        full: "v1785833147/afc-girl2_smvcct.png",
        name: { label: "First Name", left: 294, top: 615, startSize: 28, minSize: 23, maxSize: 30, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: false, canMove: false, canRotate: false, isCurved: true, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 12 },
        age: { label: "Age", left: 294, top: 675, startSize: 70, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" },
    },

    // Example of a print WITH name personalisation, for reference:
    "sample-print": {
        full: "v1784098145/prints/sample-print-full.png",
        price: "£4.99", priceValue: 4.99,
        sizes: {
            A5: { price: "£4.99", priceValue: 4.99 },
            A4: { price: "£6.99", priceValue: 6.99 },
            A3: { price: "£9.99", priceValue: 9.99 }
        },
        name: { left: 297.75, top: 725, startSize: 52, color: "#FFFFFF" }
    },

    // Example of a TWO-PERSON print — "First Name: / Age: / Second Name: /
    // Age:" — for reference. Copy this shape for your new test print once
    // you've got its real Cloudinary paths and on-artwork coordinates
    // (use the findCoords() console helper in editor-prints.html for the
    // left/top numbers once the artwork is loaded).
    "sample-two-person-print": {
        full: "v1784098145/prints/sample-two-person-full.png",
        price: "£4.99", priceValue: 4.99,
        sizes: {
            A5: { price: "£4.99", priceValue: 4.99 },
            A4: { price: "£6.99", priceValue: 6.99 },
            A3: { price: "£9.99", priceValue: 9.99 }
        },
        name: { label: "First Name", left: 200, top: 725, startSize: 48, color: "#FFFFFF" },
        age: { label: "Age", left: 200, top: 600, startSize: 56, color: "#FFFFFF" },
        name2: { label: "Second Name", left: 400, top: 725, startSize: 48, color: "#FFFFFF" },
        age2: { label: "Age", left: 400, top: 600, startSize: 56, color: "#FFFFFF" }
    }
};
