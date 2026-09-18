/* ============================================================
   WAR DESK v20.9 — Configuratie
   ============================================================ */

window.APP_VERSION = "v9.3";
window.TAGS_VERSION = "3";

window.CONFIG = {
  perFeed: 12,
  autoRefreshMs: 0,
  pauseOnScrollMs: 15000,
  failThreshold: 5,
  retryAfterMs: 3600000,
  maxCacheItems: 3000,

  themeAutoSwitch: true,
  themeLightStart: 6,
  themeDarkStart: 19,

  warTrackerLimit: 100,
  detailCacheMax: 500,
  detailCacheTTL: 7200000,
  stadiaKey: "6b91d05e-5862-449d-ab5d-a34a15e2112e",

  iptvMaxRecent: 10,
  iptvChannelsDisplayMax: 500,
  iptvHlsCdns: [
    "https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js",
    "https://unpkg.com/hls.js@1/dist/hls.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.15/hls.min.js"
  ],

  proxies: [
    "https://newsfeed2.hassanbadri814.workers.dev/?url=",
    "https://nieuwsproxy.hassanbadri814.workers.dev/?url=",
    "https://api.allorigins.win/raw?url="
  ],

  googleNewsProxies: [
    "https://api.allorigins.win/raw?url="
  ],

  fetchTimeoutMs: 10000,
  parallelWorkers: 5
};

window.CAT_GROUPS = {
  all:     [],
  war:     ["war"],
  mideast: ["mideast"],
  europe:  ["europe"],
  nl:      ["nl"],
  maroc:   ["maroc"],
  vs:      ["vs"],
  sport:   ["sport"],
  favorites: []
};

window.HIGH_PRIORITY = [
  "Al Jazeera","Al Jazeera AR","BBC World","BBC Arabic","BBC UK",
  "Reuters","AP News","TRT World","Times of Israel","Jerusalem Post",
  "NOS","NOS Sport","De Telegraaf","AD.nl","RTL Nieuws"
];

window.KEYWORDS_HIGH = [
  "killed","dead","deaths","massacre","nuclear","invasion",
  "airstrike","ceasefire","assassinated","declared war"
];
window.KEYWORDS_MED = [
  "explosion","missile","bombing","hostage","shooting",
  "crash","collapse","wounded","injured"
];

window.FEEDS = [
  {n:"NOS",lang:"nl",cat:"nl",url:"https://feeds.nos.nl/nosnieuwsalgemeen"},
  {n:"De Telegraaf",lang:"nl",cat:"nl",url:"https://www.telegraaf.nl/rss"},
  {n:"AD.nl",lang:"nl",cat:"nl",url:"https://www.ad.nl/rss.xml"},
  {n:"De Volkskrant",lang:"nl",cat:"nl",url:"https://news.google.com/rss/search?q=site:volkskrant.nl&hl=nl&gl=NL&ceid=NL:nl"},
  {n:"Het Parool",lang:"nl",cat:"nl",url:"https://news.google.com/rss/search?q=site:parool.nl&hl=nl&gl=NL&ceid=NL:nl"},
  {n:"Trouw",lang:"nl",cat:"nl",url:"https://news.google.com/rss/search?q=site:trouw.nl&hl=nl&gl=NL&ceid=NL:nl"},
  {n:"RTL Nieuws",lang:"nl",cat:"nl",url:"https://news.google.com/rss/search?q=site:rtlnieuws.nl&hl=nl&gl=NL&ceid=NL:nl"},
  {n:"Nu.nl",lang:"nl",cat:"nl",url:"https://www.nu.nl/rss/Algemeen"},
  {n:"Omroep Brabant",lang:"nl",cat:"nl",url:"https://www.omroepbrabant.nl/rss"},
  {n:"Omroep Flevoland",lang:"nl",cat:"nl",url:"https://news.google.com/rss/search?q=site:omroepflevoland.nl&hl=nl&gl=NL&ceid=NL:nl"},
  {n:"NH Nieuws",lang:"nl",cat:"nl",url:"https://news.google.com/rss/search?q=site:nhnieuws.nl&hl=nl&gl=NL&ceid=NL:nl"},
  {n:"RTV Utrecht",lang:"nl",cat:"nl",url:"https://news.google.com/rss/search?q=site:rtvutrecht.nl&hl=nl&gl=NL&ceid=NL:nl"},
  {n:"Omroep Gelderland",lang:"nl",cat:"nl",url:"https://www.omroepgelderland.nl/rss"},
  {n:"L1",lang:"nl",cat:"nl",url:"https://news.google.com/rss/search?q=site:l1.nl&hl=nl&gl=NL&ceid=NL:nl"},
  {n:"RTV Oost",lang:"nl",cat:"nl",url:"https://www.rtvoost.nl/rss"},
  {n:"Omroep West",lang:"nl",cat:"nl",url:"https://www.omroepwest.nl/rss"},

  {n:"NOS Sport",lang:"nl",cat:"sport",url:"https://feeds.nos.nl/nossport"},
  {n:"NOS Voetbal",lang:"nl",cat:"sport",url:"https://feeds.nos.nl/nossportvoetbal"},
  {n:"ESPN NL",lang:"nl",cat:"sport",url:"https://www.espn.nl/rss"},
  {n:"Voetbalnieuws",lang:"nl",cat:"sport",url:"https://news.google.com/rss/search?q=site:voetbalnieuws.nl&hl=nl&gl=NL&ceid=NL:nl"},
  {n:"Voetbalzone",lang:"nl",cat:"sport",url:"https://news.google.com/rss/search?q=site:voetbalzone.nl&hl=nl&gl=NL&ceid=NL:nl"},
  {n:"Voetbalprimeur",lang:"nl",cat:"sport",url:"https://www.voetbalprimeur.nl/rss"},
  {n:"FCUpdate",lang:"nl",cat:"sport",url:"https://www.fcupdate.nl/rss"},
  {n:"Soccernews",lang:"nl",cat:"sport",url:"https://news.google.com/rss/search?q=site:soccernews.nl&hl=nl&gl=NL&ceid=NL:nl"},
  {n:"NUsport",lang:"nl",cat:"sport",url:"https://www.nu.nl/rss/Sport"},
  {n:"RTL Sport",lang:"nl",cat:"sport",url:"https://news.google.com/rss/search?q=site:rtlnieuws.nl+sport&hl=nl&gl=NL&ceid=NL:nl"},
  {n:"Glory Kickboxing",lang:"en",cat:"sport",url:"https://glorykickboxing.com/rss"},
  {n:"MMA DNA",lang:"nl",cat:"sport",url:"https://mmadna.nl/feed/"},

  {n:"HLN",lang:"nl",cat:"be",url:"https://news.google.com/rss/search?q=site:hln.be&hl=nl&gl=BE&ceid=BE:nl"},
  {n:"Nieuwsblad",lang:"nl",cat:"be",url:"https://news.google.com/rss/search?q=site:nieuwsblad.be&hl=nl&gl=BE&ceid=BE:nl"},
  {n:"De Standaard",lang:"nl",cat:"be",url:"https://news.google.com/rss/search?q=site:standaard.be&hl=nl&gl=BE&ceid=BE:nl"},
  {n:"VRT NWS",lang:"nl",cat:"be",url:"https://news.google.com/rss/search?q=site:vrt.be&hl=nl&gl=BE&ceid=BE:nl"},
  {n:"De Morgen",lang:"nl",cat:"be",url:"https://news.google.com/rss/search?q=site:demorgen.be&hl=nl&gl=BE&ceid=BE:nl"},
  {n:"De Tijd",lang:"nl",cat:"be",url:"https://news.google.com/rss/search?q=site:tijd.be&hl=nl&gl=BE&ceid=BE:nl"},

  {n:"Spiegel",lang:"de",cat:"de",url:"https://news.google.com/rss/search?q=site:spiegel.de&hl=de&gl=DE&ceid=DE:de"},
  {n:"Bild",lang:"de",cat:"de",url:"https://news.google.com/rss/search?q=site:bild.de&hl=de&gl=DE&ceid=DE:de"},
  {n:"Zeit",lang:"de",cat:"de",url:"https://news.google.com/rss/search?q=site:zeit.de&hl=de&gl=DE&ceid=DE:de"},
  {n:"FAZ",lang:"de",cat:"de",url:"https://news.google.com/rss/search?q=site:faz.net&hl=de&gl=DE&ceid=DE:de"},
  {n:"Süddeutsche",lang:"de",cat:"de",url:"https://news.google.com/rss/search?q=site:sueddeutsche.de&hl=de&gl=DE&ceid=DE:de"},
  {n:"Tagesschau",lang:"de",cat:"de",url:"https://news.google.com/rss/search?q=site:tagesschau.de&hl=de&gl=DE&ceid=DE:de"},
  {n:"Die Welt",lang:"de",cat:"de",url:"https://news.google.com/rss/search?q=site:welt.de&hl=de&gl=DE&ceid=DE:de"},

  {n:"Le Monde",lang:"fr",cat:"fr",url:"https://www.lemonde.fr/rss/une.xml"},
  {n:"FranceInfo",lang:"fr",cat:"fr",url:"https://www.franceinfo.fr/titres.rss"},
  {n:"Libération",lang:"fr",cat:"fr",url:"https://www.liberation.fr/rss/"},

  {n:"Corriere della Sera",lang:"it",cat:"it",url:"https://www.corriere.it/rss/homepage.xml"},
  {n:"Repubblica",lang:"it",cat:"it",url:"https://www.repubblica.it/rss/homepage/rss2.0.xml"},
  {n:"ANSA",lang:"it",cat:"it",url:"https://www.ansa.it/sito/ansait_rss.xml"},
  {n:"La Stampa",lang:"it",cat:"it",url:"https://www.lastampa.it/rss/homepage.xml"},

  {n:"BBC UK",lang:"en",cat:"uk",url:"https://feeds.bbci.co.uk/news/uk/rss.xml"},
  {n:"Guardian UK",lang:"en",cat:"uk",url:"https://www.theguardian.com/uk-news/rss"},
  {n:"Telegraph",lang:"en",cat:"uk",url:"https://www.telegraph.co.uk/rss.xml"},
  {n:"Sky News",lang:"en",cat:"uk",url:"https://feeds.skynews.com/feeds/rss/uk.xml"},
  {n:"Independent",lang:"en",cat:"uk",url:"https://www.independent.co.uk/rss"},
  {n:"FT",lang:"en",cat:"uk",url:"https://www.ft.com/rss/home/uk"},

  {n:"NYT US",lang:"en",cat:"us",url:"https://rss.nytimes.com/services/xml/rss/nyt/US.xml"},
  {n:"CNN",lang:"en",cat:"us",url:"http://rss.cnn.com/rss/cnn_us.rss"},
  {n:"Washington Post",lang:"en",cat:"us",url:"https://feeds.washingtonpost.com/rss/national"},
  {n:"NPR",lang:"en",cat:"us",url:"https://feeds.npr.org/1003/rss.xml"},

  {n:"Hespress",lang:"ar",cat:"maroc",url:"https://www.hespress.com/feed"},
  {n:"Le360",lang:"fr",cat:"maroc",url:"https://fr.le360.ma/feed"},
  {n:"MAP",lang:"fr",cat:"maroc",url:"https://www.mapnews.ma/fr/rss.xml"},
  {n:"Yabiladi",lang:"fr",cat:"maroc",url:"https://www.yabiladi.com/rss/articles.xml"},
  {n:"Lakome2",lang:"ar",cat:"maroc",url:"https://lakome2.com/feed"},
  {n:"TelQuel",lang:"fr",cat:"maroc",url:"https://telquel.ma/feed"},
  {n:"Bladna.nl",lang:"nl",cat:"maroc",url:"https://freenewsapi.ai/v1/rss?host=bladna.nl&size=50"},
  {n:"Marokko.nl",lang:"nl",cat:"maroc",url:"https://news.google.com/rss/search?q=site:marokko.nl&hl=nl&gl=NL&ceid=NL:nl"},

  {n:"Al-Ahram",lang:"en",cat:"eg",url:"http://weekly.ahram.org.eg/front.xml"},
  {n:"Egypt Independent",lang:"en",cat:"eg",url:"https://www.egyptindependent.com/feed/"},
  {n:"Arab News",lang:"en",cat:"sa",url:"https://www.arabnews.com/rss.xml"},
  {n:"Saudi Gazette",lang:"en",cat:"sa",url:"https://saudigazette.com.sa/rssFeed/1"},
  {n:"The National",lang:"en",cat:"ae",url:"https://www.thenationalnews.com/rss"},
  {n:"Gulf News",lang:"en",cat:"ae",url:"https://gulfnews.com/rss"},
  {n:"Al Jazeera",lang:"en",cat:"qa",url:"https://www.aljazeera.com/xml/rss/all.xml"},
  {n:"The Peninsula",lang:"en",cat:"qa",url:"https://thepeninsulaqatar.com/rss"},
  {n:"Al Jazeera AR",lang:"ar",cat:"qa",url:"https://www.aljazeera.net/aljazeerarss/a7c186be-1baa-4bd4-9d80-a84db769f779/73d0e1b4-532f-45ef-b135-bfdff8b8cab9"},

  {n:"Times of Israel",lang:"en",cat:"il",url:"https://www.timesofisrael.com/feed/"},
  {n:"Jerusalem Post",lang:"en",cat:"il",url:"https://www.jpost.com/rss/rssfeedsheadlines.aspx"},
  {n:"Ynet",lang:"en",cat:"il",url:"https://www.ynetnews.com/Integration/StoryRss2.xml"},

  {n:"Al Monitor",lang:"en",cat:"mideast",url:"https://www.al-monitor.com/rss"},
  {n:"Middle East Eye",lang:"en",cat:"mideast",url:"https://www.middleeasteye.net/rss"},
  {n:"RT Arabic",lang:"ar",cat:"mideast",url:"https://arabic.rt.com/rss/"},
  {n:"France24 AR",lang:"ar",cat:"mideast",url:"https://www.france24.com/ar/rss"},
  {n:"CNN Arabic",lang:"ar",cat:"mideast",url:"https://arabic.cnn.com/api/v1/rss/rss.xml"},
  {n:"Al Quds Al Arabi",lang:"ar",cat:"mideast",url:"https://www.alquds.co.uk/feed"},
  {n:"Anadolu AR",lang:"ar",cat:"mideast",url:"https://www.aa.com.tr/ar/rss/default?cat=guncel"},
  {n:"Asharq Al-Awsat",lang:"ar",cat:"mideast",url:"https://aawsat.com/feed"},
  {n:"L'Orient-Le Jour",lang:"fr",cat:"mideast",url:"https://www.lorientlejour.com/rss"},
  {n:"Naharnet",lang:"en",cat:"mideast",url:"https://www.naharnet.com/rss"},
  {n:"SANA",lang:"en",cat:"mideast",url:"https://sana.sy/en/?feed=rss2"},
  {n:"Enab Baladi",lang:"en",cat:"mideast",url:"https://english.enabbaladi.net/feed/"},
  {n:"Sudan Tribune",lang:"en",cat:"mideast",url:"https://sudantribune.com/feed/"},

  {n:"Kyiv Independent",lang:"en",cat:"ukraine",url:"https://kyivindependent.com/feed/"},
  {n:"Ukrinform",lang:"en",cat:"ukraine",url:"https://www.ukrinform.net/rss"},
  {n:"RT News",lang:"en",cat:"war",url:"https://www.rt.com/rss/"},
  {n:"TASS",lang:"en",cat:"war",url:"https://tass.com/rss/v2.xml"},

  {n:"Japan Times",lang:"en",cat:"world",url:"https://www.japantimes.co.jp/feed/"},
  {n:"BBC World",lang:"en",cat:"world",url:"https://feeds.bbci.co.uk/news/world/rss.xml"},
  {n:"BBC Arabic",lang:"ar",cat:"world",url:"https://feeds.bbci.co.uk/arabic/rss.xml"},
  {n:"TRT World",lang:"en",cat:"world",url:"https://www.trtworld.com/feed/rss.xml"},
  {n:"The Guardian",lang:"en",cat:"world",url:"https://www.theguardian.com/world/rss"},
  {n:"NYT World",lang:"en",cat:"world",url:"https://rss.nytimes.com/services/xml/rss/nyt/World.xml"},
  {n:"France24 EN",lang:"en",cat:"world",url:"https://www.france24.com/en/rss"},
  {n:"Reuters",lang:"en",cat:"world",url:"https://news.google.com/rss/search?q=site:reuters.com&hl=en&gl=US&ceid=US:en"},
  {n:"AP News",lang:"en",cat:"world",url:"https://news.google.com/rss/search?q=site:apnews.com&hl=en&gl=US&ceid=US:en"},

  {n:"Radio Dabanga",lang:"en",cat:"sudan",url:"https://www.dabangasudan.org/en/rss"},
  {n:"SABA Yemen",lang:"en",cat:"yemen",url:"https://www.saba.ye/en/rsscatfeed14.htm"},
  {n:"Mehr News Iran",lang:"en",cat:"iran",url:"https://en.mehrnews.com/rss"},
  {n:"Middle East Monitor",lang:"en",cat:"gaza",url:"https://www.middleeastmonitor.com/feed/"},
  {n:"Mondoweiss",lang:"en",cat:"gaza",url:"https://mondoweiss.net/feed/"}
];

console.log("[WAR DESK] config.js " + window.APP_VERSION + " geladen — " + window.FEEDS.length + " feeds");