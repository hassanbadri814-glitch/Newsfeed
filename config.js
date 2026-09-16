/* ============================================================
   WAR DESK v19.0 — Configuratie
   Bronnen, categorieën en instellingen
   ============================================================ */

window.CONFIG = {
  perFeed: 10,
  autoRefreshMs: 60000,
  pauseOnScrollMs: 15000,
  failThreshold: 3,
  retryAfterMs: 3600000,
  maxCacheItems: 200,
  proxy: "https://nieuwsproxy.hassanbadri814.workers.dev/?url=",
  fetchTimeoutMs: 8000,
  parallelWorkers: 10
};

/* Categorie-groepen — welke subcats horen bij welke menu-knop */
window.CAT_GROUPS = {
  war:     ["war"],
  mideast: ["mideast","il","gaza","lebanon","syria","yemen","iran","tr","eg","sa","ae","qa"],
  europe:  ["be","de","fr","es","it","uk"],
  nl:      ["nl"],
  sport:   ["sport"]
};

/* Bronnen met hogere prioriteit in belangrijkheid-score */
window.HIGH_PRIORITY = [
  "Al Jazeera","Al Jazeera AR","BBC World","BBC Arabic","BBC UK",
  "Reuters","AP News","TRT World","Times of Israel","Jerusalem Post",
  "NOS","NOS Sport","De Telegraaf","AD.nl","RTL Nieuws"
];

/* Keywords voor belangrijkheid-score */
window.KEYWORDS_HIGH = [
  "killed","dead","deaths","massacre","nuclear","invasion",
  "airstrike","ceasefire","assassinated","declared war"
];
window.KEYWORDS_MED = [
  "explosion","missile","bombing","hostage","shooting",
  "crash","collapse","wounded","injured"
];

/* ============================================================
   NIEUWSBRONNEN — ~130 feeds
   ============================================================ */
window.FEEDS = [
  // ===== NEDERLAND =====
  {n:"NOS",lang:"nl",cat:"nl",url:"https://feeds.nos.nl/nosnieuwsalgemeen"},
  {n:"De Telegraaf",lang:"nl",cat:"nl",url:"https://www.telegraaf.nl/rss"},
  {n:"AD.nl",lang:"nl",cat:"nl",url:"https://www.ad.nl/rss.xml"},
  {n:"De Volkskrant",lang:"nl",cat:"nl",url:"https://www.volkskrant.nl/rss"},
  {n:"NRC",lang:"nl",cat:"nl",url:"https://www.nrc.nl/rss"},
  {n:"Het Parool",lang:"nl",cat:"nl",url:"https://www.parool.nl/rss"},
  {n:"Trouw",lang:"nl",cat:"nl",url:"https://www.trouw.nl/rss"},
  {n:"RTL Nieuws",lang:"nl",cat:"nl",url:"https://www.rtlnieuws.nl/rss"},
  {n:"Nu.nl",lang:"nl",cat:"nl",url:"https://www.nu.nl/rss/Algemeen"},
  {n:"Omroep Brabant",lang:"nl",cat:"nl",url:"https://www.omroepbrabant.nl/rss"},
  {n:"Omroep Flevoland",lang:"nl",cat:"nl",url:"https://www.omroepflevoland.nl/rss"},
  {n:"NH Nieuws",lang:"nl",cat:"nl",url:"https://www.nhnieuws.nl/rss"},
  {n:"RTV Utrecht",lang:"nl",cat:"nl",url:"https://www.rtvutrecht.nl/rss"},
  {n:"Omroep Gelderland",lang:"nl",cat:"nl",url:"https://www.omroepgelderland.nl/rss"},
  {n:"L1",lang:"nl",cat:"nl",url:"https://www.l1.nl/rss"},
  {n:"RTV Oost",lang:"nl",cat:"nl",url:"https://www.rtvoost.nl/rss"},
  {n:"Omroep West",lang:"nl",cat:"nl",url:"https://www.omroepwest.nl/rss"},

  // ===== SPORT (uitgebreid) =====
  {n:"NOS Sport",lang:"nl",cat:"sport",url:"https://feeds.nos.nl/nossport"},
  {n:"NOS Voetbal",lang:"nl",cat:"sport",url:"https://feeds.nos.nl/nossportvoetbal"},
  {n:"ESPN NL",lang:"nl",cat:"sport",url:"https://www.espn.nl/rss"},
  {n:"Voetbalnieuws",lang:"nl",cat:"sport",url:"https://www.voetbalnieuws.nl/feed/"},
  {n:"Voetbalzone",lang:"nl",cat:"sport",url:"https://www.voetbalzone.nl/rss"},
  {n:"Voetbalprimeur",lang:"nl",cat:"sport",url:"https://www.voetbalprimeur.nl/rss"},
  {n:"FCUpdate",lang:"nl",cat:"sport",url:"https://www.fcupdate.nl/rss"},
  {n:"Soccernews",lang:"nl",cat:"sport",url:"https://www.soccernews.nl/rss"},
  {n:"NUsport",lang:"nl",cat:"sport",url:"https://www.nu.nl/rss/Sport"},
  {n:"Sportnieuws.nl",lang:"nl",cat:"sport",url:"https://sportnieuws.nl/feed/"},
  {n:"RTL Sport",lang:"nl",cat:"sport",url:"https://www.rtlnieuws.nl/rss/sport"},
  {n:"Glory Kickboxing",lang:"en",cat:"sport",url:"https://glorykickboxing.com/rss"},
  {n:"Wielerflits",lang:"nl",cat:"sport",url:"https://www.wielerflits.nl/feed/"},
  {n:"GPUpdate",lang:"nl",cat:"sport",url:"https://www.gpupdate.net/nl/rss"},
  {n:"Racexpress",lang:"nl",cat:"sport",url:"https://www.racexpress.nl/rss.php"},
  {n:"MMA DNA",lang:"nl",cat:"sport",url:"https://mmadna.nl/feed/"},

  // ===== BELGIË =====
  {n:"HLN",lang:"nl",cat:"be",url:"https://www.hln.be/rss.xml"},
  {n:"Nieuwsblad",lang:"nl",cat:"be",url:"https://www.nieuwsblad.be/rss.xml"},
  {n:"De Standaard",lang:"nl",cat:"be",url:"https://www.standaard.be/rss"},
  {n:"VRT NWS",lang:"nl",cat:"be",url:"https://www.vrt.be/vrtnws/nl.rss"},
  {n:"De Morgen",lang:"nl",cat:"be",url:"https://www.demorgen.be/rss"},
  {n:"De Tijd",lang:"nl",cat:"be",url:"https://www.tijd.be/rss"},
  {n:"Gazet van Antwerpen",lang:"nl",cat:"be",url:"https://www.gva.be/rss.xml"},
  {n:"Het Belang van Limburg",lang:"nl",cat:"be",url:"https://www.hbvl.be/rss.xml"},

  // ===== DUITSLAND =====
  {n:"Spiegel",lang:"de",cat:"de",url:"https://www.spiegel.de/schlagzeilen/tops/index.rss"},
  {n:"Bild",lang:"de",cat:"de",url:"https://www.bild.de/feed/alles.xml"},
  {n:"Zeit",lang:"de",cat:"de",url:"https://newsfeed.zeit.de/index"},
  {n:"FAZ",lang:"de",cat:"de",url:"https://www.faz.net/rss/aktuell/"},
  {n:"Süddeutsche",lang:"de",cat:"de",url:"https://rss.sueddeutsche.de/rss/Topthemen"},
  {n:"Tagesschau",lang:"de",cat:"de",url:"https://www.tagesschau.de/xml/rss2/"},
  {n:"Die Welt",lang:"de",cat:"de",url:"https://www.welt.de/feeds/latest.rss"},

  // ===== FRANKRIJK =====
  {n:"Le Monde",lang:"fr",cat:"fr",url:"https://www.lemonde.fr/rss/une.xml"},
  {n:"Le Figaro",lang:"fr",cat:"fr",url:"https://www.lefigaro.fr/rss/figaro_actualites.xml"},
  {n:"FranceInfo",lang:"fr",cat:"fr",url:"https://www.franceinfo.fr/titres.rss"},
  {n:"Libération",lang:"fr",cat:"fr",url:"https://www.liberation.fr/rss/"},

  // ===== SPANJE =====
  {n:"El País",lang:"es",cat:"es",url:"https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada"},
  {n:"El Mundo",lang:"es",cat:"es",url:"https://www.elmundo.es/rss/portada.xml"},
  {n:"ABC",lang:"es",cat:"es",url:"https://www.abc.es/rss/feeds/abc_ultima.xml"},

  // ===== ITALIË =====
  {n:"Corriere della Sera",lang:"it",cat:"it",url:"https://www.corriere.it/rss/homepage.xml"},
  {n:"Repubblica",lang:"it",cat:"it",url:"https://www.repubblica.it/rss/homepage/rss2.0.xml"},
  {n:"ANSA",lang:"it",cat:"it",url:"https://www.ansa.it/sito/ansait_rss.xml"},
  {n:"La Stampa",lang:"it",cat:"it",url:"https://www.lastampa.it/rss/homepage.xml"},

  // ===== VK =====
  {n:"BBC UK",lang:"en",cat:"uk",url:"https://feeds.bbci.co.uk/news/uk/rss.xml"},
  {n:"Guardian UK",lang:"en",cat:"uk",url:"https://www.theguardian.com/uk-news/rss"},
  {n:"Telegraph",lang:"en",cat:"uk",url:"https://www.telegraph.co.uk/rss.xml"},
  {n:"Sky News",lang:"en",cat:"uk",url:"https://feeds.skynews.com/feeds/rss/uk.xml"},
  {n:"Independent",lang:"en",cat:"uk",url:"https://www.independent.co.uk/rss"},
  {n:"FT",lang:"en",cat:"uk",url:"https://www.ft.com/rss/home/uk"},

  // ===== VS =====
  {n:"NYT US",lang:"en",cat:"us",url:"https://rss.nytimes.com/services/xml/rss/nyt/US.xml"},
  {n:"CNN",lang:"en",cat:"us",url:"http://rss.cnn.com/rss/cnn_us.rss"},
  {n:"Washington Post",lang:"en",cat:"us",url:"https://feeds.washingtonpost.com/rss/national"},
  {n:"NPR",lang:"en",cat:"us",url:"https://feeds.npr.org/1003/rss.xml"},

  // ===== TURKIJE =====
  {n:"Hürriyet",lang:"tr",cat:"tr",url:"https://www.hurriyet.com.tr/rss/anasayfa"},
  {n:"Sabah",lang:"tr",cat:"tr",url:"https://www.sabah.com.tr/rss/anasayfa.xml"},
  {n:"NTV",lang:"tr",cat:"tr",url:"https://www.ntv.com.tr/son-dakika.rss"},
  {n:"CNN Türk",lang:"tr",cat:"tr",url:"https://www.cnnturk.com/feed/rss/all/news"},
  {n:"TRT Haber",lang:"tr",cat:"tr",url:"https://www.trthaber.com/sondakika.rss"},
  {n:"Sözcü",lang:"tr",cat:"tr",url:"https://www.sozcu.com.tr/rss/all.xml"},

  // ===== MAROKKO =====
  {n:"Hespress",lang:"ar",cat:"maroc",url:"https://www.hespress.com/feed"},
  {n:"Le360",lang:"fr",cat:"maroc",url:"https://fr.le360.ma/feed"},
  {n:"MAP",lang:"fr",cat:"maroc",url:"https://www.mapnews.ma/fr/rss.xml"},
  {n:"Yabiladi",lang:"fr",cat:"maroc",url:"https://www.yabiladi.com/rss/articles.xml"},
  {n:"Lakome2",lang:"ar",cat:"maroc",url:"https://lakome2.com/feed"},
  {n:"TelQuel",lang:"fr",cat:"maroc",url:"https://telquel.ma/feed"},
  {n:"Bladna.nl",lang:"nl",cat:"maroc",url:"https://freenewsapi.ai/v1/rss?host=bladna.nl&size=50"},
  {n:"Marokko.nl",lang:"nl",cat:"maroc",url:"https://news.google.com/rss/search?q=site:marokko.nl&hl=nl&gl=NL&ceid=NL:nl"},

  // ===== EGYPTE =====
  {n:"Al-Ahram",lang:"en",cat:"eg",url:"http://weekly.ahram.org.eg/front.xml"},
  {n:"Egypt Independent",lang:"en",cat:"eg",url:"https://www.egyptindependent.com/feed/"},

  // ===== SAOEDI-ARABIË =====
  {n:"Arab News",lang:"en",cat:"sa",url:"https://www.arabnews.com/rss.xml"},
  {n:"Saudi Gazette",lang:"en",cat:"sa",url:"https://saudigazette.com.sa/rssFeed/1"},

  // ===== VAE =====
  {n:"The National",lang:"en",cat:"ae",url:"https://www.thenationalnews.com/rss"},
  {n:"Gulf News",lang:"en",cat:"ae",url:"https://gulfnews.com/rss"},

  // ===== QATAR =====
  {n:"Al Jazeera",lang:"en",cat:"qa",url:"https://www.aljazeera.com/xml/rss/all.xml"},
  {n:"The Peninsula",lang:"en",cat:"qa",url:"https://thepeninsulaqatar.com/rss"},
  {n:"Al Jazeera AR",lang:"ar",cat:"qa",url:"https://www.aljazeera.net/aljazeerarss/a7c186be-1baa-4bd4-9d80-a84db769f779/73d0e1b4-532f-45ef-b135-bfdff8b8cab9"},

  // ===== ISRAËL =====
  {n:"Times of Israel",lang:"en",cat:"il",url:"https://www.timesofisrael.com/feed/"},
  {n:"Jerusalem Post",lang:"en",cat:"il",url:"https://www.jpost.com/rss/rssfeedsheadlines.aspx"},
  {n:"Ynet",lang:"en",cat:"il",url:"https://www.ynetnews.com/Integration/StoryRss2.xml"},

  // ===== MIDDEN-OOSTEN ALGEMEEN =====
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

  // ===== OEKRAÏNE / RUSLAND =====
  {n:"Kyiv Independent",lang:"en",cat:"ukraine",url:"https://kyivindependent.com/feed/"},
  {n:"Ukrinform",lang:"en",cat:"ukraine",url:"https://www.ukrinform.net/rss"},
  {n:"RT News",lang:"en",cat:"war",url:"https://www.rt.com/rss/"},
  {n:"TASS",lang:"en",cat:"war",url:"https://tass.com/rss/v2.xml"},

  // ===== AZIË =====
  {n:"SCMP",lang:"en",cat:"world",url:"https://www.scmp.com/rss/91/feed"},
  {n:"Japan Times",lang:"en",cat:"world",url:"https://www.japantimes.co.jp/feed/"},
  {n:"Times of India",lang:"en",cat:"world",url:"https://timesofindia.indiatimes.com/rssfeedstopstories.cms"},
  {n:"The Hindu",lang:"en",cat:"world",url:"https://www.thehindu.com/feeder/default.rss"},

  // ===== WERELD =====
  {n:"BBC World",lang:"en",cat:"world",url:"https://feeds.bbci.co.uk/news/world/rss.xml"},
  {n:"BBC Arabic",lang:"ar",cat:"world",url:"https://feeds.bbci.co.uk/arabic/rss.xml"},
  {n:"TRT World",lang:"en",cat:"world",url:"https://www.trtworld.com/feed/rss.xml"},
  {n:"The Guardian",lang:"en",cat:"world",url:"https://www.theguardian.com/world/rss"},
  {n:"NYT World",lang:"en",cat:"world",url:"https://rss.nytimes.com/services/xml/rss/nyt/World.xml"},
  {n:"France24 EN",lang:"en",cat:"world",url:"https://www.france24.com/en/rss"},
  {n:"Reuters",lang:"en",cat:"world",url:"https://news.google.com/rss/search?q=site:reuters.com&hl=en&gl=US&ceid=US:en"},
  {n:"AP News",lang:"en",cat:"world",url:"https://news.google.com/rss/search?q=site:apnews.com&hl=en&gl=US&ceid=US:en"},

  // ===== SPECIALE CONFLICTEN =====
  {n:"Radio Dabanga",lang:"en",cat:"sudan",url:"https://www.dabangasudan.org/en/rss"},
  {n:"SABA Yemen",lang:"en",cat:"yemen",url:"https://www.saba.ye/en/rsscatfeed14.htm"},
  {n:"Mehr News Iran",lang:"en",cat:"iran",url:"https://en.mehrnews.com/rss"},
  {n:"Middle East Monitor",lang:"en",cat:"gaza",url:"https://www.middleeastmonitor.com/feed/"},
  {n:"Mondoweiss",lang:"en",cat:"gaza",url:"https://mondoweiss.net/feed/"}
];

console.log("[WAR DESK] config.js geladen —", window.FEEDS.length, "feeds");