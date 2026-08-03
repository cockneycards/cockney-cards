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
//   extraFields — optional, same idea, for any number of extra label+value
//                 fields (e.g. "Event:", "Date:").
//
// Leave out `name`/`age`/`extraFields` completely for a print that's just
// artwork with no personalisation at all.

const CLOUD_BASE = "https://res.cloudinary.com/uzf4eeky/image/upload/";

const PRINT_CATALOGUE = {
    // Pulled straight from shop-prints.html's PRODUCTS list — same
    // Cloudinary file used for both the shop thumbnail AND the editor
    // artwork, since that's the only URL shop-prints.html had for each.
    // If you've got a separate, higher-res "full" file for either print
    // (better for actual A3 printing than a web thumbnail), swap the path
    // below for that one.
    //
    // Neither has a `name` field yet — add one (see the sample below) if
    // either print should let the customer personalise a name, then use
    // the findCoords() console helper in editor-prints.html to get exact
    // left/top numbers for that artwork.
    "millwall-dad-son-print": {
        full: "v1784120947/millwall-dad-son_e48hgt.png"
    },
    "bermondsey-legend-print": {
        full: "v1784120944/you-can-take_cbses4.png"
    },

    // Example of a print WITH name personalisation, for reference:
    "sample-print": {
        full: "v1784098145/prints/sample-print-full.png",
        name: { left: 297.75, top: 725, startSize: 52, color: "#FFFFFF" }
    }
};
