// ---- Cockney Cards | PRINTS catalogue----
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
//                 Two extra sub-fields, both optional:
//                   onlyForVariants — restrict the name field to only show
//                     for specific picture variants (by their `variants[].id`)
//                     — e.g. mfcduoprints' name only applies to its
//                     "millwallboy"/"millwallgirl" variants, not the plain
//                     base version. Omit to always show the name field.
//                   shadow — a black/drop shadow behind the typed text, e.g.
//                     { color: "rgba(0,0,0,0.75)", blur: 6, offsetX: 3, offsetY: 3 }
//                     — handy for matching text onto a photographic background.
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
//   description — required to appear in the shop (mirrors cards-data.js).
//                 A short one- or two-sentence blurb about the print.
//   sizes       — required. Per-size pricing, one entry per size the print
//                 is sold at:
//                   sizes: {
//                       A5: { price: "£6.99", priceValue: 6.99 },
//                       A4: { price: "£9.99", priceValue: 9.99 },
//                       A3: { price: "£12.99", priceValue: 12.99 }
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

const CLOUD_BASE = "https://images.cockneycards.com/";

const PRINT_CATALOGUE = {
    // These two used to live in shop-prints.html's own PRODUCTS list —
    // moved here so this file is the one place you edit for either the
    // shop grid or the editor.

    "mfc-miiiii": {
        title: "Millwall Chant - Miiiiiiii",
        description: "Millwall's infamous Miiiiii... chant print will look great on any wall at home or even at work in the office.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "sports"],
        preview: "print-miiiiiiiii-preview.png",
        full: "print-miiiiiiiii.png"
        
     },
    "print-ofah-thistimenext": {
        title: "Only Fools and Horses - This Time Next Year...",
        description: "Only Fools and Horses - This Time Next Year... print will look great on any wall at home or even at work in the office.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "b&w"],
        preview: "print-thistimenextyear-preview.png",
        full: "print-thistimenextyear.png"
       
    },
    "album-oasis-dm": {
        title: "Oasis - Definitely Maybe - Album Artwork",
        description: "Oasis's Definitely Maybe album print will look great on any wall at home or even at work in the office.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "music"],
        preview: "album-oasis-dm-preview.png",
        full: "album-oasis-dm.png"
        
     },
    "album-mjbad": {
        title: "Michael Jackson - Bad",
        description: "Michael Jackson's Bad album print will look great on any wall at home or even at work in the office.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "music"],
        preview: "album-mj-bad-preview.png",
        full: "album-mj-bad.png"

    },
    "album--bobm": {
        title: "Bob Marley - Legend - Album Artwork",
        description: "Bob Marley's Legend album print will look great on any wall at home or even at work in the office.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "music"],
        preview: "album-bobm-legend-preview.png",
        full: "album-bobm-legend.png"
    },
    "album-dires": {
        title: "Dire Strait's - Brother's In Arms - Album Artwork",
        description: "Dire Strait's Brother's In Arms album print will look great on any wall at home or even at work in the office.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "music"],
        preview: "album-dires-bia-preview.png",
        full: "album-dires-bia.png"
    },
    "album-ledzep": {
        title: "Led Zeplin - IV - Album Artwork",
        description: "Led Zeplin's IV album print will look great on any wall at home or even at work in the office.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "music"],
        preview: "album-ledzep-iv-preview.png",
        full: "album-ledzep-iv.png"
    },
    "album-joydiv": {
        title: "Joy Division - Unknown Pleasures - Album Artwork",
        description: "Joy Division's Unknown Pleasures album print will look great on any wall at home or even at work in the office.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "music"],
        preview: "album-joydiv-up-preview.png",
        full: "album-joydiv-up.png"
    },
    "album-madness": {
        title: "Madness - One Step Beyond - Album Artwork",
        description: "Madness's One Step Beyond album print will look great on any wall at home or even at work in the office.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "music"],
        preview: "album-madness-osb-preview.png",
        full: "album-madness-osb.png"
    },
    "album-fleetmac": {
        title: "Fleetwood Mac - Rumours - Album Artwork",
        description: "Fleetwood Mac's Rumours album print will look great on any wall at home or even at work in the office.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "music"],
        preview: "album-fleetm-rumours-preview.png",
        full: "album-fleetm-rumours.png"
    },
    "album-doors": {
        title: "The Doors - The Doors Album - Artwork",
        description: "The Door's Album print will look great on any wall at home or even at work in the office.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "music"],
        preview: "album-doors-doors-preview.png",
        full: "album-doors-doors.png"
    },
    "album-prodigy": {
        title: "The Prodigy - Music For The Jited Generation - Album Artwork",
        description: "The Prodigy's Music For The Jited Generation album print will look great on any wall at home or even at work in the office.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "music"],
        preview: "album-prodigy-preview.png",
        full: "album-prodigy.png"
    },
    "album-pinkfloyd": {
        title: "Pink Floyd's The Dark Side of The Moon - Album Artwork",
        description: "Pink Floyd's The Dark Side of The Moon album print will look great on any wall at home or even at work in the office.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "music"],
        preview: "album-pinkfloyd-dsotm-preview.png",
        full: "album-pinkfloyd-dsotm.png"
    },
    "wham-eatsleep": {
        title: "West Ham Prints - Eat, Sleep, West Ham, Repeat",
        description: "West Ham duo prints that will look great on any wall at home or even at work in the office. Choose from either a girl or boy version.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "sports"],
        name: { label: "First Name", left: 294, top: 708, startSize: 100, minSize: 23, maxSize: 100, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 9,
            onlyForVariants: ["whamboy", "whamgirl"], // no name field on the plain full/duo version — only these two personalised variants
            shadow: { color: "rgba(0,0,0,1)", blur: 1, offsetX: -7, offsetY: 7 } // bold, hard, dark drop shadow, offset left to match the footballer silhouette shading
        },
        preview: "eatsleep-whamboy-preview-girl.png",
        full: "eatsleep-wham.png",
        variants: [
          { id: "whamboy", full: "eatsleep-whamboy.png" },
            { id: "whamgirl", full: "eatsleep-whamgirl.png" },
        ]
    }, 
    "spurs-eatsleep": {
        title: "Tottenham Hotspur Prints - Eat, Sleep, Tottenham, Repeat",
        description: "Tottenham Hotspur duo prints that will look great on any wall at home or even at work in the office. Choose from either a girl or boy version.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "sports"],
        name: { label: "First Name", left: 294, top: 708, startSize: 100, minSize: 23, maxSize: 100, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 9,
            onlyForVariants: ["spursboy", "spursgirl"], // no name field on the plain full/duo version — only these two personalised variants
            shadow: { color: "rgba(0,0,0,1)", blur: 1, offsetX: -7, offsetY: 7 } // bold, hard, dark drop shadow, offset left to match the footballer silhouette shading
        },
        preview: "eatsleep-spurs-preview-boy.png",
        full: "eatsleep-spurs.png",
        variants: [
          { id: "spursboy", full: "eatsleep-spurs-boy.png" },
            { id: "spursgirl", full: "eatsleep-spurs-girl.png" },
        ]
    },  
    "birmingham-eatsleep": {
        title: "Birmingham City Prints - Eat, Sleep, City, Repeat",
        description: "Birmingham City duo prints that will look great on any wall at home or even at work in the office. Choose from either a girl or boy version.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "sports"],
        name: { label: "First Name", left: 294, top: 708, startSize: 100, minSize: 23, maxSize: 100, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 9,
            onlyForVariants: ["birmingham-boy", "birmingham-girl"], // no name field on the plain full/duo version — only these two personalised variants
            shadow: { color: "rgba(0,0,0,1)", blur: 1, offsetX: -7, offsetY: 7 } // bold, hard, dark drop shadow, offset left to match the footballer silhouette shading
        },
        preview: "eatsleep-birmingham-previewgirl.png",
        full: "eatsleep-birmingham.png",
        variants: [
          { id: "birmingham-boy", full: "eatsleep-birmingham-boy.png" },
            { id: "birmingham-girl", full: "eatsleep-birmingham-girl.png" },
        ]
    }, 
    "palace-eatsleep": {
        title: "Crystal Palace Prints - Eat, Sleep, Palace, Repeat",
        description: "Crystal Palace duo prints that will look great on any wall at home or even at work in the office. Choose from either a girl or boy version.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "sports"],
        name: { label: "First Name", left: 294, top: 708, startSize: 100, minSize: 23, maxSize: 100, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 9,
            onlyForVariants: ["palace-boy", "palace-girl"], // no name field on the plain full/duo version — only these two personalised variants
            shadow: { color: "rgba(0,0,0,1)", blur: 1, offsetX: -7, offsetY: 7 } // bold, hard, dark drop shadow, offset left to match the footballer silhouette shading
        },
        preview: "eatsleep-palace-preview.png",
        full: "eatsleep-palace.png",
        variants: [
          { id: "palace-boy", full: "eatsleep-palace-boy.png" },
            { id: "palace-girl", full: "eatsleep-palace-girl.png" },
        ]
    }, 
    "lionesses-eatsleep": {
        title: "London City Lionesses Prints - Eat, Sleep, Lionesses, Repeat",
        description: "London City Lionesses duo prints that will look great on any wall at home or even at work in the office. Choose from either a girl or boy version.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "sports"],
        name: { label: "First Name", left: 294, top: 708, startSize: 100, minSize: 23, maxSize: 100, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 9,
            onlyForVariants: ["lionessboy", "lionessgirl"], // no name field on the plain full/duo version — only these two personalised variants
            shadow: { color: "rgba(0,0,0,1)", blur: 1, offsetX: -7, offsetY: 7 } // bold, hard, dark drop shadow, offset left to match the footballer silhouette shading
        },
        preview: "eatsleep-lionesses-preview.png",
        full: "eatsleep-lionesses.png",
        variants: [
          { id: "lionessboy", full: "eatsleep-lionesses-boy.png" },
            { id: "lionessgirl", full: "eatsleep-lionesses-girl.png" },
        ]
    },
  "millwall-eatsleep": {
        title: "Millwall Prints - Eat, Sleep, Millwall, Repeat",
        description: "Millwall duo prints that will look great on any wall at home or even at work in the office. Choose from either a girl or boy version.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "sports"],
        name: { label: "First Name", left: 294, top: 708, startSize: 100, minSize: 23, maxSize: 100, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 9,
            onlyForVariants: ["millwallboy", "millwallgirl"], // no name field on the plain full/duo version — only these two personalised variants
            shadow: { color: "rgba(0,0,0,1)", blur: 1, offsetX: -7, offsetY: 7 } // bold, hard, dark drop shadow, offset left to match the footballer silhouette shading
        },
        preview: "mfc-eatsleep-preview.png",
        full: "mfc-eatsleep.png",
        variants: [
          { id: "millwallboy", full: "mfc-eatsleepboy.png" },
            { id: "millwallgirl", full: "mfc-eatsleepgirl.png" },
        ]
    },
    "arsenal-eatsleep": {
        title: "Arsenal Prints - Eat, Sleep, Arsenal, Repeat",
        description: "Arsenal duo prints that will look great on any wall at home or even at work in the office. Choose from either a girl or boy version.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "sports"],
        name: { label: "First Name", left: 294, top: 708, startSize: 100, minSize: 23, maxSize: 100, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 9,
            onlyForVariants: ["arsenalboy", "arsenalgirl"], // no name field on the plain full/duo version — only these two personalised variants
            shadow: { color: "rgba(0,0,0,1)", blur: 1, offsetX: -7, offsetY: 7 } // bold, hard, dark drop shadow, offset left to match the footballer silhouette shading
        },
        preview: "afc-eatsleep-preview.png",
        full: "afc-eatsleep.png",
        variants: [
          { id: "arsenalboy", full: "afc-eatsleepboy.png" },
            { id: "arsenalgirl", full: "afc-eatsleepgirl.png" },
        ]
    },
    "chelsea-eatsleep": {
        title: "Chelsea Prints - Eat, Sleep, Chelsea, Repeat",
        description: "Chelsea duo prints that will look great on any wall at home or even at work in the office. Choose from either a girl or boy version.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "sports"],
        name: { label: "First Name", left: 294, top: 708, startSize: 100, minSize: 23, maxSize: 100, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 9,
            onlyForVariants: ["chelseaboy", "chelseagirl"], // no name field on the plain full/duo version — only these two personalised variants
            shadow: { color: "rgba(0,0,0,1)", blur: 1, offsetX: -7, offsetY: 7 } // bold, hard, dark drop shadow, offset left to match the footballer silhouette shading
        },
        preview: "chelsea-eatsleep-preview.png",
        full: "chelsea-eatsleep.png",
        variants: [
          { id: "chelseaboy", full: "chelsea-eatsleepboy.png" },
            { id: "chelseagirl", full: "chelsea-eatsleepgirl.png" },
        ]
    },
    "charlton-eatsleep": {
        title: "Charlton Athletic Prints - Eat, Sleep, Charlton, Repeat",
        description: "Charlton Athletic duo prints that will look great on any wall at home or even at work in the office. Choose from either a girl or boy version.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "sports"],
        name: { label: "First Name", left: 294, top: 708, startSize: 100, minSize: 23, maxSize: 100, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 9,
            onlyForVariants: ["charltonboy", "charltongirl"], // no name field on the plain full/duo version — only these two personalised variants
            shadow: { color: "rgba(0,0,0,1)", blur: 1, offsetX: -7, offsetY: 7 } // bold, hard, dark drop shadow, offset left to match the footballer silhouette shading
        },
        preview: "eatsleep-charlton-girl-preview.png",
        full: "eatsleep-charlton.png",
        variants: [
          { id: "charltonboy", full: "eatsleep-charlton-boy.png" },
            { id: "charltongirl", full: "eatsleep-charlton-girl.png" },
        ]
    },
    "city-eatsleep": {
        title: "Manchester City Prints - Eat, Sleep, City, Repeat",
        description: "Manchester City duo prints that will look great on any wall at home or even at work in the office. Choose from either a girl or boy version.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "sports"],
        name: { label: "First Name", left: 294, top: 708, startSize: 100, minSize: 23, maxSize: 100, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 9,
            onlyForVariants: ["cityboy", "citygirl"], // no name field on the plain full/duo version — only these two personalised variants
            shadow: { color: "rgba(0,0,0,1)", blur: 1, offsetX: -7, offsetY: 7 } // bold, hard, dark drop shadow, offset left to match the footballer silhouette shading
        },
        preview: "city-eatsleep-preview.png",
        full: "city-eatsleep.png",
        variants: [
          { id: "cityboy", full: "city-eatsleepboy.png" },
            { id: "citygirl", full: "city-eatsleepgirl.png" },
        ]
    },
    "villa-eatsleep": {
        title: "Aston Villa Prints - Eat, Sleep, Villa, Repeat",
        description: "Aston Villa duo prints that will look great on any wall at home or even at work in the office. Choose from either a girl or boy version.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "sports"],
        name: { label: "First Name", left: 294, top: 708, startSize: 100, minSize: 23, maxSize: 100, fontFamily: "Anton", fontWeight: "normal", color: "#ffffff", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 9,
            onlyForVariants: ["villaboy", "villagirl"], // no name field on the plain full/duo version — only these two personalised variants
            shadow: { color: "rgba(0,0,0,1)", blur: 1, offsetX: -7, offsetY: 7 } // bold, hard, dark drop shadow, offset left to match the footballer silhouette shading
        },
        preview: "eatsleep-villaboy-preview-girl.png",
        full: "eatsleep-villa.png",
        variants: [
          { id: "villaboy", full: "eatsleep-villaboy1.png" },
            { id: "villagirl", full: "eatsleep-villagirl1.png" },
        ]
    }, 
    "united-eatsleep": {
        title: "Manchester United Prints - Eat, Sleep, United, Repeat",
        description: "Manchester United duo prints that will look great on any wall at home or even at work in the office. Choose from either a girl or boy version.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "sports"],
        name: { label: "First Name", left: 294, top: 708, startSize: 100, minSize: 23, maxSize: 100, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 9,
            onlyForVariants: ["munitedboy", "munitedgirl"], // no name field on the plain full/duo version — only these two personalised variants
            shadow: { color: "rgba(0,0,0,1)", blur: 1, offsetX: -7, offsetY: 7 } // bold, hard, dark drop shadow, offset left to match the footballer silhouette shading
        },
        preview: "eatsleep-munited-preview.png",
        full: "eatsleep-munited.png",
        variants: [
          { id: "munitedboy", full: "eatsleep-munited-boy.png" },
            { id: "munitedgirl", full: "eatsleep-munited-girl.png" },
        ]
    },   
    "houserules": {
        title: "Dog's House Rules",
        description: "Based on a quote from the film Turner & Hooch. Great for all Dog lover's.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "b&w"],
        preview: "doghouserules-preview.png",
        full: "doghouserules.png"

    },    
    "itsnotwhatwehave": {
        title: "It's Not What We Have In Life...",
        description: "A heartfelt black & white quote print about family, love, and togetherness.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "b&w"],
        preview: "itsnotwhatwehave-preview.png",
        full: "itsnotwhatwehave.png"
    },
    "underthesea": {
        title: "Under The Sea",
        description: "A colourful under-the-sea print for kids, personalised with their name.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "childrens"],
        name: { label: "First Name", left: 378, top: 120, startSize: 56, minSize: 25, maxSize: 35, fontFamily: "LuckiestGuy", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 8, forceUppercase: false },
        preview: "underthesea_a-preview.png",
        full: "underthesea_a.png",
        variants: [
          { id: "underthesea_b", full: "underthesea_b.png" },
          { id: "underthesea_c", full: "underthesea_c.png" },
        ]
    },
    "dinobones": {
        title: "Dinosaur Bones Duo Set",
        description: "Bring prehistoric adventure to any boy’s bedroom with this cool dinosaur bones print. A fun and eye-catching design that’s perfect for little dinosaur fans and adds a roar-some touch to their room!",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "childrens"],
        preview: "dino-bones-preview.png",
        full: "dino-bones1.png",
        variants: [
          { id: "dino-bones2", full: "dino-bones2.png" },
        ]
    },
    "oasis-dontlookback": {
        title: "Oasis - Dont Look Back...",
        description: "A classic Britpop-inspired print for Oasis fans.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "b&w", "music"],
        preview: "oasis-dontlookback-preview.png",
        full: "oasis-dontlookback.png"
    },
    "wham-massive": {
        title: "West Ham Are Massive!",
        description: "A bold print for West Ham fans, celebrating the Irons.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "sports"],
        preview: "wham-massive-preview.png",
        full: "wham-massive.png"
    },
    "mfc-stone": {
        title: "MFC Stone Island",
        description: "A stylish sports-casual print for fans of the terrace look.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "sports"],
        preview: "mfc-stone-preview.png",
        full: "mfc-stone.png"
    },
    "mfc-boy1": {
        title: "MFC Boy 1",
        description: "A personalised football print for boys, add their name and shirt number.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "sports"],
        preview: "mfc-boy1-preview.png",
        full: "mfc-boy1.png",
        name: { label: "First Name", left: 287, top: 585, startSize: 30, minSize: 25, maxSize: 35, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: false, canMove: false, canRotate: false, isCurved: true, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 12 },
        age: { label: "Age", left: 287, top: 650, startSize: 70, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" },
    },
    "mfc-boy2": {
        title: "MFC Boy 2",
        description: "A personalised football print for boys, add their name and shirt number.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "sports"],
        preview: "mfc-boy2-preview.png",
        full: "mfc-boy2.png",
        name: { label: "First Name", left: 287, top: 585, startSize: 30, minSize: 25, maxSize: 35, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: false, canMove: false, canRotate: false, isCurved: true, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 12 },
        age: { label: "Age", left: 287, top: 650, startSize: 70, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" },
    },
    "afc-boy1": {
        title: "AFC Boy 1",
        description: "A personalised football print for boys, add their name and shirt number.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "sports"],
        preview: "afc-boy1-preview.png",
        full: "afc-boy1.png",
        name: { label: "First Name", left: 286, top: 610, startSize: 30, minSize: 25, maxSize: 35, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: false, canMove: false, canRotate: false, isCurved: true, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 12 },
        age: { label: "Age", left: 286, top: 675, startSize: 70, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" },
    },
    "afc-boy2": {
        title: "AFC Boy 2",
        description: "A personalised football print for boys, add their name and shirt number.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "sports"],
        preview: "afc-boy2-preview.png",
        full: "afc-boy2.png",
        name: { label: "First Name", left: 286, top: 610, startSize: 30, minSize: 25, maxSize: 35, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: false, canMove: false, canRotate: false, isCurved: true, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 12 },
        age: { label: "Age", left: 286, top: 675, startSize: 70, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" },
    },
    "afc-boy3": {
        title: "AFC Boy 3",
        description: "A personalised football print for boys, add their name and shirt number.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "sports"],
        preview: "afc-boy3-preview.png",
        full: "afc-boy3.png",
        name: { label: "First Name", left: 286, top: 610, startSize: 30, minSize: 25, maxSize: 35, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: false, canMove: false, canRotate: false, isCurved: true, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 12 },
        age: { label: "Age", left: 286, top: 673, startSize: 70, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" }, 
    },
    "afc-girl1": {
        title: "AFC Girl 1",
        description: "A personalised football print for girls, add their name and shirt number.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "sports"],
        preview: "afc-girl1-preview.png",
        full: "afc-girl1.png",
        name: { label: "First Name", left: 305, top: 615, startSize: 28, minSize: 23, maxSize: 30, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: false, canMove: false, canRotate: false, isCurved: true, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 12 },
        age: { label: "Age", left: 305, top: 675, startSize: 70, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" },
    },
    "afc-girl2": {
        title: "AFC Girl 2",
        description: "A personalised football print for girls, add their name and shirt number.",
        price: "£6.99", priceValue: 6.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "sports"],
        preview: "afc-girl2-preview.png",
        full: "afc-girl2.png",
        name: { label: "First Name", left: 294, top: 615, startSize: 28, minSize: 23, maxSize: 30, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: false, canMove: false, canRotate: false, isCurved: true, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 12 },
        age: { label: "Age", left: 294, top: 675, startSize: 70, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" },
    },

    // Example of a print WITH name personalisation, for reference:
    "sample-print": {
        full: "v1784098145/prints/sample-print-full.png",
        price: "£6.99", priceValue: 6.99,
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
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
        price: "£6.99", priceValue: 6.99,
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        name: { label: "First Name", left: 200, top: 725, startSize: 48, color: "#FFFFFF" },
        age: { label: "Age", left: 200, top: 600, startSize: 56, color: "#FFFFFF" },
        name2: { label: "Second Name", left: 400, top: 725, startSize: 48, color: "#FFFFFF" },
        age2: { label: "Age", left: 400, top: 600, startSize: 56, color: "#FFFFFF" }
    }
};
