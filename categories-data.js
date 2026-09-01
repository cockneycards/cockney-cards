// Shared category tree — used by both shop-cards.html (via cards-data.js)
// and shop-prints.html (via prints-data.js). Kept in its own file so a
// change here (e.g. adding a new team or league) applies to cards and
// prints alike, instead of two copies drifting apart.
//
// Load this BEFORE cards-data.js / prints-data.js in any page that needs
// it — those files (and the shop pages' own inline scripts) reference the
// CATEGORIES global defined here.

const CATEGORIES = [
  ["all", "All Cards"],
  ["music", "Music"],
  ["b&w", "Black & White"],
  ["childrens", "Childrens"],
  ["for-her", "Cards For Her"],
  ["for-him", "Cards For Him"],
  ["photo-upload", "Photo Upload Cards"],
  ["birthdays", "Birthday Cards", [
  ["family", "Family", [
    ["mum", "Mum"],
    ["dad", "Dad"],
    ["nan", "Nan"],
    ["grandad", "Grandad"],
      ]],
  ["newbaby", "New Baby"],
  ["thank-you", "Thank You! Cards"],
  ["weddings-engagements", "Wedding & Engagement Cards"],
  ["home", "New Home Cards"],
  ["school-cards", "School Cards"],
  ["work-related", "Work Related Cards"],
  ["achievements", "Personal Achievement Cards"],
  ["children", "Childrens Cards"],
  ["tv-movies", "TV / Movie Cards"],
  ["mothersday-fathersday", "Mothers & Fathers Day Cards "],
  ["valentines", "Valentines"],
  ["christmas", "Christmas"],
  ["sports", "Sports Cards", [
    ["football", "Football", [
      ["premiership", "Premiership", [
        ["arsenal", "Arsenal"],
        ["chelsea", "Chelsea"],
        ["liverpool", "Liverpool"],
        ["tottenham", "Tottenham"],
      ]],
      ["championship", "Championship", [
        ["millwall", "Millwall"],
        ["west-ham", "West Ham"],
      ]],
      ["league-1", "League 1"],
      ["league-2", "League 2"],
      ["wsl", "WSL / WSL2", [
        ["arsenal", "Arsenal"],
        ["man-cityw", "Manchester City"],
        ["man-utdw", "Manchester United"],
        ["liverpool", "Liverpool"],
        ["tottenham", "Tottenham"],
        ["westhamw", "West Ham"],
        ["brighton", "Brighton"],
      ]],
    ]],
    ["golf", "Golf"],
    ["cricket", "Cricket"],
    ["formula1", "Formula 1"],
    ["rugby", "Rugby"],
    ["netball", "Netball"],
    ["darts", "Darts"],
    ["horseracing", "Horse Racing"],
  ]],

];
