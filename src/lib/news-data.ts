export type Article = {
  slug: string;
  title: string;
  category: string;
  author: string;
  date: string; // ISO 2026
  summary: string;
  body: string[];
  imageHue: number; // for placeholder
};

export const articles: Article[] = [
  {
    slug: "riverfront-lighting-proposal",
    title: "City leaders review riverfront lighting proposal",
    category: "Local",
    author: "Jordan Whitaker",
    date: "2026-06-15",
    summary:
      "Charleston council members heard a presentation on a new riverfront lighting plan aimed at improving safety along Kanawha Boulevard.",
    body: [
      "Charleston city council members met this week to review a proposal that would expand pedestrian-scale lighting along several blocks of the Kanawha Boulevard riverfront.",
      "Planners say the upgraded lighting would extend evening visibility for walkers, runners and cyclists who use the trail, while complementing the existing decorative fixtures downtown.",
      "Council members asked staff to return next month with a phased cost estimate and timeline. Officials say no final decision has been made.",
      "Residents are invited to share feedback during the upcoming public comment period at city hall.",
    ],
    imageHue: 220,
  },
  {
    slug: "summer-meal-sites",
    title: "Kanawha County schools announce summer meal sites",
    category: "Education",
    author: "Maya Caldwell",
    date: "2026-06-14",
    summary:
      "Free summer meals will be offered at locations across the county beginning next week, school officials announced.",
    body: [
      "Kanawha County Schools has released the list of summer meal sites that will offer free breakfast and lunch to children and teens during the break.",
      "Meals will be served Monday through Friday at participating community centers, recreation sites and select schools throughout the valley.",
      "The program is open to all children 18 and under, with no registration required.",
      "A complete list of locations and serving times is available through the district's nutrition office.",
    ],
    imageHue: 35,
  },
  {
    slug: "weekend-paving",
    title: "Crews prepare for weekend paving on major commuter routes",
    category: "Traffic",
    author: "Devon Marsh",
    date: "2026-06-13",
    summary:
      "Drivers should expect overnight lane closures this weekend as crews resurface several heavily traveled corridors.",
    body: [
      "Transportation officials say paving crews will be working overnight Friday and Saturday on several commuter routes through the Kanawha Valley.",
      "Lane shifts and temporary closures are expected, and motorists are encouraged to plan alternate routes when possible.",
      "Work is weather-dependent and may be rescheduled if storms move through the region.",
      "Updates will be posted as conditions change.",
    ],
    imageHue: 200,
  },
  {
    slug: "cooling-center-hours",
    title: "Local shelter expands cooling center hours",
    category: "Community",
    author: "Priya Bennett",
    date: "2026-06-12",
    summary:
      "A downtown shelter is extending its cooling center hours through the weekend as temperatures climb across the valley.",
    body: [
      "A Charleston shelter has announced expanded cooling center hours as forecasters track several warm afternoons ahead.",
      "Bottled water, seating and indoor air conditioning will be available to anyone needing relief from the heat.",
      "Organizers are also accepting community donations of bottled water and individually packaged snacks.",
      "Additional cooling locations are listed on the city's community services page.",
    ],
    imageHue: 15,
  },
  {
    slug: "downtown-summer-market",
    title: "Small businesses prepare for downtown summer market",
    category: "Business",
    author: "Alex Tran",
    date: "2026-06-11",
    summary:
      "Dozens of local vendors are preparing for the return of a popular open-air market in downtown Charleston.",
    body: [
      "Organizers say more than fifty local vendors have signed on for this season's downtown summer market, which features food, handmade goods and live music.",
      "The market will run on select Saturdays through the summer, with rotating themes highlighting local makers, farmers and artists.",
      "City officials say the market has become a reliable draw for downtown foot traffic.",
      "A full schedule is available through the downtown business association.",
    ],
    imageHue: 85,
  },
  {
    slug: "all-region-teams",
    title: "High school athletes named to all-region teams",
    category: "Sports",
    author: "Riley Hopkins",
    date: "2026-06-10",
    summary:
      "Standout athletes from across the Kanawha Valley have been recognized on this year's all-region rosters.",
    body: [
      "Coaches across the region have announced this year's all-region honorees, recognizing standout performances during the spring season.",
      "Athletes were selected based on a combination of statistics, coach voting and overall contribution to their teams.",
      "Full rosters will be published in the coming days, with formal recognition planned at end-of-season banquets.",
      "Congratulations to all the student-athletes recognized this year.",
    ],
    imageHue: 5,
  },
  {
    slug: "river-cleanup",
    title: "Volunteers organize river cleanup this weekend",
    category: "Community",
    author: "Sam Whitman",
    date: "2026-06-09",
    summary:
      "Community volunteers are gathering Saturday morning for a coordinated cleanup along the Kanawha riverbank.",
    body: [
      "A group of community volunteers is organizing a Saturday morning cleanup along several access points on the Kanawha River.",
      "Gloves, bags and safety vests will be provided, and organizers ask participants to wear sturdy shoes.",
      "The effort is part of a recurring seasonal program focused on keeping local waterways clean.",
      "Anyone interested in joining can sign up through the event organizers.",
    ],
    imageHue: 160,
  },
  {
    slug: "scattered-storms",
    title: "Weather team tracks scattered storms across the Valley",
    category: "Weather",
    author: "WKNA 49 Weather",
    date: "2026-06-08",
    summary:
      "The WKNA 49 weather team is monitoring scattered afternoon storms across the Kanawha Valley through midweek.",
    body: [
      "Scattered showers and thunderstorms are possible across the Kanawha Valley over the next several afternoons.",
      "Storms could produce locally heavy rainfall, gusty winds and lightning, especially during peak heating hours.",
      "Outdoor plans may need flexibility through midweek as conditions shift.",
      "Stay with the WKNA 49 weather team for the latest updates and any active alerts.",
    ],
    imageHue: 250,
  },
];

export const getArticle = (slug: string) => articles.find((a) => a.slug === slug);

export const shows = [
  {
    slug: "morning-report",
    name: "WKNA 49 Morning Report",
    time: "Weekdays at 6:00 AM",
    description:
      "Start the day with local news, weather and traffic for the Kanawha Valley.",
  },
  {
    slug: "kanawha-today",
    name: "Kanawha Today",
    time: "Weekdays at Noon",
    description:
      "A midday look at local stories, community guests and the day's developing news.",
  },
  {
    slug: "news-at-5-6",
    name: "WKNA 49 News at 5 & 6",
    time: "Weekdays at 5:00 and 6:00 PM",
    description:
      "Charleston's evening newscasts with local headlines, weather and sports.",
  },
  {
    slug: "mountain-state-tonight",
    name: "Mountain State Tonight",
    time: "Weeknights at 10:00 PM",
    description:
      "An in-depth look at the day's biggest stories from across West Virginia.",
  },
  {
    slug: "sports-final",
    name: "49 Sports Final",
    time: "Friday nights during high school sports season",
    description:
      "High school highlights, scores and player features from across the region.",
  },
  {
    slug: "49ers-club",
    name: "The 49ers Club",
    time: "Saturday mornings",
    description:
      "A community spotlight program celebrating local people, places and traditions.",
  },
];

export const schedule = [
  { name: "WKNA 49 Morning Report", time: "Weekdays at 6:00 AM" },
  { name: "Kanawha Today", time: "Weekdays at Noon" },
  { name: "WKNA 49 News at 5", time: "Weekdays at 5:00 PM" },
  { name: "WKNA 49 News at 6", time: "Weekdays at 6:00 PM" },
  { name: "Mountain State Tonight", time: "Weeknights at 10:00 PM" },
  { name: "WKNA 49 News at 11", time: "Weeknights at 11:00 PM" },
  { name: "49 Sports Final", time: "Friday nights during high school sports season" },
];

export const forecast = [
  { day: "Today", hi: 84, lo: 67, cond: "Scattered T-storms" },
  { day: "Mon", hi: 86, lo: 68, cond: "Partly Cloudy" },
  { day: "Tue", hi: 88, lo: 70, cond: "Sunny" },
  { day: "Wed", hi: 85, lo: 69, cond: "Storms Likely" },
  { day: "Thu", hi: 82, lo: 66, cond: "Showers" },
  { day: "Fri", hi: 80, lo: 64, cond: "Partly Cloudy" },
  { day: "Sat", hi: 83, lo: 65, cond: "Mostly Sunny" },
];

export const formatDate = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
