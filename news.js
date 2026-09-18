/* ============================================================
   WAR DESK v24.2 — Nieuws logica
   ============================================================ */

window.__newsVersion = "v24.2";

var MYMEMORY_EMAIL = "hassanbadri814@gmail.com";

window.State = {
  items: [],
  currentCat: "all",
  currentSort: "importance",
  currentSearch: "",
  loadedSources: 0,
  totalSources: 0,
  failedSources: [],
  disabled: {},
  health: {},
  readMap: {},
  favorites: {},
  notificationsEnabled: false,
  lastActivity: Date.now(),
  isScrolling: false,
  scrollTimer: null,
  refreshTimer: null,
  viewMode: "cards",
  breakingShownAt: 0,
  lastBreakingItem: null,
  loadSession: 0,
  db: null,
  _lastRenderHash: "",
  translateEnabled: false,
  translations: {},
  translationPending: {}
};

var NewsDB = (function(){
  var db = null;
  var DB_NAME = "wardesk_v19_news";
  var DB_VERSION = 2;

  function open(){
    return new Promise(function(resolve){
      try{
        if(!("indexedDB" in window)){ resolve(null); return; }
        var req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function(e){
          var d = e.target.result;
          if(!d.objectStoreNames.contains("items")) d.createObjectStore("items", {keyPath:"link"});
          if(!d.objectStoreNames.contains("meta")) d.createObjectStore("meta", {keyPath:"k"});
          if(!d.objectStoreNames.contains("translations")) d.createObjectStore("translations", {keyPath:"k"});
        };
        req.onsuccess = function(e){ db = e.target.result; resolve(db); };
        req.onerror = function(){ resolve(null); };
      }catch(e){ resolve(null); }
    });
  }
  function put(store, value){
    if(!db) return Promise.resolve(false);
    return new Promise(function(res){
      try{
        var tx = db.transaction(store, "readwrite");
        tx.objectStore(store).put(value);
        tx.oncomplete = function(){ res(true); };
        tx.onerror = function(){ res(false); };
      }catch(e){ res(false); }
    });
  }
  function del(store, key){
    if(!db) return Promise.resolve(false);
    return new Promise(function(res){
      try{
        var tx = db.transaction(store, "readwrite");
        tx.objectStore(store).delete(key);
        tx.oncomplete = function(){ res(true); };
        tx.onerror = function(){ res(false); };
      }catch(e){ res(false); }
    });
  }
  function get(store, key){
    if(!db) return Promise.resolve(null);
    return new Promise(function(res){
      try{
        var tx = db.transaction(store, "readonly");
        var r = tx.objectStore(store).get(key);
        r.onsuccess = function(){ res(r.result || null); };
        r.onerror = function(){ res(null); };
      }catch(e){ res(null); }
    });
  }
  function getAll(store){
    if(!db) return Promise.resolve([]);
    return new Promise(function(res){
      try{
        var tx = db.transaction(store, "readonly");
        var r = tx.objectStore(store).getAll();
        r.onsuccess = function(){ res(r.result || []); };
        r.onerror = function(){ res([]); };
      }catch(e){ res([]); }
    });
  }
  function saveItems(items){
    if(!db) return Promise.resolve();
    return new Promise(function(res){
      try{
        var tx = db.transaction("items", "readwrite");
        var store = tx.objectStore("items");
        store.clear();
        var max = (window.CONFIG && CONFIG.maxCacheItems) ? CONFIG.maxCacheItems : 3000;
        items.slice(0, max).forEach(function(it){
          store.put({
            link: it.link, title: it.title, desc: it.desc, img: it.img,
            date: it.date, source: it.source, cat: it.cat, lang: it.lang,
            sources: it.sources, tags: it.tags || []
          });
        });
        tx.oncomplete = function(){ res(); };
        tx.onerror = function(){ res(); };
      }catch(e){ res(); }
    });
  }
  function pruneOldReads(){
    if(!db) return Promise.resolve(false);
    return new Promise(function(res){
      try{
        var cutoffRead = Date.now() - 90 * 86400000;
        var cutoffFav = Date.now() - 365 * 86400000;
        var tx = db.transaction("meta", "readwrite");
        var store = tx.objectStore("meta");
        var req = store.openCursor();
        req.onsuccess = function(e){
          var cur = e.target.result;
          if(!cur) return;
          var rec = cur.value;
          var k = rec && rec.k || "";
          var v = rec && rec.v || 0;
          if(k.indexOf("read_") === 0 && v < cutoffRead){ cur.delete(); }
          else if(k.indexOf("fav_") === 0 && v < cutoffFav){ cur.delete(); }
          cur.continue();
        };
        tx.oncomplete = function(){ res(true); };
        tx.onerror = function(){ res(false); };
      }catch(e){ res(false); }
    });
  }
  return {
    open: open, put: put, get: get, getAll: getAll, saveItems: saveItems,
    pruneOldReads: pruneOldReads,
    loadItems: function(){
      return getAll("items").then(function(items){
        return items.sort(function(a,b){ return tm(b.date) - tm(a.date); });
      });
    },
    saveRead: function(link){ return put("meta", {k:"read_" + link, v: Date.now()}); },
    loadReadMap: function(){
      return getAll("meta").then(function(all){
        var map = {};
        all.forEach(function(rec){
          if(rec.k && rec.k.indexOf("read_") === 0) map[rec.k.slice(5)] = rec.v;
        });
        return map;
      });
    },
    saveHealth: function(health){ return put("meta", {k:"health", v: health}); },
    loadHealth: function(){
      return get("meta", "health").then(function(rec){ return (rec && rec.v) ? rec.v : {}; });
    },
    saveTranslation: function(key, value){
      return put("translations", {k: key, v: value, t: Date.now()});
    },
    loadTranslation: function(key){
      return get("translations", key).then(function(rec){ return (rec && rec.v) ? rec.v : null; });
    },
    saveFavorite: function(link){ return put("meta", {k:"fav_" + link, v: Date.now()}); },
    removeFavorite: function(link){ return del("meta", "fav_" + link); },
    loadFavorites: function(){
      return getAll("meta").then(function(all){
        var map = {};
        all.forEach(function(rec){
          if(rec.k && rec.k.indexOf("fav_") === 0) map[rec.k.slice(4)] = rec.v;
        });
        return map;
      });
    }
  };
})();

function tm(d){ var x = new Date(d); return isNaN(x) ? 0 : x.getTime(); }
function ago(d){
  var t = tm(d); if(!t) return "";
  var diff = (Date.now() - t) / 1000;
  if(diff < 60) return "nu";
  if(diff < 3600) return Math.floor(diff / 60) + "m";
  if(diff < 86400) return Math.floor(diff / 3600) + "u";
  return Math.floor(diff / 86400) + "d";
}
function rtime(t){ return Math.max(1, Math.round((t || "").split(/\s+/).length / 200)); }
function strip(s){ return (s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(); }
function esc(s){
  return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
  });
}

function emitProgress(pct, done){
  try{
    document.dispatchEvent(new CustomEvent("wardesk:feedprogress", {
      detail: { pct: Math.max(0, Math.min(100, Math.round(pct))), done: !!done }
    }));
  }catch(e){}
}

function extractTags(title, desc, sourceCat){
  var tags = [];
  var t = ((title || "") + " " + (desc || "")).toLowerCase();

  if(sourceCat === "nl") tags.push("nl");
  if(sourceCat === "be" || sourceCat === "de" || sourceCat === "fr" || sourceCat === "it" || sourceCat === "uk") tags.push("europe");
  if(sourceCat === "us") tags.push("vs");
  if(sourceCat === "maroc") tags.push("maroc");
  if(sourceCat === "eg" || sourceCat === "sa" || sourceCat === "ae" || sourceCat === "qa" || sourceCat === "il" || sourceCat === "mideast") tags.push("mideast");
  if(sourceCat === "ukraine" || sourceCat === "gaza" || sourceCat === "yemen" || sourceCat === "iran" || sourceCat === "sudan" || sourceCat === "war") tags.push("war");
  if(sourceCat === "sport") tags.push("sport");

  var sportStrong = /\b(eredivisie|eerste divisie|knvb|johan cruijff schaal|champions league|europa league|conference league|wk voetbal|ek voetbal|formule 1|grand prix|motogp|tour de france|giro d'italia|vuelta|wimbledon|roland garros|us open tennis|australian open|olympische spelen|glory kickboxing|ufc|nba|nfl|nhl|mlb)\b/.test(t);
  var sportTeam = /\b(ajax|psv|feyenoord|az alkmaar|fc utrecht|fc twente|vitesse|sc heerenveen|sparta rotterdam|willem ii|go ahead eagles|pec zwolle|rkc waalwijk|fortuna sittard|excelsior|almere city|heracles|n\.e\.c\.|real madrid|barcelona|atletico madrid|manchester united|manchester city|liverpool|chelsea|arsenal|tottenham|juventus|inter milan|ac milan|bayern münchen|borussia dortmund|paris saint-germain|psg)\b/.test(t);
  var warBlock = /\b(airstrike|raketaanval|invasion|invasie|massacre|bloedbad|shelling|beschieting|offensief|oorlog|war)\b/.test(t);
  if((sportStrong || sportTeam) && !warBlock && tags.indexOf("sport") === -1){
    tags.push("sport");
  }

  var mideastContent = /\b(gaza|rafah|khan younis|hamas|hezbollah|idf|netanyahu|westelijke jordaanoever|palestijn|palestinian|israelisch|israeli|iran|irgc|tehran|khamenei|syrië|syria|damascus|assad|libanon|lebanon|beirut|jemen|yemen|houthi|irak|iraq|bagdad|saudi-arabië|riyadh|qatar|doha|aboe dhabi|dubai|jordanië|amman|jeruzalem|jerusalem|tel aviv|beiroet)\b/.test(t);
  if(mideastContent && tags.indexOf("mideast") === -1) tags.push("mideast");

  var warScore = 0;
  if(/\b(airstrike|air strike|raketaanval|missile strike|drone strike|luchtaanval|invasion|invaded|invasie|massacre|bloedbad|genocide|ceasefire|staakt-het-vuren|offensive|offensief|bombing|bombardement|shelling|beschieting|artillery|artillerie|war crime|oorlogsmisdaad|chemical attack|gifgasaanval)\b/.test(t)) warScore += 3;
  if(/\b(killed|gedood|doden|slachtoffers|gewonden|troops|troepen|soldiers|soldaat|militairen|military|combat|gevecht|tank|tanks|frontlinie|frontline)\b/.test(t)) warScore += 1;
  if(/\b(oekraïne|ukraine|zelensky|zelenski|kyiv|kiev|kharkiv|odesa|donbas|crimea|donetsk|luhansk|marioepol|mariupol|poetin|putin|kremlin|moskou)\b/.test(t)) warScore += 2;
  if(warScore >= 2 && tags.indexOf("war") === -1) tags.push("war");

  var nlContent = /\b(nederland|nederlands|dutch|holland|amsterdam|rotterdam|den haag|the hague|utrecht|eindhoven|groningen|tilburg|almere|breda|nijmegen|haarlem|arnhem|apeldoorn|enschede|amersfoort|zwolle|leeuwarden|maastricht|tweede kamer|eerste kamer|kabinet|minister-president|premier rutte|mark rutte|geert wilders|d66|vvd|cda|pvda|groenlinks|forum voor democratie|sp partij|christenunie|sgr|bbb|nieuw sociaal contract|gemeente|provincie|randstad|noord-holland|zuid-holland|flevoland|gelderland|overijssel|drenthe|friesland|zeeland|limburg|noord-brabant)\b/.test(t);
  if(nlContent && tags.indexOf("nl") === -1) tags.push("nl");

  if(/\b(marokko|morocco|maroc|rabat|casablanca|marrakech|agadir|fes|tanger|sahara|marokkaans|marokkaanse)\b/.test(t) && tags.indexOf("maroc") === -1){
    tags.push("maroc");
  }

  var europeStrong = /\b(europese unie|european union|europese commissie|european commission|europese parlement|european parliament|brussel|brussels|nato|europese raad|eurozone|schengen|europese centrale bank|europese verkiezing)\b/.test(t);
  var europeCountry = /\b(duitsland|germany|frankrijk|france|spanje|spain|españa|italië|italy|verenigd koninkrijk|united kingdom|engeland|england|polen|poland|oostenrijk|austria|zwitserland|switzerland|zweden|sweden|noorwegen|norway|denemarken|denmark|finland|ierland|ireland|portugal|griekenland|greece|tsjechië|czech|hongarije|hungary|roemenië|romania|bulgarije|bulgaria|belgië|belgium)\b/.test(t);
  if((europeStrong || europeCountry) && tags.indexOf("europe") === -1 && tags.indexOf("nl") === -1){
    tags.push("europe");
  }

  return tags.filter(function(v, i, a){ return a.indexOf(v) === i; });
}

function ensureTags(items){
  return items.map(function(it){
    it.tags = extractTags(it.title, it.desc || "", it.cat);
    return it;
  });
}

function scoreArticle(it){
  var score = 0;
  var sources = (it.sources || [it.source]).length;
  score += sources * 12;
  var t = (it.title + " " + (it.desc || "")).toLowerCase();
  for(var i = 0; i < KEYWORDS_HIGH.length; i++) if(t.indexOf(KEYWORDS_HIGH[i]) >= 0) score += 6;
  for(var j = 0; j < KEYWORDS_MED.length; j++) if(t.indexOf(KEYWORDS_MED[j]) >= 0) score += 3;
  if(HIGH_PRIORITY.indexOf(it.source) >= 0) score += 15;
  var ageMin = Math.max(0, (Date.now() - tm(it.date)) / 60000);
  score += Math.max(0, 40 - ageMin / 2);
  return score;
}

function titleKey(title){
  return (title || "").toLowerCase().replace(/[^\w\s]/g, "")
    .split(/\s+/).filter(function(w){ return w.length > 3; })
    .slice(0, 8).sort().join(" ");
}
function dedupe(items){
  var map = new Map();
  items.forEach(function(it){
    var key = titleKey(it.title);
    if(!key){ map.set("__" + Math.random(), it); return; }
    if(!map.has(key)){
      var copy = {}; for(var k in it) copy[k] = it[k];
      copy.sources = [it.source];
      copy.tags = it.tags ? it.tags.slice() : [];
      map.set(key, copy);
    } else {
      var e = map.get(key);
      if(e.sources.indexOf(it.source) < 0) e.sources.push(it.source);
      if(it.tags){
        it.tags.forEach(function(t){
          if(e.tags.indexOf(t) === -1) e.tags.push(t);
        });
      }
    }
  });
  return Array.from(map.values());
}

function parseRssXml(xmlText){
  try{
    var doc = new DOMParser().parseFromString(xmlText, "text/xml");
    if(doc.getElementsByTagName("parsererror").length) return [];
    var nodes = doc.getElementsByTagName("item");
    if(!nodes.length) nodes = doc.getElementsByTagName("entry");
    var out = [];
    for(var i = 0; i < nodes.length; i++){
      var node = nodes[i];
      var gtxt = function(tag){
        var els = node.getElementsByTagName(tag);
        return els.length ? (els[0].textContent || "").trim() : "";
      };
      var title = gtxt("title");
      var linkEl = node.getElementsByTagName("link")[0];
      var link = linkEl ? ((linkEl.textContent || "") || linkEl.getAttribute("href") || "").trim() : "";
      var desc = gtxt("description") || gtxt("content") || gtxt("summary") || gtxt("encoded");
      var date = gtxt("pubDate") || gtxt("published") || gtxt("updated") || gtxt("date");
      var encEl = node.getElementsByTagName("enclosure")[0];
      var encLink = encEl ? (encEl.getAttribute("url") || encEl.getAttribute("href") || "") : "";
      var mediaEl = node.getElementsByTagName("media:content")[0] || node.getElementsByTagName("media:thumbnail")[0];
      var thumb = mediaEl ? (mediaEl.getAttribute("url") || "") : "";
      out.push({
        title: title, link: link, description: desc, pubDate: date,
        thumbnail: thumb, enclosure: encLink ? {link: encLink} : null
      });
    }
    return out;
  }catch(e){ return []; }
}

function normalizeItem(it){
  if(it == null) return {title:"", link:"", description:"", pubDate:"", thumbnail:""};
  if(typeof it === "string") return {title: it, link:"", description:"", pubDate:"", thumbnail:""};
  if(typeof it !== "object") return {title: String(it), link:"", description:"", pubDate:"", thumbnail:""};
  if(it.fields) it = Object.assign({}, it, it.fields);
  if(it._source) it = Object.assign({}, it, it._source);
  var raw = it.description || it.content || it.summary || it["content:encoded"] || it.contentSnippet || "";
  var enc = it.enclosure && (it.enclosure.link || it.enclosure.url);
  var thumb = it.thumbnail || enc || it.image || "";
  if(!thumb && typeof raw === "string"){
    var m = raw.match(/<img[^>]+src=["']([^"']+)["']/i);
    if(m) thumb = m[1];
  }
  var link = it.link || it.url || it.id || (it.guid && (it.guid.$t || it.guid._ || it.guid)) || "";
  return {
    title: String(it.title || it.name || it.headline || ""),
    link: String(link),
    description: String(raw),
    pubDate: it.pubDate || it.published || it.updated || it.date || it.created || it.pubdate || "",
    thumbnail: String(thumb)
  };
}

if(!window.__proxyHealth) window.__proxyHealth = {};
var PROXY_COOLDOWN_MS = 30000;
var PROXY_FAIL_THRESHOLD = 5;
var googleNewsSem = { active: 0, max: 2, queue: [] };

function googleNewsAcquire(){
  return new Promise(function(resolve){
    if(googleNewsSem.active < googleNewsSem.max){ googleNewsSem.active++; resolve(); }
    else { googleNewsSem.queue.push(resolve); }
  });
}
function googleNewsRelease(){
  if(googleNewsSem.queue.length > 0){ var next = googleNewsSem.queue.shift(); next(); }
  else { googleNewsSem.active--; }
}
function markProxyFail(p){
  if(!window.__proxyHealth[p]) window.__proxyHealth[p] = { fails: 0, disabledUntil: 0 };
  window.__proxyHealth[p].fails++;
  if(window.__proxyHealth[p].fails >= PROXY_FAIL_THRESHOLD){
    window.__proxyHealth[p].disabledUntil = Date.now() + PROXY_COOLDOWN_MS;
    window.__proxyHealth[p].fails = 0;
  }
}
function markProxyOk(p){
  if(!window.__proxyHealth[p]) window.__proxyHealth[p] = { fails: 0, disabledUntil: 0 };
  window.__proxyHealth[p].fails = 0;
  window.__proxyHealth[p].disabledUntil = 0;
}
function parseResponse(txt){
  var trimmed = txt.replace(/^\uFEFF/, "").replace(/^\s+/, "");
  if(trimmed.charAt(0) === "<") return { shape: "xml", items: parseRssXml(txt) };
  try{
    var data = JSON.parse(txt);
    var items = [];
    if(data.items && data.items.length) items = data.items;
    else if(data.entries && data.entries.length) items = data.entries;
    else if(data.data && data.data.items && data.data.items.length) items = data.data.items;
    else if(Array.isArray(data)) items = data;
    return { shape: "json", items: items };
  }catch(e){ return { shape: "?", items: [] }; }
}

async function fetchFeedWithFallback(feedUrl){
  var isGoogleNews = /news\.google\.com/.test(feedUrl);
  if(isGoogleNews) await googleNewsAcquire();
  try {
    var proxies;
    if(isGoogleNews && CONFIG.googleNewsProxies && CONFIG.googleNewsProxies.length) proxies = CONFIG.googleNewsProxies;
    else if(CONFIG.proxies && CONFIG.proxies.length) proxies = CONFIG.proxies;
    else proxies = [CONFIG.proxies[0]];
    var lastErr = null;
    for(var i = 0; i < proxies.length; i++){
      var p = proxies[i];
      var health = window.__proxyHealth[p];
      if(health && health.disabledUntil && Date.now() < health.disabledUntil) continue;
      try{
        var ctrl = new AbortController();
        var timer = setTimeout(function(){ ctrl.abort(); }, CONFIG.fetchTimeoutMs);
        var r = await fetch(p + encodeURIComponent(feedUrl), {signal: ctrl.signal});
        clearTimeout(timer);
        if(!r.ok) throw new Error("HTTP " + r.status);
        var txt = await r.text();
        var parsed = parseResponse(txt);
        if(!parsed.items.length) throw new Error("0 items");
        markProxyOk(p);
        return { items: parsed.items, shape: parsed.shape, proxyIdx: i, viaGoogleNews: isGoogleNews };
      }catch(e){
        lastErr = e;
        markProxyFail(p);
      }
    }
    throw lastErr || new Error("alle proxies faalden");
  } finally {
    if(isGoogleNews) googleNewsRelease();
  }
}

var TRANSLATION_SEM = { active: 0, max: 3, queue: [] };

function titleHashKey(lang, title) {
  var str = (lang || "xx") + "|" + (title || "");
  var h1 = 5381;
  var h2 = 52711;
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    h1 = ((h1 << 5) + h1) ^ c;
    h2 = ((h2 << 5) + h2 + c) | 0;
  }
  var a = (h1 >>> 0).toString(36);
  var b = (h2 >>> 0).toString(36);
  return "tr_" + a + "_" + b;
}
function translationAcquire() {
  return new Promise(function(resolve){
    if(TRANSLATION_SEM.active < TRANSLATION_SEM.max){ TRANSLATION_SEM.active++; resolve(); }
    else { TRANSLATION_SEM.queue.push(resolve); }
  });
}
function translationRelease() {
  if(TRANSLATION_SEM.queue.length > 0){ var next = TRANSLATION_SEM.queue.shift(); next(); }
  else { TRANSLATION_SEM.active--; }
}
async function fetchTranslation(text, sourceLang) {
  if(!text) return null;
  var cleanText = text.replace(/\s+/g, " ").trim().slice(0, 500);
  if(!cleanText) return null;
  try {
    var mmUrl = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(cleanText) +
      "&langpair=" + encodeURIComponent(sourceLang || "en") + "|nl" +
      "&de=" + encodeURIComponent(MYMEMORY_EMAIL);
    var ctrl = new AbortController();
    var timer = setTimeout(function(){ ctrl.abort(); }, 8000);
    var r = await fetch(mmUrl, { signal: ctrl.signal });
    clearTimeout(timer);
    if(r.ok){
      var data = await r.json();
      if(data && data.responseData && data.responseData.translatedText){
        var out = data.responseData.translatedText;
        if(out && out.length > 1 &&
           out.indexOf("MYMEMORY WARNING") === -1 &&
           out.indexOf("QUERY LENGTH LIMIT") === -1 &&
           out.indexOf("YOU USED ALL AVAILABLE") === -1 &&
           out !== cleanText){
          return out;
        }
      }
    }
  }catch(e){}
  try {
    var proxy = CONFIG.proxies[0];
    var googleUrl = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" +
      encodeURIComponent(sourceLang || "auto") + "&tl=nl&dt=t&q=" + encodeURIComponent(cleanText);
    var ctrl2 = new AbortController();
    var timer2 = setTimeout(function(){ ctrl2.abort(); }, 8000);
    var r2 = await fetch(proxy + encodeURIComponent(googleUrl), { signal: ctrl2.signal });
    clearTimeout(timer2);
    if(r2.ok){
      var data2 = await r2.json();
      if(data2 && Array.isArray(data2[0])){
        var out2 = "";
        for(var i = 0; i < data2[0].length; i++){ var seg = data2[0][i]; if(seg && seg[0]) out2 += seg[0]; }
        if(out2 && out2.length > 1) return out2;
      }
    }
  }catch(e){}
  return null;
}
async function translateItem(item) {
  if(!item || !item.title) return null;
  if(!item.lang || item.lang === "nl") return null;
  if(!State.translateEnabled) return null;
  var key = titleHashKey(item.lang, item.title);
  if(State.translations[key]) return State.translations[key];
  var cached = await NewsDB.loadTranslation(key);
  if(cached){ State.translations[key] = cached; return cached; }
  if(State.translationPending[key]) return null;
  State.translationPending[key] = true;
  await translationAcquire();
  try {
    var translated = await fetchTranslation(item.title, item.lang);
    if(translated){
      State.translations[key] = translated;
      NewsDB.saveTranslation(key, translated).catch(function(){});
      return translated;
    }
  } finally {
    translationRelease();
    delete State.translationPending[key];
  }
  return null;
}
async function translateVisibleItems(items) {
  if(!State.translateEnabled) return;
  var toTranslate = items.filter(function(it){
    if(!it.lang || it.lang === "nl") return false;
    var key = titleHashKey(it.lang, it.title);
    return !State.translations[key];
  });
  if(!toTranslate.length) return;
  await Promise.all(toTranslate.map(async function(it){
    var translated = await translateItem(it);
    if(translated) updateCardTitle(it, translated);
  }));
}
function updateCardTitle(item, translatedTitle) {
  var cards = document.querySelectorAll(".news-card[data-link]");
  for(var i = 0; i < cards.length; i++){
    if(cards[i].getAttribute("data-link") === item.link){
      var titleEl = cards[i].querySelector(".card-title");
      var origEl = cards[i].querySelector(".card-original");
      if(titleEl){ titleEl.textContent = translatedTitle; titleEl.setAttribute("dir", "ltr"); }
      if(!origEl && titleEl){
        origEl = document.createElement("p");
        origEl.className = "card-original";
        origEl.setAttribute("dir", item.lang === "ar" ? "rtl" : "ltr");
        origEl.textContent = item.title;
        titleEl.parentNode.insertBefore(origEl, titleEl.nextSibling);
      }
      break;
    }
  }
}
function getDisplayTitle(it) {
  if(!State.translateEnabled) return { title: it.title, original: null };
  if(!it.lang || it.lang === "nl") return { title: it.title, original: null };
  var key = titleHashKey(it.lang, it.title);
  if(State.translations[key]) return { title: State.translations[key], original: it.title };
  return { title: it.title, original: null };
}
window.__setTranslate = function(enabled){
  State.translateEnabled = !!enabled;
  try { localStorage.setItem("wardesk_translate", enabled ? "1" : "0"); }catch(e){}
  var btn = document.getElementById("toggleTranslate");
  if(btn) btn.classList.toggle("toggle-on", enabled);
  State._lastRenderHash = "";
  renderNews();
  if(window.showToast) window.showToast(enabled ? "Vertaling aan" : "Vertaling uit");
  if(enabled){
    var toShow = filterItems().slice(0, 100);
    translateVisibleItems(toShow);
  }
};

function isFavorite(link){ return !!State.favorites[link]; }
function toggleFavorite(link, btnEl){
  if(State.favorites[link]){
    delete State.favorites[link];
    NewsDB.removeFavorite(link);
    if(btnEl){ btnEl.classList.remove("active"); btnEl.textContent = "☆"; }
  } else {
    State.favorites[link] = Date.now();
    NewsDB.saveFavorite(link);
    if(btnEl){ btnEl.classList.add("active"); btnEl.textContent = "★"; }
  }
  updateFavoritesCount();
  if(State.currentCat === "favorites"){
    State._lastRenderHash = "";
    renderNews();
  }
}
function updateFavoritesCount(){
  var el = document.getElementById("favCount");
  if(el) el.textContent = Object.keys(State.favorites).length;
}

async function requestNotificationPermission(){
  if(!("Notification" in window)) return false;
  if(Notification.permission === "granted") return true;
  if(Notification.permission === "denied") return false;
  try {
    var result = await Notification.requestPermission();
    return result === "granted";
  } catch(e) { return false; }
}

window.__setNotifications = async function(enabled){
  if(enabled){
    var ok = await requestNotificationPermission();
    if(!ok){
      if(window.showToast) window.showToast("Notificaties geweigerd door browser");
      return;
    }
    State.notificationsEnabled = true;
    try { localStorage.setItem("wardesk_notifications", "1"); }catch(e){}
    if(window.showToast) window.showToast("Breaking notificaties aan");
    try {
      new Notification("WAR DESK", {
        body: "Notificaties zijn ingeschakeld.",
        tag: "wardesk-test",
        icon: "./icons/icon-192.png",
        badge: "./icons/icon-96.png"
      });
    }catch(e){}
  } else {
    State.notificationsEnabled = false;
    try { localStorage.setItem("wardesk_notifications", "0"); }catch(e){}
    if(window.showToast) window.showToast("Notificaties uit");
  }
};

function sendBreakingNotification(group){
  if(!State.notificationsEnabled) return;
  if(!("Notification" in window)) return;
  if(Notification.permission !== "granted") return;
  if(group.sources.length < 5) return;
  try {
    var title = "Breaking - " + group.sources.length + " bronnen";
    var body = group.items[0].title.slice(0, 180);
    var notif = new Notification(title, {
      body: body,
      tag: "wardesk-breaking-" + Math.floor(Date.now() / 60000),
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-96.png"
    });
    notif.onclick = function(){ try { window.focus(); }catch(e){} notif.close(); };
  }catch(e) { console.warn("[WAR DESK] notificatie fout:", e); }
}

async function loadAllFeeds(){
  var session = ++State.loadSession;
  var itemsAtStart = State.items.slice();
  var minKeep = itemsAtStart.length;
  var active = FEEDS.filter(function(f){ return !State.disabled[f.n]; });
  State.totalSources = active.length;
  State.failedSources = [];
  State.loadedSources = 0;
  var collected = [];
  var collectedLinks = {};
  var tried = 0;

  emitProgress(3);

  window.__wdDiagCount = 0;
  var lastProgressiveCount = 0;
  var progressiveTimer = setInterval(function(){
    if(session !== State.loadSession){ clearInterval(progressiveTimer); return; }
    if(collected.length <= lastProgressiveCount) return;
    lastProgressiveCount = collected.length;
    var merged = dedupe(collected.concat(itemsAtStart));
    if(merged.length < minKeep) merged = itemsAtStart.slice();
    State.items = merged;
    var itemsEl = document.getElementById("statItems");
    if(itemsEl) itemsEl.textContent = State.items.length;
    renderNews();
  }, 1000);

  async function processOne(f){
    if(session !== State.loadSession) return;
    tried++;
    try{
      var result = await fetchFeedWithFallback(f.url);
      var items = result.items;
      var shape = result.shape;
      var proxyIdx = result.proxyIdx;
      var added = 0;
      items.slice(0, CONFIG.perFeed).forEach(function(rawIt){
        var it = normalizeItem(rawIt);
        var titleClean = strip(it.title || "");
        var descClean = strip(it.description || "").slice(0, 300);
        var key = String(it.link || titleClean).toLowerCase().trim();
        if(key && !collectedLinks[key]){
          collectedLinks[key] = 1;
          var detectedTags = extractTags(titleClean, descClean, f.cat);
          collected.push({
            title: titleClean,
            link: it.link || "#",
            desc: descClean,
            img: it.thumbnail || "",
            date: it.pubDate || "",
            source: f.n,
            cat: f.cat,
            tags: detectedTags,
            lang: f.lang
          });
          added++;
        }
      });
      if(window.__wdDebug && window.__wdDiagCount < 5 && window.wdLog){
        window.__wdDiagCount++;
        var pTag = proxyIdx === 0 ? "p1" : ("p" + (proxyIdx + 1));
        window.wdLog.info(f.n + " [" + shape + "/" + pTag + "] items=" + items.length + " nieuw=" + added);
      }
      State.loadedSources++;
      if(State.health[f.n]) State.health[f.n].fails = 0;
      var srcEl = document.getElementById("statSources");
      if(srcEl && session === State.loadSession) srcEl.textContent = State.loadedSources + "/" + State.totalSources;
    }catch(e){
      State.failedSources.push(f.n);
      if(!State.health[f.n]) State.health[f.n] = {fails:0, last:0};
      State.health[f.n].fails++;
      State.health[f.n].last = Date.now();
      if(State.health[f.n].fails >= CONFIG.failThreshold) State.disabled[f.n] = true;
    }

    if(session === State.loadSession){
      var pct = 3 + Math.round((tried / Math.max(1, active.length)) * 92);
      emitProgress(pct);
    }
  }

  var queue = active.slice();
  var workers = [];
  for(var i = 0; i < CONFIG.parallelWorkers; i++){
    workers.push((async function(){
      while(queue.length && session === State.loadSession){
        var f = queue.shift();
        if(f) await processOne(f);
      }
    })());
  }
  await Promise.all(workers);
  clearInterval(progressiveTimer);
  if(session !== State.loadSession) return;
  State.items = dedupe(collected.concat(itemsAtStart));
  if(State.items.length < minKeep) State.items = itemsAtStart.slice();
  var srcEl = document.getElementById("statSources");
  if(srcEl) srcEl.textContent = State.loadedSources + "/" + State.totalSources;
  var itemsEl = document.getElementById("statItems");
  if(itemsEl) itemsEl.textContent = State.items.length;
  NewsDB.saveItems(State.items);
  NewsDB.saveHealth(State.health);

  emitProgress(100, true);

  detectBreaking();
  renderNews();
  if(State.translateEnabled){
    var toShow = filterItems().slice(0, 100);
    translateVisibleItems(toShow);
  }
  if(window.__wdDebug && window.wdLog){
    window.wdLog[State.items.length ? "ok" : "warn"](
      "loadAllFeeds klaar - " + State.items.length + " items uit " + State.loadedSources + "/" + State.totalSources + " bronnen"
    );
  }
}

function detectBreaking(){
  if(Date.now() - State.breakingShownAt < 1800000) return;
  var now = Date.now();
  var recent = State.items.filter(function(it){
    var age = now - tm(it.date);
    return age > 0 && age < 900000;
  }).slice(0, 40);
  if(recent.length < 3) return;
  var groups = [];
  var used = {};
  recent.forEach(function(a, i){
    if(used[i]) return;
    var group = { items: [a], sources: [a.source] };
    used[i] = 1;
    var aText = (a.title + " " + a.desc).toLowerCase();
    var aKw = KEYWORDS_HIGH.filter(function(k){ return aText.indexOf(k) >= 0; });
    recent.forEach(function(b, j){
      if(used[j] || i === j) return;
      var bText = (b.title + " " + b.desc).toLowerCase();
      var shared = aKw.filter(function(k){ return bText.indexOf(k) >= 0; });
      if(shared.length >= 2){
        group.items.push(b);
        if(group.sources.indexOf(b.source) < 0) group.sources.push(b.source);
        used[j] = 1;
      }
    });
    if(group.sources.length >= 3) groups.push(group);
  });
  if(!groups.length) return;
  groups.sort(function(a, b){ return b.sources.length - a.sources.length; });
  var g = groups[0];
  State.breakingShownAt = Date.now();
  State.lastBreakingItem = g.items[0];
  var bcEl = document.getElementById("breakingCount");
  var btEl = document.getElementById("breakingTitle");
  var bmEl = document.getElementById("breakingMeta");
  if(bcEl) bcEl.textContent = g.sources.length;
  if(btEl) btEl.textContent = g.items[0].title.slice(0, 180);
  if(bmEl) bmEl.textContent = g.sources.slice(0, 4).join(" · ");
  var banner = document.getElementById("breakingBanner");
  if(banner){
    banner.classList.add("show");
    clearTimeout(banner._timer);
    banner._timer = setTimeout(function(){ banner.classList.remove("show"); }, 30000);
  }
  if(State.notificationsEnabled && document.hidden){
    sendBreakingNotification(g);
  }
}

function filterItems(){
  var list = State.items.slice();
  if(State.currentCat === "favorites"){
    list = list.filter(function(it){ return !!State.favorites[it.link]; });
  } else if(State.currentCat !== "all"){
    var cats = (window.CAT_GROUPS && CAT_GROUPS[State.currentCat]) || [State.currentCat];
    if(cats.length){
      list = list.filter(function(it){
        return it.tags && it.tags.some(function(t){ return cats.indexOf(t) >= 0; });
      });
    }
  }
  if(State.currentSearch){
    var q = State.currentSearch;
    list = list.filter(function(it){
      return (it.title + " " + it.desc + " " + it.source).toLowerCase().indexOf(q) >= 0;
    });
  }
  if(State.currentSort === "importance"){
    list.forEach(function(it){ if(it._score === undefined) it._score = scoreArticle(it); });
    list.sort(function(a, b){ return b._score - a._score; });
  } else {
    list.sort(function(a, b){ return tm(b.date) - tm(a.date); });
  }
  return list;
}

function renderSkeletons(grid){
  var html = "";
  for(var i = 0; i < 6; i++){
    html += '<article class="skeleton-card">' +
      '<div class="skeleton-thumb"></div>' +
      '<div class="skeleton-body">' +
      '<div class="skeleton-meta"></div>' +
      '<div class="skeleton-line medium"></div>' +
      '<div class="skeleton-line"></div>' +
      '<div class="skeleton-line short"></div>' +
      '</div></article>';
  }
  grid.innerHTML = html;
}

function renderNews(){
  var list = filterItems();
  var grid = document.getElementById("feedGrid");
  var title = document.getElementById("newsTitle");
  var count = document.getElementById("newsCount");
  var titles = {
    all: "Laatste berichten",
    war: "Oorlog & conflict",
    mideast: "Midden-Oosten",
    europe: "Europa",
    nl: "Nederland",
    maroc: "Marokko",
    vs: "Verenigde Staten",
    sport: "Sport",
    favorites: "Favorieten"
  };
  var catLabel = titles[State.currentCat] || "Laatste berichten";
  if(title) title.textContent = catLabel;
  if(count) count.textContent = list.length + " artikelen";
  if(!grid) return;
  if(!list.length){
    if(State.items.length === 0){
      renderSkeletons(grid);
    } else if(State.currentCat === "favorites"){
      grid.innerHTML = '<div class="empty-state">' +
        '<div class="empty-icon">☆</div>' +
        '<div class="empty-msg">Nog geen favorieten</div>' +
        '<div class="empty-hint">Tik op het ster-icoon bij een artikel om het te bewaren</div>' +
        '</div>';
    } else {
      grid.innerHTML = '<div class="empty-state">' +
        '<div class="empty-icon">◌</div>' +
        '<div class="empty-msg">Geen artikelen in <span class="empty-context">' + esc(catLabel) + '</span></div>' +
        '<div class="empty-hint">Probeer een andere categorie of zoekterm</div>' +
        '</div>';
    }
    return;
  }
  var toShow = list.slice(0, 100);
  grid.classList.toggle("list-mode", State.viewMode === "list");
  var html = "";
  for(var i = 0; i < toShow.length; i++){
    var it = toShow[i];
    var disp = getDisplayTitle(it);
    var isTranslated = !!disp.original;
    var isArabic = it.lang === "ar" || /[\u0600-\u06FF]/.test(disp.title);
    var titleDir = isTranslated ? "ltr" : (isArabic ? "rtl" : "ltr");
    var isRead = State.readMap[it.link];
    var isFav = isFavorite(it.link);
    var sources = it.sources || [it.source];
    var multi = sources.length > 1;

    html += '<article class="news-card ' + (it.cat === "war" ? "war " : "") + (isRead ? "read" : "") + '" data-idx="' + i + '" data-link="' + esc(it.link) + '">';
    if(it.img) html += '<div class="card-thumb"><img src="' + esc(it.img) + '" loading="lazy" onerror="this.parentNode.remove()"></div>';
    html += '<div class="card-body">';
    html += '<div class="card-meta">';
    html += '<span class="card-source">' + esc(it.source) + '</span>';
    html += '<span class="card-sep">·</span>';
    html += '<span>' + ago(it.date) + '</span>';
    if(multi) html += '<span class="card-multi">' + sources.length + ' bronnen</span>';
    html += '</div>';
    html += '<h3 class="card-title" dir="' + titleDir + '">' + esc(disp.title) + '</h3>';
    if(isTranslated){
      html += '<p class="card-original" dir="' + (it.lang === "ar" ? "rtl" : "ltr") + '">' + esc(disp.original) + '</p>';
    }
    if(it.desc) html += '<p class="card-desc" dir="' + (it.lang === "ar" ? "rtl" : "ltr") + '">' + esc(it.desc) + '</p>';
    html += '<div class="card-footer">';
    html += '<span>' + rtime(it.desc) + ' min lezen</span>';
    html += '<div class="card-actions">';
    html += '<button class="card-fav ' + (isFav ? "active" : "") + '" aria-label="Favoriet">' + (isFav ? "★" : "☆") + '</button>';
    html += '<button class="card-action card-share" aria-label="Delen">⇗</button>';
    html += '</div>';
    html += '</div></div></article>';
  }
  grid.innerHTML = html;

  Array.prototype.forEach.call(grid.querySelectorAll("article"), function(art, i){
    var it = toShow[i];
    if(!it) return;
    art.addEventListener("click", function(e){
      if(e.target.closest(".card-action")) return;
      if(e.target.closest(".card-fav")) return;
      if(!State.readMap[it.link]){
        State.readMap[it.link] = Date.now();
        NewsDB.saveRead(it.link);
        art.classList.add("read");
      }
      window.open(it.link, "_blank", "noopener");
    });

    var favBtn = art.querySelector(".card-fav");
    if(favBtn) favBtn.addEventListener("click", function(e){
      e.stopPropagation();
      toggleFavorite(it.link, favBtn);
    });

    var share = art.querySelector(".card-share");
    if(share) share.addEventListener("click", function(e){
      e.stopPropagation();
      if(navigator.share){
        navigator.share({ title: it.title, url: it.link }).catch(function(){});
      } else if(navigator.clipboard){
        navigator.clipboard.writeText(it.link).then(function(){
          if(window.showToast) window.showToast("Link gekopieerd");
        });
      }
    });

    var multi = art.querySelector(".card-multi");
    if(multi) multi.addEventListener("click", function(e){
      e.stopPropagation();
      if(window.showToast) window.showToast(it.sources.join(", "));
    });
  });

  if(State.translateEnabled) translateVisibleItems(toShow);
}

function startAutoRefresh(){
  clearInterval(State.refreshTimer);
  if(!CONFIG.autoRefreshMs || CONFIG.autoRefreshMs <= 0) return;
  State.refreshTimer = setInterval(function(){
    var idle = Date.now() - State.lastActivity;
    var atTop = window.scrollY < 200;
    if(idle < CONFIG.pauseOnScrollMs && !atTop) return;
    if(State.isScrolling) return;
    State.disabled = {};
    loadAllFeeds();
  }, CONFIG.autoRefreshMs);
}

async function initNews(){
  await NewsDB.open();
  NewsDB.pruneOldReads().catch(function(){});

  try{
    if(localStorage.getItem("wardesk_tags_version") !== window.TAGS_VERSION){
      await NewsDB.saveItems([]);
      localStorage.setItem("wardesk_tags_version", window.TAGS_VERSION);
      console.log("[WAR DESK] Tags-versie gewijzigd — cache geleegd");
    }
  }catch(e){}

  try { State.translateEnabled = localStorage.getItem("wardesk_translate") === "1"; }catch(e){}
  try { State.notificationsEnabled = localStorage.getItem("wardesk_notifications") === "1"; }catch(e){}
  State.health = {};
  State.disabled = {};
  State.readMap = await NewsDB.loadReadMap();
  State.favorites = await NewsDB.loadFavorites();
  updateFavoritesCount();

  var grid = document.getElementById("feedGrid");
  if(grid && !State.items.length) renderSkeletons(grid);

  var cached = await NewsDB.loadItems();
  if(cached.length){
    State.items = ensureTags(cached);
    var itemsEl = document.getElementById("statItems");
    if(itemsEl) itemsEl.textContent = State.items.length;
    renderNews();
  }
  await loadAllFeeds();
  startAutoRefresh();
  window.addEventListener("scroll", function(){
    State.lastActivity = Date.now();
    State.isScrolling = true;
    clearTimeout(State.scrollTimer);
    State.scrollTimer = setTimeout(function(){ State.isScrolling = false; }, 1500);
  }, {passive:true});
  ["touchstart", "mousedown", "keydown", "click"].forEach(function(ev){
    window.addEventListener(ev, function(){ State.lastActivity = Date.now(); }, {passive:true});
  });
}

window.__hardRefresh = async function(){
  if(!window.NewsAPI) return;
  if(!confirm('Verversen?\n\nAlle bronnen worden opnieuw geladen. Dit kan 30-60 seconden duren.')) return;
  try{
    if(window.showToast) window.showToast("Verversen gestart...");
    await NewsDB.saveItems([]);
    State.disabled = {};
    State.health = {};
    State.loadedSources = 0;
    State.totalSources = 0;
    State.failedSources = [];
    await NewsAPI.reload();
    if(window.showToast) window.showToast("Verversen klaar");
  }catch(e){
    console.error("[WAR DESK] hard refresh fout:", e);
    if(window.showToast) window.showToast("Verversen mislukt");
  }
};

window.NewsAPI = {
  init: initNews,
  reload: loadAllFeeds,
  setCat: function(cat){ State.currentCat = cat; renderNews(); },
  setSort: function(s){ State.currentSort = s; renderNews(); },
  setSearch: function(s){ State.currentSearch = s.toLowerCase().trim(); renderNews(); },
  setView: function(v){ State.viewMode = v; renderNews(); },
  render: renderNews
};

console.log("[WAR DESK] news.js " + window.__newsVersion + " geladen");