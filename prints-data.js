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

  "millwall-eatsleep": {
        title: "Millwall Prints - Eat, Sleep, Millwall, Repeat",
        description: "Millwall duo prints that will look great in a bedroom or office.",
        price: "£4.99", priceValue: 4.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "sports"],
        name: { label: "First Name", left: 294, top: 708, startSize: 100, minSize: 23, maxSize: 100, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 9,
            onlyForVariants: ["millwallboy", "millwallgirl"], // no name field on the plain full/duo version — only these two personalised variants
            shadow: { color: "rgba(0,0,0,1)", blur: 1, offsetX: 7, offsetY: 7 } // bold, hard, dark drop shadow matching the Danielle reference print
        },
        preview: "v1786525808/mfc-eatsleep-preview_a4dou9.png",
        full: "v1786525879/mfc-eatsleep_psnawt.png",
        variants: [
          { id: "millwallboy", full: "v1786525880/mfc-eatsleepboy_l8kozj.png" },
            { id: "millwallgirl", full: "v1786525879/mfc-eatsleepgirl_mgpc3x.png" },
        ]
    },
    "arsenal-eatsleep": {
        title: "Arsenal Prints - Eat, Sleep, Arsenal, Repeat",
        description: "Arsenal duo prints that will look great in a bedroom or office.",
        price: "£4.99", priceValue: 4.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "sports"],
        name: { label: "First Name", left: 294, top: 708, startSize: 100, minSize: 23, maxSize: 100, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 9,
            onlyForVariants: ["arsenalboy", "arsenalgirl"], // no name field on the plain full/duo version — only these two personalised variants
            shadow: { color: "rgba(0,0,0,1)", blur: 1, offsetX: 7, offsetY: 7 } // bold, hard, dark drop shadow matching the Danielle reference print
        },
        preview: "v1786536693/afc-eatsleep-preview_rrtfve.png",
        full: "v1786532185/afc-eatsleep_trxugb.png",
        variants: [
          { id: "arsenalboy", full: "v1786532182/afc-eatsleepboy_kbfdah.png" },
            { id: "arsenalgirl", full: "v1786532183/afc-eatsleepgirl_eljiif.png" },
        ]
    },
    "city-eatsleep": {
        title: "Manchester City Prints - Eat, Sleep, City, Repeat",
        description: "Manchester City duo prints that will look great in a bedroom or office.",
        price: "£4.99", priceValue: 4.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "sports"],
        name: { label: "First Name", left: 294, top: 708, startSize: 100, minSize: 23, maxSize: 100, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 9,
            onlyForVariants: ["cityboy", "citygirl"], // no name field on the plain full/duo version — only these two personalised variants
            shadow: { color: "rgba(0,0,0,1)", blur: 1, offsetX: 7, offsetY: 7 } // bold, hard, dark drop shadow matching the Danielle reference print
        },
        preview: "v1786536695/city-eatsleep-preview_cktda8.png",
        full: "v1786532195/city-eatsleep_d3j7ca.png",
        variants: [
          { id: "cityboy", full: "v1786532198/city-eatsleepboy_ecpyd3.png" },
            { id: "citygirl", full: "v1786532200/city-eatsleepgirl_romiae.png" },
        ]
    },
    "chelsea-eatsleep": {
        title: "Chelsea Prints - Eat, Sleep, Chelsea, Repeat",
        description: "Chelsea duo prints that will look great in a bedroom or office.",
        price: "£4.99", priceValue: 4.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "sports"],
        name: { label: "First Name", left: 294, top: 708, startSize: 100, minSize: 23, maxSize: 100, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 9,
            onlyForVariants: ["chelseaboy", "chelseagirl"], // no name field on the plain full/duo version — only these two personalised variants
            shadow: { color: "rgba(0,0,0,1)", blur: 1, offsetX: 7, offsetY: 7 } // bold, hard, dark drop shadow matching the Danielle reference print
        },
        preview: "v1786536692/chelsea-eatsleep-preview_uivgav.png",
        full: "v1786532189/chelsea-eatsleep_iqyj3n.png",
        variants: [
          { id: "chelseaboy", full: "v1786532188/chelsea-eatsleepboy_mcvzgh.png" },
            { id: "chelseagirl", full: "v1786532186/chelsea-eatsleepgirl_lcgmib.png" },
        ]
    },
    "united-eatsleep": {
        title: "Manchester United Prints - Eat, Sleep, United, Repeat",
        description: "Manchester United duo prints that will look great in a bedroom or office.",
        price: "£4.99", priceValue: 4.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "sports"],
        name: { label: "First Name", left: 294, top: 708, startSize: 100, minSize: 23, maxSize: 100, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 9,
            onlyForVariants: ["unitedboy", "unitedgirl"], // no name field on the plain full/duo version — only these two personalised variants
            shadow: { color: "rgba(0,0,0,1)", blur: 1, offsetX: 7, offsetY: 7 } // bold, hard, dark drop shadow matching the Danielle reference print
        },
        preview: "v1786536697/united-eatsleep-preview_nvhkbv.png",
        full: "v1786532193/united-eatsleep_xi5vq1.png",
        variants: [
          { id: "unitedboy", full: "v1786532196/united-eatsleepboy_ljmjd8.png" },
            { id: "unitedgirl", full: "v1786532191/united-eatsleepgirl_cvlkj4.png" },
        ]
    },    
   "dinosaurs": {
        title: "Dinosaur Duo",
        description: "Dinosaur duo prints that will look great in a bedroom or office.",
        price: "£4.99", priceValue: 4.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£6.99", priceValue: 6.99 },
            A4: { price: "£9.99", priceValue: 9.99 },
            A3: { price: "£12.99", priceValue: 12.99 }
        },
        categories: ["all", "childrens"],
        preview: "v1786517574/dinosaurs_ks45z8.png",
        full: "v1786517645/dinosaurwoof_tojwk7.png",
        variants: [
          { id: "dinosauraghh", full: "v1786517644/dinosauraghh_pfrkfd.png" },
        ]
    },    
    "itsnotwhatwehave": {
        title: "It's Not What We Have In Life...",
        description: "A heartfelt black & white quote print about family, love, and togetherness.",
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
    "underthesea": {
        title: "Under The Sea",
        description: "A colourful under-the-sea print for kids, personalised with their name.",
        price: "£4.99", priceValue: 4.99, // "from" price shown on the shop grid (cheapest size, A5)
        sizes: {
            A5: { price: "£4.99", priceValue: 4.99 },
            A4: { price: "£6.99", priceValue: 6.99 },
            A3: { price: "£9.99", priceValue: 9.99 }
        },
        categories: ["all", "childrens"],
        name: { label: "First Name", left: 378, top: 137, startSize: 56, minSize: 25, maxSize: 35, fontFamily: "LuckiestGuy", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 8, forceUppercase: false },
        preview: "v1786458212/underthesea_a-preview_adonqr.png",
        full: "v1786513592/underthesea_a_lxanyr.png",
        variants: [
          { id: "underthesea_b", full: "v1786513600/underthesea_b_pqbkux.png" },
          { id: "underthesea_c", full: "v1786513581/underthesea_c_qrvctm.png" },
        ]
    },
    "oasis-dontlookback": {
        title: "Oasis - Dont Look Back...",
        description: "A classic Britpop-inspired print for Oasis fans.",
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
        description: "A bold print for West Ham fans, celebrating the Irons.",
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
        description: "A stylish sports-casual print for fans of the terrace look.",
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
        description: "A personalised football print for boys, add their name and shirt number.",
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
        description: "A personalised football print for boys, add their name and shirt number.",
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
        description: "A personalised football print for boys, add their name and shirt number.",
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
        description: "A personalised football print for boys, add their name and shirt number.",
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
        description: "A personalised football print for boys, add their name and shirt number.",
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
        description: "A personalised football print for girls, add their name and shirt number.",
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
        description: "A personalised football print for girls, add their name and shirt number.",
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
