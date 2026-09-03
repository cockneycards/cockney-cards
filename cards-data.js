const CLOUD_BASE = "https://images.cockneycards.com/";
const DEFAULT_PRICE = "£2.99";

// CATEGORIES now lives in categories-data.js — shared with prints-data.js
// / shop-prints.html so both catalogues use the same tree (and stay in
// sync when a team or league gets added). Make sure categories-data.js
// is loaded BEFORE this file wherever this file is included.

const CARD_CATALOGUE = {
  "11plus-boy": { title: "11 Plus Boy Card", categories: ["school-cards", "achievements"], preview: "11plus-boy-preview.png", full: "11plus-boy.png" },
  "11plus-girl": { title: "11 Plus Girl Card", categories: ["school-cards", "achievements"], preview: "11plus-girl-preview.png", full: "11plus-girl.png" },
  "11plus-kids": { title: "11 Plus Kids Card", categories: ["school-cards", "achievements"], preview: "11plus-kids-preview.png", full: "11plus-kids.png" },

  "birthday-80sbirthday": { title: "80s Retro Birthday Card", categories: ["all", "birthdays", "tv-movies"], preview: "80s-birthday-preview.png", full: "80s-birthday.png" },
  "birthday-90sbirthday": { title: "90s Retro Birthday Card", categories: ["all", "birthdays", "tv-movies"], preview: "90s-birthday-preview.png", full: "90s-birthday.png" },
  "birthday-artsy-girl": { title: "Artsy Girl Card", categories: ["all", "children", "birthdays"], preview: "artsy-girl-preview.png", full: "artsy-girl.png" },
  "birthday-beerboy": { title: "Birthday Beer", categories: ["all", "birthdays"], preview: "birthday-beer-preview.png", full: "birthday-beer.png" },
  "birthday-grandad1": { title: "Grandads Garden", categories: ["grandad", "birthdays"], preview: "birthday-grandad1-preview.png", full: "birthday-grandad1.png" },
  "birthday-sweetie": { title: "Sweet Birthday", categories: ["all", "birthdays"], preview: "birthday-sweetie-preview.png", full: "birthday-sweetie.png" },
  "birthday-horse-girl": { title: "Racing Lady", categories: ["all", "horseracing", "birthdays"], preview: "birthday-horse-girl-preview.png", full: "birthday-horse-girl.png" },
  "birthday-horse-boy": { title: "Racing Gent", categories: ["all", "horseracing", "birthdays"], preview: "birthday-horse-boy-preview.png", full: "birthday-horse-boy.png" },
  "birthday-gymgirl": { title: "Gym Birthday Babe", categories: ["all", "birthdays"], preview: "birthday-gymgirl-preview.png", full: "birthday-gymgirl.png" },
  "birthday-gymboy": { title: "Gym Bro Birthday", categories: ["all", "birthdays"], preview: "birthday-gymboy-preview.png", full: "birthday-gymboy.png" },
  "birthday-f1-racer": { title: "F1 Racer", categories: ["all", "birthdays", "formula1", "children"], preview: "birthday-f1-racer-preview.png", full: "birthday-f1-racer.png" },
  "birthday-cake1": { title: "Birthday Cake", categories: ["all", "birthdays"], preview: "birthday-cake1-preview.png", full: "birthday-cake1.png" },
  "birthday-baking-girl": { title: "Baking Girls Birthday", categories: ["all", "birthdays"], preview: "birthday-baking-girl-preview.png", full: "birthday-baking.png" },
  "birthday-beachhut": { title: "Beach Hut Birthday", categories: ["all", "birthdays"], preview: "birthday-beachhut-preview.png", full: "birthday-beachhut.png" },
  "birthday-coffee-cake": { title: "Coffee & Cake", categories: ["all", "birthdays"], preview: "birthday-coffee-cake-preview.png", full: "birthday-coffee-cake.png" },
  "birthday-flowers": { title: "Birthday Flowers", categories: ["all", "birthdays"], preview: "birthday-flowers-preview.png", full: "birthday-flowers.png" },
  "birthday-vintagegolf": { title: "Vintage Golfer", categories: ["all", "birthdays", "golf", "sports"], preview: "birthday-vintagegolf-preview.png", full: "birthday-vintagegolf.png" },
  "birthday-vintagefootball": { title: "Vintage Footballer", categories: ["all", "birthdays", "football", "sports"], preview: "birthday-vintagefootball-preview.png", full: "birthday-vintagefootball.png" },
  "birthday-vintagefishing": { title: "Vintage Fishing", categories: ["all", "birthdays", "sports"], preview: "birthday-vintagefishing-preview.png", full: "birthday-vintagefishing.png" },
  "birthday-lavenderfield": { title: "Lavender Field", categories: ["all", "birthdays"], preview: "birthday-lavenderfield-preview.png", full: "birthday-lavenderfield.png" },
  "birthday-bikers": { title: "Biker Boy", categories: ["all", "birthdays"], preview: "birthday-bikers-preview.png", full: "birthday-bikers.png" },
  "birthday-cupcakes": { title: "Birthday Cupcakes", categories: ["all", "birthdays"], preview: "birthdaycupcakes-preview.png", full: "birthdaycupcakes.png" },
  
  "birthday-grandad-horseracingtv": { title: "Grandad's Horse Racing", categories: ["grandad", "birthdays", "horseracing"], preview: "birthday-grandad-horseracingtv-preview.png", full: "birthday-grandad-horseracingtv.png" },
  "birthday-grandad-football-girl": { title: "Grandad & Granddaughter Football", categories: ["birthdays", "grandad"], preview: "birthday-grandad-football-girl-preview.png", full: "birthday-grandad-football-girl.png" },
  "birthday-grandad-football-garden": { title: "Grandad & Grandson Football", categories: ["birthdays", "grandad"], preview: "birthday-grandad-football-garden-preview.png", full: "birthday-grandad-football-garden.png" },
  "birthday-grandad-catch-girl": { title: "Grandad & Granddaughter Playing Catch", categories: ["grandad", "birthdays"], preview: "birthday-grandad-catch-girl-preview.png", full: "birthday-grandad-catch-girl.png" },
  "birthday-grandad-fishing-boy": { title: "Grandad & Grandson Fishing", categories: ["birthdays", "grandad"], preview: "birthday-grandad-fishing-preview.png", full: "birthday-grandad-fishing.png" },
  "birthday-grandads-caravan": { title: "Grandads Caravan", categories: ["all", "birthdays", "grandad"], preview: "grandads-caravan-preview.png", full: "grandads-caravan.png" },
  
  "birthday-greatestmum": { title: "Greatest Mum Birthday", categories: ["all", "mum", "birthdays"], preview: "greatestmum-preview.png", full: "greatestmum.png" },
  "birthday-super-mum": { title: "Super Mum", categories: ["all", "mum", "birthdays"], preview: "super-mum-preview.png", full: "my-super-mum.png" },
  "birthday-best-mum-ever": { title: "Best Mum Ever", categories: ["all", "mum", "birthdays"], preview: "best-mum-ever-preview.png", full: "best-mum-ever.png" },
  "birthday-superbusy-mum": { title: " Super Busy Mum", categories: ["all", "mum", "birthdays"], preview: "superbusy-mum-preview.png", full: "superbusy-mum.png" },
  "birthday-mum-photo1": { title: "Happy Birthday Mum", price: "£3.49", categories: ["mum", "birthdays", "photo-upload"], preview: "mum-photo1-preview.png", full: "mum-photo1.png",
    photo: { left: 890, top: 500, width: 408.1, height: 340 } },

  "birthday-dad-photo1": { title: "Happy Birthday Dad", price: "£3.49", categories: ["dad", "birthdays", "photo-upload"], preview: "dad-photo1-preview.png", full: "dad-photo1.png",
    photo: { left: 897, top: 465, width: 440, height: 320 } },
  
  "birthday-handsomehubby": { title: "Handsome Hubby Birthday", price: "£3.49", categories: ["all", "birthdays", "photo-upload"], preview: "handsomehubby-preview.png", full: "handsomehubby.png",
    photo: { left: 890, top: 410, width: 405, height: 405 } },
  
  "birthday-nan-puddles": { title: "Puddles with Nan", categories: ["all", "nan", "birthdays"], preview: "nan-puddles-preview.png", full: "nan-puddles.png" },
  "birthday-baking-nan": { title: "Nans Bakery", categories: ["all", "nan", "birthdays"], preview: "baking-nan-preview.png", full: "baking-nan.png" },
  "birthday-nans-garden": { title: "Nans Garden", categories: ["all", "nan", "birthdays"], preview: "nansgarden-preview.png", full: "nansgarden.png" },
  "birthday-nan1": { title: "Nans Country Garden", categories: ["nan", "birthdays"], preview: "birthday-nan1-preview.png", full: "birthday-nan1.png" },
  
  "birthday-butterflies": { title: "Birthday Butterflies", categories: ["all", "birthdays"], preview: "birthdaybutterflies-preview.png", full: "birthdaybutterflies.png" },
  "birthday-bbqboss": { title: "BBQ Boss Birthday", categories: ["all", "birthdays"], preview: "bbqboss-preview.png", full: "bbqboss.png", name: { left: 894, top: 287, startSize: 68, minSize: 68, maxSize: 70, fontFamily: "Anton", fontWeight: "normal", color: "#feeec6", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 700, tiltAngle: 0, label: "Name", maxChars: 9 } },
  "birthday-djboy": { title: "DJ Boy Card", categories: ["all", "birthdays"], preview: "dj-boy-preview.png", full: "dj-boy.png" },
  "birthday-gamer-boy": { title: "Game Boy", categories: ["all", "birthdays", "children"], preview: "gaming-boy-preview.png", full: "gaming-boy.png" },
  "birthday-gamer-girl": { title: "Game Girl", categories: ["all", "birthdays", "children"], preview: "gaming-girl-preview.png", full: "gaming-girl.png" },
  "birthday-gamer-fortnite-boy": { title: "Fortnite Boy", categories: ["all", "birthdays", "children"], preview: "gaming-fortnite-boy-preview.png", full: "gaming-fortnite-boy.png", name: { left: 890, top: 331, startSize: 88, minSize: 80, maxSize: 95, fontFamily: "Anton", fontWeight: "normal", color: "#ffc700", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 500, tiltAngle: 0, label: "Name", maxChars: 9 } },
  "birthday-gamer-fortnite-girl": { title: "Fortnite Girl", categories: ["all", "birthdays", "children"], preview: "gaming-fortnite-girl-preview.png", full: "gaming-fortnite-girl_.png", name: { left: 885, top: 270, startSize: 88, minSize: 75, maxSize: 90, fontFamily: "Anton", fontWeight: "normal", color: "#ffffff", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 500, tiltAngle: 0, label: "Name", maxChars: 7 } },
  "birthday-ladies-lunch": { title: "Ladies Lunch Card", categories: ["all", "birthdays"], preview: "ladies-lunch-preview.png", full: "ladies-lunch.png" },
  "birthday-ladies-shopping": { title: "Ladies Shopping Card", categories: ["all", "birthdays"], preview: "ladies-shopping-preview.png", full: "ladies-shopping.png" },
  "birthday-bttf": { title: "Back to the Future TV Card", categories: ["all", "birthdays", "tv-movies"], preview: "birthday-bttf_preview.png", full: "birthday-bttf.png" },
  "birthday-inbetweeners": { title: "The Inbetweeners TV Card", categories: ["all", "birthdays", "tv-movies"], preview: "birthday-inbetweeners-preview.png", full: "birthday-inbetweeners.png" },
  "jaws-smile": { title: "JAWS Smile You Son of..", categories: ["all", "tv-movies", "birthdays"], preview: "jaws-smile-preview.png", full: "jaws-smile.png" },
  "jaws-cake": { title: "JAWS Your Gonna Need a Bigger...", categories: ["all", "tv-movies", "birthdays"], preview: "jaws-biggercake-preview.png", full: "jaws-biggercake.png" },
  "birthday-ofah": { title: "OFAH, You Plonker!!", categories: ["all", "birthdays", "tv-movies"], preview: "birthday-ofah_preview.png", full: "birthday-ofah.png" },
  "birthday-mod": { title: "Mod Birthday", categories: ["all", "birthdays", "tv-movies"], preview: "mod-birthday-preview.png", full: "mod-birthday.png" },
  "birthday-youngones": { title: "The Young Ones", categories: ["all", "birthdays", "tv-movies"], preview: "birthday-youngones-preview.png", full: "birthday-youngones.png" },
  "birthday-charlie-says": { title: "Charlie Says..", categories: ["all", "birthdays"], preview: "charlie-says-preview.png", full: "charlie-says.png" },
  "birthday-wine-girls": { title: "Wine Girls Card", categories: ["all", "birthdays"], preview: "wine-girls-preview.png", full: "wine-girls.png" },
  "birthday-dad-learntoride": { title: "Learning to Ride a Bike", categories: ["all", "dad", "birthdays"], preview: "dad-learntoride-preview.png", full: "dad-learntoride.png" },
  "birthday-dad-diydad": { title: "DIY Dad", categories: ["all", "dad", "birthdays"], preview: "dad-diydad-preview.png", full: "dad-diydad.png" },
  "birthday-fabbirthday": { title: "Fab Birthday", categories: ["all", "birthdays"], preview: "fabbirthday-preview.png", full: "fabbirthday.png" },
  "birthday-boys-party": { title: "Boys Birthday Party", categories: ["children", "birthdays"], preview: "boys-party-preview.png", full: "boys-party.png" },
  "birthday-dinos-birthday": { title: "Dinos Birthday", categories: ["children", "birthdays"], preview: "dinos-birthday-preview.png", full: "dinos-birthday.png" },
  "birthday-girls-party": { title: "Girls Birthday Party", categories: ["children", "birthdays"], preview: "girls-party-preview.png", full: "girls-party.png" },
  "birthday-boys-toys": { title: "Boys Toys", categories: ["children", "birthdays"], preview: "boys-toys-preview.png", full: "boys-toys.png" },
  "birthday-girls-toys": { title: "Girls Toys", categories: ["children", "birthdays"], preview: "girls-toys-preview.png", full: "girls-toys.png" },
  "birthday-girls-toys": { title: "Girls Toys", categories: ["children", "birthdays"], preview: "girls-toys-preview.png", full: "girls-toys.png" },
  "birthday-minecraft-girly": { title: "Minecraft Girl", categories: ["children", "birthdays"], preview: "minecraft-girly-preview.png", full: "minecraft-girly.png" },
  "birthday-minecraft-boy": { title: "Minecraft Birthday Boy", categories: ["children", "birthdays"], preview: "minecraft-boy1-preview.png", full: "minecraft-boy.png", name: { left: 895, top: 290, startSize: 80, minSize: 35, maxSize: 60, fontFamily: "CaacupeOne-Regular", fontWeight: "bold", color: "#004aad", canChangeSize: false, canChangeColor: false, canMove: true, canRotate: false, isCurved: false, curveRadius: 0, tiltAngle: 0, label: "Name", maxChars: 9 } },
  "birthday-minecraft-girl": { title: "Minecraft Birthday Girl", categories: ["children", "birthdays"], preview: "minecraft-girl1-preview.png", full: "minecraft-girl1.png", name: { left: 894, top: 744, startSize: 110, minSize: 35, maxSize: 60, fontFamily: "CaacupeOne-Regular", fontWeight: "bold", color: "#5e17eb", canChangeSize: false, canChangeColor: false, canMove: true, canRotate: false, isCurved: false, curveRadius: 0, tiltAngle: 0, label: "Name", maxChars: 9 } },
  

  "birthday-taxi": { title: "Birthday Taxi", price: "£3.49", categories: ["all", "birthdays", "photo-upload"], preview: "birthday-taxi-preview.png", full: "birthday-taxi.png", name: { left: 895, top: 668, startSize: 27, minSize: 28, maxSize: 28, maxSize: 86, fontFamily: "Anton", fontWeight: "normal", color: "#000000", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 480, tiltAngle: 0, label: "Name", maxChars: 10 },
    // Round gold-ringed photo window near the top of the card — measured
    // from the artwork itself, NOT the generic default box. left/top is
    // the center of the circle; width/height is a square slightly larger
    // than the circle's diameter (the artwork's own round cutout does the
    // actual round clipping, so the square only needs to fully cover it).
    photo: { left: 733, top: 178, width: 240, height: 230 } },
  
  
  "drivingtest-boy1": { title: "Driving Test Pass Boy", categories: ["all", "achievements"], preview: "drivingtest-boy1-preview.png", full: "drivingtest-boy1.png",
    variants: [
      { id: "drivingtest-boy1-brown", full: "drivingtest-boy3.png" },
      { id: "drivingtest-boy1-blonde", full: "drivingtest-boy2.png" },
    ] },                   
  
  "drivingtest-girl1": { title: "Driving Test Pass Girl", categories: ["all", "achievements"], preview: "drivingtest-girl1-preview.png", full: "drivingtest-girl1.png",
    variants: [
      { id: "drivingtest-girl1-brown", full: "drivingtest-girl3.png" },
      { id: "drivingtest-girl1-blonde", full: "drivingtest-girl2.png" },
    ] },
  "drivingtestboy": { title: "Driving Pass Congratulations Boy", categories: ["all", "achievements"], preview: "drivingtestboy-preview.png", full: "drivingtestboy.png" },
  "drivingtest-girl4": { title: "Driving Pass Congratulations Girl", categories: ["all", "achievements"], preview: "drivingtest-girl4-preview.png", full: "drivingtest-girl4.png" },
  "learner1": { title: "Driving Test Pass Card", categories: ["all", "achievements"], preview: "learner1-preview.png", full: "learner1.png" },
  "learner": { title: "Driving Test Pass Card Girl", categories: ["all", "achievements"], preview: "learner-preview.png", full: "learner.png" },
  
  "exams-boy": { title: "Exams Congratulations Card", categories: ["all", "achievements"], preview: "exams-boy-preview.png", full: "exams-boy.png" },
  "exams-girl": { title: "Exams Congratulations Girl", categories: ["all", "achievements"], preview: "exams-girl-preview.png", full: "exams-girl.png" },
  
  "leaving-boy": { title: "Sorry You're Leaving Boy", categories: ["all", "work-related"], preview: "leaving-boy-preview.png", full: "leaving-boy.png" },
  "leaving-girl": { title: "Sorry You're Leaving Girl", categories: ["all", "work-related"], preview: "leaving-girl-preview.png", full: "leaving-girl.png" },
  
  "new-home": { title: "Home Sweet Home", categories: ["all", "home"], preview: "newhome-preview.png", full: "newhome.png" },
  "new-home": { title: "Home Sweet Home", categories: ["all", "home"], preview: "newhome-happyhome-preview.png", full: "newhome-happyhome.png" },
  "newhome1": { title: "New Home, New Beginnings", categories: ["all", "home"], preview: "newhome1-preview.png", full: "newhome1.png" },
  "newhome2": { title: "New Home Unboxed", categories: ["all", "home"], preview: "newhome2-preview.png", full: "newhome2.png" },
  "newhome3": { title: "New Home, New Adventures", categories: ["all", "home"], preview: "newhome3-preview.png", full: "newhome3.png" },
  "newhome4": { title: "New Home Wishes", categories: ["all", "home"], preview: "newhome4-preview.png", full: "newhome4.png" },
  "newhome5": { title: "New Home Together", categories: ["all", "home"], preview: "newhome5-preview.png", full: "newhome5.jpg" },
  "newhome6": { title: "New Home, New Memories", categories: ["all", "home"], preview: "newhome6-preview.png", full: "newhome6.jpg" },
  "newhome7": { title: "New University Home", categories: ["all", "school-cards", "home"], preview: "newhome7-preview.png", full: "newhome7.jpg" },
  "newhome8": { title: "New Home, New Dreams", categories: ["all", "home"], preview: "newhome8-preview.png", full: "newhome8.png" },
  "newhome9": { title: "New Home Love", categories: ["all", "home"], preview: "newhome9-preview.png", full: "newhome9.png" },
  "newhome10": { title: "New Home, New Pad", categories: ["all", "home"], preview: "newhome10-preview.png", full: "newhome10.png" },

  "newbaby-beautifulbabygirl": { title: "Beautiful Baby Girl", categories: ["all", "newbaby"], preview: "newbaby-beautifulbabygirl-preview.png", full: "newbaby-beautifulbabygirl.png" },
  "newbaby-beautifulbabyboy": { title: "Beautiful Baby Boy", categories: ["all", "newbaby"], preview: "newbaby-beautifulbabyboy-preview.png", full: "newbaby-beautifulbabyboy.png" },
  "newbaby-hellolittleone": { title: "Hello Little One", categories: ["all", "newbaby"], preview: "newbaby-hellolittleone-preview.png", full: "newbaby-hellolittleone.png" },
  
  "newbaby-butterflies": { title: "Baby Butterflies", price: "£3.49", categories: ["all", "newbaby", "photo-upload"], preview: "newbaby-butterflies-preview.png", full: "newbaby-butterflies.png", name: { left: 894, top: 620, startSize: 38, minSize: 34, maxSize: 34, maxSize: 34, fontFamily: "Anton", fontWeight: "normal", color: "#ffffff", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 480, tiltAngle: 0, label: "Name", maxChars: 13 },
    photo: { left: 897, top: 405, width: 450, height: 350 } },
  
  "newbaby-itsagirl": { title: "It's a Girl", price: "£3.49", categories: ["all", "newbaby", "photo-upload"], preview: "newbaby-itsagirl-preview.png", full: "newbaby-itsagirl.png", name: { left: 893, top: 635, startSize: 43, minSize: 28, maxSize: 28, maxSize: 86, fontFamily: "Anton", fontWeight: "normal", color: "#ffffff", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 480, tiltAngle: 0, label: "Name", maxChars: 15 },
    photo: { left: 897, top: 465, width: 450, height: 250 } },
  
  "newbaby-underthesea": { title: "Under the Sea", price: "£3.49", categories: ["all", "newbaby", "photo-upload"], preview: "newbaby-underthesea-preview.png", full: "newbaby-underthesea.png", name: { left: 889, top: 589, startSize: 37, minSize: 28, maxSize: 28, maxSize: 86, fontFamily: "Anton", fontWeight: "normal", color: "#ffffff", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 480, tiltAngle: 0, label: "Name", maxChars: 12 },
    photo: { left: 895, top: 370, width: 470, height: 340 } },
  
  "newbaby-rainbows": { title: "Baby Rainbows", price: "£3.49", categories: ["all", "newbaby", "photo-upload"], preview: "newbaby-rainbows-preview.png", full: "newbaby-rainbows.png", name: { left: 895, top: 623, startSize: 38, minSize: 28, maxSize: 28, maxSize: 86, fontFamily: "Anton", fontWeight: "normal", color: "#ffffff", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 480, tiltAngle: 0, label: "Name", maxChars: 13 },
    photo: { left: 894, top: 415, width: 465, height: 325 } },
  
  "newbaby-spacebaby": { title: "Space Teddy", price: "£3.49", categories: ["all", "newbaby", "photo-upload"], preview: "newbaby-spacebaby-preview.png", full: "newbaby-spacebaby.png", name: { left: 893, top: 623, startSize: 42, minSize: 28, maxSize: 28, maxSize: 86, fontFamily: "Anton", fontWeight: "normal", color: "#2d659a", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 480, tiltAngle: 0, label: "Name", maxChars: 13 },
    photo: { left: 894, top: 413, width: 350, height: 330 } },
  
  "fathers-day-peaky": { title: "Fathers Day Peaky Dad", categories: ["mothersday-fathersday"], preview: "fathers-day-peaky-preview.png", full: "fathers-day-peaky.png" },
  "fathers-day-pub": { title: "Fathers Day Pub", categories: ["mothersday-fathersday"], preview: "fathers-day-pub-preview.png", full: "fathers-day-pub.png" },
  "fathers-day-sopranos": { title: "Fathers Day Sopranos Dad", categories: ["mothersday-fathersday"], preview: "fathers-day-sopranos-preview.png", full: "fathers-day-sopranos.png" },
  "fathers-day-godfather": { title: "Fathers Day Godfather Dad", categories: ["mothersday-fathersday"], preview: "fathers-day-godfather-preview.png", full: "fathers-day-godfather.png" },
  
  "teaching-assistant1": { title: "Best Teaching Assistant", categories: ["school-cards"], preview: "teaching-assistant1-preview.png", full: "teaching-assistant1.png" },
  "teaching-assistant2": { title: "Teaching Assistant, Thank you", categories: ["school-cards"], preview: "teaching-assistant2-preview.png", full: "teaching-assistant2.png" },
  "thankyou-teacher1": { title: "Teacher, Thank You!", categories: ["school-cards"], preview: "thankyou-teacher1-preview.png", full: "thankyou-teacher.png" },
  "superteacher-boy": { title: "Greatest Teacher", categories: ["school-cards"], preview: "superteacher-boy-preview.png", full: "superteacher-boy.png" },
  "superteacher-girl": { title: "Super Teacher", categories: ["school-cards"], preview: "superteacher-girl-preview.png", full: "superteacher-girl.png" },
  "thankyou-teacher": { title: "Thank You, Teacher Card", categories: ["school-cards"], preview: "thankyou-teacher-preview.png", full: "thankyou-teacher.png", name: { left: 897, top: 728, startSize: 52, minSize: 35, maxSize: 60, fontFamily: "BubblegumSans", fontWeight: "bold", color: "#FD7D96", canChangeSize: true, canChangeColor: true, canMove: false, canRotate: false, isCurved: false, curveRadius: 0, tiltAngle: 0, label: "Name", maxChars: 14 } },
  
  "mothers-day1": { title: "Mothers Day", categories: ["mothersday-fathersday"], preview: "mothers-day1-preview.png", full: "mothers-day1.png" },
  "mothers-day2": { title: "Mothers Day", categories: ["mothersday-fathersday"], preview: "mothers-day2-preview.png", full: "mothers-day2.png" },
  "mothers-day3": { title: "Mothers Day", categories: ["mothersday-fathersday"], preview: "mothers-day3-preview.png", full: "mothers-day3.png" },

  "engagement1": { title: "Engagement Hearts", categories: ["all", "weddings-engagements"], preview: "engagement1-preview.png", full: "engagement1.png" },
  "engagement2": { title: "Engagement Bubbles", categories: ["all", "weddings-engagements"], preview: "engagement2-preview.png", full: "engagement2.png" },
  "engagement3": { title: "She Said Yes!", categories: ["all", "weddings-engagements"], preview: "engagement3-preview.png", full: "engagement3.png" },
  "engagement4": { title: "Engagement Ring Card", categories: ["all", "weddings-engagements"], preview: "engagement4-preview.png", full: "engagement4.png" },
  "engagement5": { title: "The Propsal", categories: ["all", "weddings-engagements"], preview: "engagement5-preview.png", full: "engagement5.png" },

  "wedding1": { title: "Over the Threshold", categories: ["all", "weddings-engagements"], preview: "wedding-overthethreshold-preview.png", full: "wedding-overthethreshold.png" },
  "wedding2": { title: "Wedding Bubbles", categories: ["all", "weddings-engagements"], preview: "wedding-bubbles-preview.png", full: "wedding-bubbles.png" },
  "wedding3": { title: "Just Married", categories: ["all", "weddings-engagements"], preview: "wedding-car-justmarried-preview.png", full: "wedding-car-justmarried.png" },

  "happy-hen-party1": { title: "Hen Party Girls", categories: ["all", "weddings-engagements"], preview: "happy-hen-party1-preview.png", full: "happy-hen-party1.png" },
  "happy-hen-party2": { title: "Hen Party Sleep Over", categories: ["all", "weddings-engagements"], preview: "happy-hen-party2-preview.png", full: "happy-hen-party2.png" },

  "christmas-santas-christmas": { title: "Santa's Christmas", categories: ["christmas"], preview: "christmas-santa-preview.png", full: "christmas-santa.png" },
  "christmas-nicest-children": { title: "Santa's Nicest Children", categories: ["christmas"], preview: "nicest-children-preview.png", full: "nicest-children.png",
    photo: { left: 909.6, top: 396, width: 310, height: 360 } },
  
 "christmas-naughtyornice": { title: "Santa's Naughty or Nice? (Video Card)", price: "£3.49", categories: ["christmas"], preview: "santa-video-preview.png", full: "santa-video.png",
    qr: { left: 915, top: 686, width: 130, height: 130, url: "https://images.cockneycards.com/santas-message-qr.png" } },

//SPORTS

  "afc-ladies-celebrating": { title: "Arsenal Ladies Celebrating Card", categories: ["sports", "football", "wsl", "arsenal"], preview: "afc-ladies-celebrating-preview.png", full: "afc-ladies-celebrating.png" },
  
  "afc-ladies-shirt1": { title: "Arsenal Ladies Shirt Card", categories: ["sports", "football", "wsl", "arsenal"], preview: "afc-ladies-shirt1-preview.png", full: "afc-ladies-shirt1.png", name: { left: 884, top: 519, startSize: 28, minSize: 20, maxSize: 30, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: true, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 7 }, age: { left: 882, top: 577, startSize: 60, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" } },
  "afc-ladies-shirt2": { title: "Arsenal Ladies Shirt Card", categories: ["sports", "football", "wsl", "arsenal"], preview: "afc-ladies-shirt2-preview.png", full: "afc-ladies-shirt2.png", name: { left: 884, top: 519, startSize: 28, minSize: 20, maxSize: 30, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: true, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 7 }, age: { left: 882, top: 577, startSize: 60, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" } },
  
  "afc-men-shirt1": { title: "Arsenal Shirt Card", categories: ["sports", "football", "premiership", "arsenal"], preview: "afc-men-shirt1-preview.png", full: "afc-men-shirt1.png", name: { left: 880, top: 492, startSize: 30, minSize: 20, maxSize: 30, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: true, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 7 }, age: { left: 880, top: 555, startSize: 70, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" } },
  "afc-men-shirt2": { title: "Arsenal Shirt Card", categories: ["sports", "football", "premiership", "arsenal"], preview: "afc-men-shirt2-preview.png", full: "afc-men-shirt2.png", name: { left: 882, top: 493, startSize: 30, minSize: 20, maxSize: 30, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: true, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 7 }, age: { left: 880, top: 555, startSize: 70, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" } },
  

  "f1-ferrari": { title: "Ferrari F1 Driver", categories: ["sports", "formula1"], preview: "f1-ferrari-preview.png", full: "f1-ferrari.png", name: { left: 892, top: 300, startSize: 90, minSize: 90, maxSize: 35, fontFamily: "Anton", fontWeight: "normal", color: "#ffffff", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 0, tiltAngle: 0, label: "Name", maxChars: 10 }, age: { left: 888, top: 485, startSize: 66, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#ffffff", canChangeSize: false, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" } },
  "f1-mclaren": { title: "McLaren F1 Driver", categories: ["sports", "formula1"], preview: "f1-mclaren-preview.png", full: "f1-mclaren.png", name: { left: 891, top: 300, startSize: 90, minSize: 90, maxSize: 35, fontFamily: "Anton", fontWeight: "normal", color: "#ffffff", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 0, tiltAngle: 0, label: "Name", maxChars: 10 }, age: { left: 889, top: 485, startSize: 66, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#ffffff", canChangeSize: false, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" } },
  "f1-mercedes": { title: "Mercedes F1 Driver", categories: ["sports", "formula1"], preview: "f1-mercedes-preview.png", full: "f1-mercedes.png", name: { left: 893, top: 300, startSize: 90, minSize: 30, maxSize: 35, fontFamily: "Anton", fontWeight: "normal", color: "#ffffff", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 0, tiltAngle: 0, label: "Name", maxChars: 10 }, age: { left: 888, top: 485, startSize: 66, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#ffffff", canChangeSize: false, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" } },
  "f1-redbull": { title: "Redbull F1 Driver", categories: ["sports", "formula1"], preview: "f1-redbull-preview.png", full: "f1-redbull.png", name: { left: 893, top: 300, startSize: 90, minSize: 30, maxSize: 35, fontFamily: "Anton", fontWeight: "normal", color: "#ffffff", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 0, tiltAngle: 0, label: "Name", maxChars: 10 }, age: { left: 888, top: 485, startSize: 66, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#ffffff", canChangeSize: false, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" } },
  "f1-williams": { title: "Williams F1 Driver", categories: ["sports", "formula1"], preview: "f1-williams-preview.png", full: "f1-williams.png", name: { left: 885, top: 300, startSize: 90, minSize: 30, maxSize: 35, fontFamily: "Anton", fontWeight: "normal", color: "#ffffff", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 0, tiltAngle: 0, label: "Name", maxChars: 10 }, age: { left: 881, top: 485, startSize: 66, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#ffffff", canChangeSize: false, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" } },
  "f1-alpine": { title: "Alpine F1 Driver", categories: ["sports", "formula1"], preview: "f1-alpine-preview.png", full: "f1-alpine.png", name: { left: 891, top: 300, startSize: 90, minSize: 30, maxSize: 35, fontFamily: "Anton", fontWeight: "normal", color: "#ffffff", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 0, tiltAngle: 0, label: "Name", maxChars: 10 }, age: { left: 884, top: 485, startSize: 66, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#ffffff", canChangeSize: false, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" } },
  "f1-astonmartin": { title: "Aston Martin F1 Driver", categories: ["sports", "formula1"], preview: "f1-aston-preview.png", full: "f1-aston.png", name: { left: 893, top: 300, startSize: 90, minSize: 30, maxSize: 35, fontFamily: "Anton", fontWeight: "normal", color: "#ffffff", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 0, tiltAngle: 0, label: "Name", maxChars: 10 }, age: { left: 888, top: 485, startSize: 66, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#ffffff", canChangeSize: true, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" } },
  "f1-audi": { title: "Audi F1 Driver", categories: ["sports", "formula1"], preview: "f1-audi-preview.png", full: "f1-audi.png", name: { left: 893, top: 300, startSize: 90, minSize: 30, maxSize: 35, fontFamily: "Anton", fontWeight: "normal", color: "#ffffff", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 0, tiltAngle: 0, label: "Name", maxChars: 10 }, age: { left: 888, top: 485, startSize: 66, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#ffffff", canChangeSize: false, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" } },
  "f1-haas": { title: "Haas F1 Driver", categories: ["sports", "formula1"], preview: "f1-haas-preview.png", full: "f1-haas.png", name: { left: 893, top: 300, startSize: 90, minSize: 30, maxSize: 35, fontFamily: "Anton", fontWeight: "normal", color: "#ffffff", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 0, tiltAngle: 0, label: "Name", maxChars: 10 }, age: { left: 889, top: 485, startSize: 66, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#ffffff", canChangeSize: false, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" } },
  


  "city-ladies-celebrating": { title: "City Ladies Celebrating Card", categories: ["sports", "football", "wsl", "man-cityw"], preview: "city-ladies-celebrating-preview.png", full: "city-ladies-celebrating.png" },
  
  
  
  "spurs-ladies-celebrating": { title: "Spurs Ladies Celebrating Card", categories: ["sports", "football", "wsl", "tottenham"], preview: "spurs-ladies-celebrating-preview.png", full: "spurs-ladies-celebrating.png" },

  "brighton-celebrating": { title: "Brighton Celebrating Card", categories: ["sports", "football", "wsl", "brighton"], preview: "brighton-celebrating-preview.png", full: "brighton-celebrating.png" },
  
  
  "cfc-shirt-blues1": { title: "Chelsea Blues Shirt Card", categories: ["sports", "football", "premiership", "chelsea"], preview: "cfc-shirt-blues1-preview.png", full: "cfc-shirt-blues1.png", name: { left: 885, top: 535, startSize: 30, minSize: 20, maxSize: 34, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: true, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 7 }, age: { left: 885, top: 600, startSize: 70, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" } },
  "cfc-shirt-blues2": { title: "Chelsea Blues Shirt Card", categories: ["sports", "football", "premiership", "chelsea"], preview: "cfc-shirt-blues2-preview.png", full: "cfc-shirt-blues2.png", name: { left: 885, top: 535, startSize: 30, minSize: 20, maxSize: 34, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: true, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 7 }, age: { left: 885, top: 600, startSize: 70, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" } },
  
  "dancing-queen": { title: "Dancing Queen Card", categories: ["all", "birthdays", "children"], preview: "dancing-queen-preview.png", full: "dancing-queen.png" },
 
  "netball-navy-girl1": { title: "Netball Girl Navy Outfit Girl 1", categories: ["sports", "netball"], preview: "netball-navy-girl1-preview.png", full: "netball-navyblue-girl1.png", name: { left: 885, top: 295, startSize: 80, minSize: 50, maxSize: 57, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 480, tiltAngle: 0, label: "Name", maxChars: 10 }, age: { left: 847, top: 593, startSize: 65, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: false, lettersOnly: true, forceUppercase: true, defaultText: "GA" } }, 
  "netball-navy-girl2": { title: "Netball Girl Navy Outfit Girl 2", categories: ["sports", "netball"], preview: "netball-navy-girl2-preview.png", full: "netball-navyblue-girl2.png", name: { left: 887, top: 296, startSize: 80, minSize: 50, maxSize: 57, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 480, tiltAngle: 0, label: "Name", maxChars: 10 }, age: { left: 845, top: 593, startSize: 65, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: false, lettersOnly: true, forceUppercase: true, defaultText: "GA" } }, 
  "netball-navy-girl3": { title: "Netball Girl Navy Outfit Girl 3", categories: ["sports", "netball"], preview: "netball-navy-girl3-preview.png", full: "netball-navyblue-girl3.png", name: { left: 894, top: 295, startSize: 80, minSize: 50, maxSize: 57, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 480, tiltAngle: 0, label: "Name", maxChars: 10 }, age: { left: 850, top: 593, startSize: 65, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: false, lettersOnly: true, forceUppercase: true, defaultText: "GA" } }, 
  "netball-navy-girl4": { title: "Netball Girl Navy Outfit Girl 4", categories: ["sports", "netball"], preview: "netball-navy-girl4-preview.png", full: "netball-navyblue-girl4.png", name: { left: 883, top: 295, startSize: 80, minSize: 50, maxSize: 57, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 480, tiltAngle: 0, label: "Name", maxChars: 10 }, age: { left: 840, top: 593, startSize: 65, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: false, lettersOnly: true, forceUppercase: true, defaultText: "GA" } },

  "netball-green-girl1": { title: "Netball Girl Green Outfit Girl 1", categories: ["sports", "netball"], preview: "netball-green-girl1-preview.png", full: "netball-green-girl1.png", name: { left: 894, top: 294, startSize: 80, minSize: 50, maxSize: 57, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 480, tiltAngle: 0, label: "Name", maxChars: 10 }, age: { left: 850, top: 594, startSize: 65, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: false, lettersOnly: true, forceUppercase: true, defaultText: "GA" } }, 
  "netball-green-girl2": { title: "Netball Girl Green Outfit Girl 2", categories: ["sports", "netball"], preview: "netball-green-girl2-preview.png", full: "netball-green-girl2.png", name: { left: 894, top: 295, startSize: 80, minSize: 50, maxSize: 57, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 480, tiltAngle: 0, label: "Name", maxChars: 10 }, age: { left: 849, top: 593, startSize: 65, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: false, lettersOnly: true, forceUppercase: true, defaultText: "GA" } }, 
  "netball-green-girl3": { title: "Netball Girl Green Outfit Girl 3", categories: ["sports", "netball"], preview: "netball-green-girl3-preview.png", full: "netball-green-girl3.png", name: { left: 888, top: 295, startSize: 80, minSize: 50, maxSize: 57, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 480, tiltAngle: 0, label: "Name", maxChars: 10 }, age: { left: 844, top: 593, startSize: 65, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: false, lettersOnly: true, forceUppercase: true, defaultText: "GA" } }, 
  "netball-green-girl4": { title: "Netball Girl Green Outfit Girl 4", categories: ["sports", "netball"], preview: "netball-green-girl4-preview.png", full: "netball-green-girl4.png", name: { left: 891, top: 295, startSize: 80, minSize: 50, maxSize: 57, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 480, tiltAngle: 0, label: "Name", maxChars: 10 }, age: { left: 847, top: 593, startSize: 65, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: false, lettersOnly: true, forceUppercase: true, defaultText: "GA" } },

  "netball-red-girl1": { title: "Netball Girl Red Outfit Girl 1", categories: ["sports", "netball"], preview: "netball-red-girl1-preview.png", full: "netball-red-girl1.png", name: { left: 886, top: 292, startSize: 80, minSize: 50, maxSize: 57, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 480, tiltAngle: 0, label: "Name", maxChars: 10 }, age: { left: 844, top: 593, startSize: 65, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: false, lettersOnly: true, forceUppercase: true, defaultText: "GA" } }, 
  "netball-red-girl2": { title: "Netball Girl Red Outfit Girl 2", categories: ["sports", "netball"], preview: "netball-red-girl2-preview.png", full: "netball-red-girl2.png", name: { left: 881, top: 293, startSize: 80, minSize: 50, maxSize: 57, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 480, tiltAngle: 0, label: "Name", maxChars: 10 }, age: { left: 840, top: 593, startSize: 65, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: false, lettersOnly: true, forceUppercase: true, defaultText: "GA" } }, 
  "netball-red-girl3": { title: "Netball Girl Red Outfit Girl 3", categories: ["sports", "netball"], preview: "netball-red-girl3-preview.png", full: "netball-red-girl3.png", name: { left: 881, top: 296, startSize: 80, minSize: 50, maxSize: 57, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 480, tiltAngle: 0, label: "Name", maxChars: 10 }, age: { left: 840, top: 593, startSize: 65, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: false, lettersOnly: true, forceUppercase: true, defaultText: "GA" } }, 
  "netball-red-girl4": { title: "Netball Girl Red Outfit Girl 4", categories: ["sports", "netball"], preview: "netball-red-girl4-preview.png", full: "netball-red-girl4.png", name: { left: 878, top: 301, startSize: 80, minSize: 50, maxSize: 57, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 480, tiltAngle: 0, label: "Name", maxChars: 10 }, age: { left: 839, top: 593, startSize: 65, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: false, lettersOnly: true, forceUppercase: true, defaultText: "GA" } },
                        
  "topboy-whu": { title: "Topboy West Ham United Card", categories: ["sports", "football", "championship", "west-ham"], preview: "topboy-whu-preview.png", full: "topboy-whu.png" },


  "topboy-mfc": { title: "Topboy Millwall FC Card", categories: ["sports", "football", "championship", "millwall"], preview: "topboy-mfc-preview.png", full: "topboy-mfc.png" },

  "golfmasters": { title: "Golf Masters", categories: ["sports", "golf"], preview: "golfmasters-preview.png", full: "golfmasters.png", name: { left: 894, top: 250, startSize: 70, minSize: 70, maxSize: 70, fontFamily: "Anton", fontWeight: "normal", color: "#f5b33a", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 470, tiltAngle: 0, label: "Name", maxChars: 10 } },
  "golfpro": { title: "Golf Pro", categories: ["sports", "golf"], preview: "golfpro-preview.png", full: "golfpro.png", name: { left: 897, top: 286, startSize: 40, minSize: 30, maxSize: 40, fontFamily: "Anton", fontWeight: "normal", color: "#204420", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: true, curveRadius: 500, tiltAngle: 0, label: "Name", maxChars: 9 } },

  "golfer": { title: "Golfer", categories: ["all", "sports", "golf", "birthdays"], preview: "golfer-preview.png", full: "golfer.png", name: { left: 894, top: 312, startSize: 72, minSize: 68, maxSize: 70, fontFamily: "Anton", fontWeight: "normal", color: "#0f214b", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 700, tiltAngle: 0, label: "Name", maxChars: 9 } },
  
  "liv-ladies-celebrating": { title: "Liverpool Ladies Celebrating Card", categories: ["sports", "football", "wsl", "liverpool"], preview: "liv-ladies-celebrating-preview.png", full: "liv-ladies-celebrating.png" },
  
  "charltonfan": { title: "Charlton Fan", categories: ["sports", "football", "championship", "charlton"], preview: "charltonfan-preview.png", full: "charltonfan.png" },
  "qprfan": { title: "QPR Fan", categories: ["sports", "football", "championship", "qpr"], preview: "qprfan-preview.png", full: "qprfan.png" },
  "wrexhamfan": { title: "Wrexham Fan", categories: ["sports", "football", "championship", "wrexham"], preview: "wrexhamrfan-preview.png", full: "wrexhamrfan.png" },

  "cardiff-fan": { title: "Cardiff City Fan", categories: ["sports", "football", "championship", "cardiff"], preview: "cardiff-fan-preview.png", full: "cardiff-fan.png" },
  "norwich-fan": { title: "Norwich City Fan", categories: ["sports", "football", "championship", "norwich"], preview: "norwich-fan-preview.png", full: "norwich-fan.png" },
  "middlesbrough-lion": { title: "Middlesbrough Lion", categories: ["sports", "football", "championship", "middlesbrough"], preview: "middlesbrough-lion-preview.png", full: "middlesbrough-lion.png" },


  
  "mfc-christmas": { title: "Millwall Christmas Card", categories: ["sports", "football", "championship", "millwall"], preview: "mfc-christmas-preview.png", full: "mfc-christmas.png" },
  
  "mfc-shirt1": { title: "Millwall Boy 1", categories: ["sports", "football", "championship", "millwall"], preview: "mfc-shirt1-preview.png", full: "mfc-shirt1.png", name: { left: 885, top: 550, startSize: 40, minSize: 30, maxSize: 45, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: false, canMove: false, canRotate: false, isCurved: true, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 12 }, age: { left: 885, top: 635, startSize: 90, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" } },
  "mfc-shirt2": { title: "Millwall Boy 2", categories: ["sports", "football", "championship", "millwall"], preview: "mfc-shirt2-preview.png", full: "mfc-shirt2.png", name: { left: 885, top: 550, startSize: 40, minSize: 30, maxSize: 45, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: false, canMove: false, canRotate: false, isCurved: true, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 12 }, age: { left: 885, top: 635, startSize: 90, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" } },
  "mfc-shirt3": { title: "Millwall Boy 3", categories: ["sports", "football", "championship", "millwall"], preview: "mfc-shirt3-preview.png", full: "mfc-shirt3.png", name: { left: 885, top: 550, startSize: 40, minSize: 30, maxSize: 45, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: false, canMove: false, canRotate: false, isCurved: true, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 12 }, age: { left: 885, top: 635, startSize: 90, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" } },
  "mfc-shirt4": { title: "Millwall Boy 4", categories: ["sports", "football", "championship", "millwall"], preview: "mfc-shirt4-preview.png", full: "mfc-shirt4.png", name: { left: 885, top: 550, startSize: 40, minSize: 30, maxSize: 45, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: false, canMove: false, canRotate: false, isCurved: true, curveRadius: 150, tiltAngle: 0, label: "Name", maxChars: 12 }, age: { left: 885, top: 635, startSize: 90, minSize: 20, maxSize: 120, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: true, label: "Shirt", maxChars: 2, numericOnly: true, lettersOnly: false, forceUppercase: false, defaultText: "10" } },

  "nolu-lion1": { title: "No One Likes Us Lion Card", categories: ["sports", "football", "championship", "millwall"], preview: "nolu-lion1-preview.png", full: "nolu-lion1.png", name: { left: 890, top: 246, startSize: 75, minSize: 70, maxSize: 78, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: true, canChangeColor: false, canMove: false, canRotate: false, isCurved: true, curveRadius: 610, tiltAngle: -3, label: "Name", maxChars: 12 } },
  
  "birthday-mfc-photo1": { title: "Lions Birthday", price: "£3.49", categories: ["sports", "football", "championship", "millwall", "photo-upload"], preview: "lions-birthday-preview.png", full: "lions-birthday.png", name: { left: 898, top: 752, startSize: 63, minSize: 60, maxSize: 70, fontFamily: "Anton", fontWeight: "normal", color: "#0F214B", canChangeSize: true, canChangeColor: false, canMove: false, canRotate: false, isCurved: true, curveRadius: 580, tiltAngle: -0, label: "Name", maxChars: 9 },
    photo: { left: 1008, top: 180, width: 310, height: 310 } },
  
  
  "discodarts": { title: "Disco Darts", categories: ["sports", "darts"], preview: "discodarts-preview.png", full: "discodarts.png", name: { left: 894, top: 244, startSize: 43, minSize: 40, maxSize: 43, fontFamily: "Anton", fontWeight: "normal", color: "#001591", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: true, curveRadius: 500, tiltAngle: 0, label: "Name", maxChars: 9 } },
  "anyoneforcricket": { title: "Anyone for Cricket", categories: ["sports", "cricket"], preview: "anyoneforcricket-preview.png", full: "anyoneforcricket.png", name: { left: 900, top: 309, startSize: 38, minSize: 37, maxSize: 40, fontFamily: "Anton", fontWeight: "normal", color: "#01316e", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: true, curveRadius: 520, tiltAngle: 0, label: "Name", maxChars: 8 } },
  
  "dartschampion": { title: "Darts Champion", categories: ["sports", "darts"], preview: "dartschampion-preview.png", full: "dartschampion.png", name: { left: 894, top: 287, startSize: 83, minSize: 80, maxSize: 85, fontFamily: "Anton", fontWeight: "normal", color: "#FFFFFF", canChangeSize: false, canChangeColor: false, canMove: false, canRotate: false, isCurved: false, curveRadius: 470, tiltAngle: 0, label: "Name", maxChars: 10 } },
  
  "vintagecricket": { title: "Vintage Cricket", categories: ["sports", "cricket"], preview: "vintagecricket-preview.png", full: "vintagecricket.png" },
  
  "dartsmasterphoto": { title: "Darts Master", price: "£3.49", categories: ["sports", "darts", "photo-upload"], preview: "dartsmasterphoto-preview.png", full: "dartsmasterphoto.png", 
    photo: { left: 892, top: 525, width: 320, height: 320 } },
  
  
  "5kboy-photo": { title: "5K Achievement Boy", categories: ["running"], preview: "5kboy-photo-preview.png", full: "5kboy-photo.png",
    photo: { left: 909.6, top: 331.3, width: 408.1, height: 385.4 },
    extraFields: [
      { key: "event", label: "Event", left: 866, top: 627, fontSize: 17, color: "#D9971D", maxChars: 20 },
      { key: "date", label: "Date", left: 861, top: 678, fontSize: 17, color: "#D9971D", maxChars: 20 },
      { key: "finishTime", label: "Time", left: 900, top: 733, fontSize: 17, color: "#D9971D", maxChars: 12 }
    ] },
  "10kboy-photo": { title: "10K Achievement Boy", categories: ["running"], preview: "10krace-boy-preview.png", full: "10krace-boy.png",
    photo: { left: 909.6, top: 331.3, width: 408.1, height: 385.4 },
    extraFields: [
      { key: "event", label: "Event", left: 852, top: 632, fontFamily: "Oswald-VariableFont_wght", fontSize: 25, color: "#001e3f", maxChars: 20 },
      { key: "date", label: "Date", left: 846, top: 703, fontFamily: "Oswald-VariableFont_wght", fontSize: 25, color: "#001e3f", maxChars: 20 },
      { key: "finishTime", label: "Time", left: 895, top: 772, fontFamily: "Oswald-VariableFont_wght", fontSize: 25, color: "#001e3f", maxChars: 18 }
    ] },
  "26mboy-photo": { title: "26M Achievement Boy", categories: ["running"], preview: "26mboy-photo-preview.png", full: "26mboy-photo.png",
    photo: { left: 909.6, top: 331.3, width: 408.1, height: 385.4 },
    extraFields: [
      { key: "event", label: "Event", left: 866, top: 627, fontSize: 18, color: "#F7CD4E", maxChars: 20 },
      { key: "date", label: "Date", left: 861, top: 678, fontSize: 18, color: "#F7CD4E", maxChars: 20 },
      { key: "finishTime", label: "Time", left: 900, top: 732, fontSize: 18, color: "#F7CD4E", maxChars: 12 }
    ] },
  "5kgirl-photo": { title: "5K Achievement Girl", categories: ["running"], preview: "5kgirl-photo-preview.png", full: "5kgirl-photo.png",
    photo: { left: 909.6, top: 331.3, width: 408.1, height: 385.4 },
    extraFields: [
      { key: "event", label: "Event", left: 870, top: 603, fontSize: 18, color: "#8B1E5C", maxChars: 20 },
      { key: "date", label: "Date", left: 861, top: 648, fontSize: 18, color: "#8B1E5C", maxChars: 20 },
      { key: "finishTime", label: "Time", left: 912, top: 694, fontSize: 18, color: "#8B1E5C", maxChars: 12 }
    ] },
  "10kgirl-photo": { title: "10K Achievement Girl", categories: ["running"], preview: "10kgirl-photo-preview.png", full: "10kgirl-photo.png",
    photo: { left: 909.6, top: 331.3, width: 408.1, height: 385.4 },
    extraFields: [
      { key: "event", label: "Event", left: 870, top: 603, fontSize: 18, color: "#8B1E5C", maxChars: 20 },
      { key: "date", label: "Date", left: 861, top: 648, fontSize: 18, color: "#8B1E5C", maxChars: 20 },
      { key: "finishTime", label: "Time", left: 912, top: 694, fontSize: 18, color: "#8B1E5C", maxChars: 12 }
    ] },
  "26mgirl-photo": { title: "26M Achievement Girl", categories: ["running"], preview: "26mgirl-photo-preview.png", full: "26mgirl-photo.png",
    photo: { left: 909.6, top: 331.3, width: 408.1, height: 385.4 },
    extraFields: [
      { key: "event", label: "Event", left: 870, top: 599, fontSize: 18, color: "#8B1E5C", maxChars: 20 },
      { key: "date", label: "Date", left: 860, top: 644, fontSize: 18, color: "#8B1E5C", maxChars: 20 },
      { key: "finishTime", label: "Time", left: 912, top: 690, fontSize: 18, color: "#8B1E5C", maxChars: 12 }
    ] },

  
};


