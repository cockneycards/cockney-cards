// cards.js
const CARDS_DATABASE = [
  {
    id: "tvmovies-inbetweeners",
    title: "The Inbetweeners",
    category: "TV & Movies",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058166/tvmovies-inbetweeners.png"
  },
  {
    id: "ofah",
    title: "Only Fools and Horses",
    category: "TV & Movies",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058159/ofah.png"
  },
  {
    id: "tvmovies-bttf",
    title: "Back to the Future",
    category: "TV & Movies",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058158/tvmovies-bttf.png"
  },
  {
    id: "tvmovies-youngones",
    title: "The Young Ones",
    category: "TV & Movies",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058082/tvmovies-youngones.png"
  },
  {
    id: "tvmovies-jaws",
    title: "Jaws",
    category: "TV & Movies",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058069/tvmovies-jaws.png"
  },
  {
    id: "charlie-says",
    title: "Charlie Says",
    category: "TV & Movies",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058139/charlie-says.png"
  },
  {
    id: "exams-boy",
    title: "Exams (Boy)",
    category: "Milestones & Exams",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058150/exams-boy.png"
  },
  {
    id: "exams-girl",
    title: "Exams (Girl)",
    category: "Milestones & Exams",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058144/exams-girl.png"
  },
  {
    id: "11plus-kids",
    title: "11 Plus Exam (Kids)",
    category: "Milestones & Exams",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058140/11plus-kids.png"
  },
  {
    id: "11plus-boy",
    title: "11 Plus Exam (Boy)",
    category: "Milestones & Exams",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058134/11plus-boy.png"
  },
  {
    id: "11plus-girl",
    title: "11 Plus Exam (Girl)",
    category: "Milestones & Exams",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058129/11plus-girl.png"
  },
  {
    id: "driving-boy",
    title: "Driving Test (Boy)",
    category: "Milestones & Exams",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058147/driving-boy.png"
  },
  {
    id: "driving-girl",
    "title": "Driving Test (Girl)",
    category: "Milestones & Exams",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058139/driving-girl.png"
  },
  {
    id: "newjob-teacher",
    title: "New Job - Teacher",
    category: "New Job & Leaving",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058120/newjob-teacher.png"
  },
  {
    id: "thankyou-teacher",
    title: "Thank You - Teacher",
    category: "New Job & Leaving",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058119/thankyou-teacher.png"
  },
  {
    id: "newjob-fireman",
    title: "New Job - Fireman",
    category: "New Job & Leaving",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058114/newjob-fireman.png"
  },
  {
    id: "newjob-lawyer-girl",
    title: "New Job - Lawyer (Girl)",
    category: "New Job & Leaving",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058109/newjob-lawyer-girl.png"
  },
  {
    id: "newjob-lawyer-boy",
    title: "New Job - Lawyer (Boy)",
    category: "New Job & Leaving",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058108/newjob-lawyer-boy.png"
  },
  {
    id: "newjob-doctor-girl",
    title: "New Job - Doctor (Girl)",
    category: "New Job & Leaving",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058107/newjob-doctor-girl.png"
  },
  {
    id: "newjob-doctor-boy",
    title: "New Job - Doctor (Boy)",
    category: "New Job & Leaving",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058108/newjob-doctor-boy.png"
  },
  {
    id: "leaving-girl1",
    title: "Leaving (Girl)",
    category: "New Job & Leaving",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058098/leaving-girl1.png"
  },
  {
    id: "leaving-boy1",
    title: "Leaving (Boy)",
    category: "New Job & Leaving",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058091/leaving-boy1.png"
  },
  {
    id: "gamer-girl",
    title: "Gamer Girl",
    category: "Gaming",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058096/gamer-girl.png"
  },
  {
    id: "gamer-boy",
    title: "Gamer Boy",
    category: "Gaming",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058090/gamer-boy.png"
  },
  {
    id: "gameboy-roblox",
    title: "Roblox (Boy)",
    category: "Gaming",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058087/gameboy-roblox.png"
  },
  {
    id: "gameboy-minecraft",
    title: "Minecraft (Boy)",
    category: "Gaming",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058080/gameboy-minecraft.png"
  },
  {
    id: "gamegirl-minecraft",
    title: "Minecraft (Girl)",
    category: "Gaming",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058085/gamegirl-minecraft.png"
  },
  {
    id: "new-home",
    title: "New Home",
    category: "Milestones & Occasions",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058157/new-home.png"
  },
  {
    id: "new-home-personalised",
    title: "New Home (Personalised)",
    category: "Milestones & Occasions",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058074/new-home-personalised.png"
  },
  {
    id: "wedding-couple2",
    title: "Wedding Couple",
    category: "Milestones & Occasions",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058123/wedding-couple2.png"
  },
  {
    id: "ladies-shopping",
    title: "Ladies Shopping",
    category: "Lifestyles & Fun",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058157/ladies-shopping.png"
  },
  {
    id: "ladies-lunch",
    title: "Ladies Lunch",
    category: "Lifestyles & Fun",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058155/ladies-lunch.png"
  },
  {
    id: "artsy-girl",
    title: "Artsy Girl",
    category: "Lifestyles & Fun",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058135/artsy-girl.png"
  },
  {
    id: "wine-girl",
    title: "Wine Night (Girl)",
    category: "Lifestyles & Fun",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058128/wine-girl.png"
  },
  {
    id: "beer-boy",
    title: "Beer Night (Boy)",
    category: "Lifestyles & Fun",
    imageUrl: "https://res.cloudinary.com/uzf4eeky/image/upload/v1784058080/beer-boy.png"
  }
];
