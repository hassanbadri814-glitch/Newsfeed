/* ============================================================
   WAR DESK v20.6 — Nieuws logica
   - Hard refresh wist State.items NIET meer
   - Progressive timer sneller (1000ms)
   - Safety: nooit minder items tonen dan bij start
   - Merge-based progressive rendering
   ============================================================ */
window.__newsVersion = "v20.6-no-empty-refresh";

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
  lastActivity: Date.now(),
  isScrolling: false,
  scrollTimer: null,
  refreshTimer: null,
  viewMode: "cards",
  breakingShownAt: 0,
  lastBreakingItem: null,
  loadSession: 0,
  db: null,
  _lastRenderHash: ""
};

/* ===== INDEXEDDB ===== */
var NewsDB = (function(){
  var db = null;
  var DB_NAME = "wardesk_v19_news";
  var DB_VERSION = 1;

  function open(){
    return new Promise(function(resolve){
      if(!("indexedDB" in window)){ resolve(null); return; }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function(e){
        var d = e.target.result;
        if(!d.objectStoreNames.contains("items")) d.createObjectStore("items", {keyPath:"link"});
        if(!d.objectStoreNames.contains("meta")) d.createObjectStore("meta", {keyPath:"k"});
      };
      req.onsuccess = function(e){ db = e.target.result; resolve(db); };
      req.onerror = function(){ resolve(null); };
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
        items.slice(0, CONFIG.maxCacheItems).forEach(function(it){
          store.put({
            link: it.link, title: it.title, desc: it.desc, img: it.img,
            date: it.date, source: it.source, cat: it.cat, lang: it.lang,
            sources: it.sources, tags: it.tags || []
          });
        });
        tx.oncomplete = function(){ res(); };
      }catch(e){ res(); }
    });
  }
  return {
    open: open, put: put, get: get, getAll: getAll, saveItems: saveItems,
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
  return (s || "").replace(/[&<>"']/g, function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
  });
}

function extractTags(title, desc, fallback){
  var tags = [];
  var t = ((title || "") + " " + (desc || "")).toLowerCase();

  var sportSignal = /\b(voetbal|football|soccer|eredivisie|eerste divisie|knvb|ajax|psv|feyenoord|az alkmaar|fc utrecht|fc twente|vitesse|sc heerenveen|n\.e\.c\.|sparta|willem ii|go ahead|pec zwolle|rkc|fortuna sittard|excelsior|almere city|heracles|voetbalzone|voetbalnieuws|voetbalprimeur|match|wedstrijd|goal|doelpunt|keeper|doelman|coach|trainer|speler|selectie|toernooi|competitie|champions league|europa league|conference league|knvb beker|johan cruijff schaal|fifa|uefa|wk|ek|kickboxing|glory|mma|ufc|boksen|boks|vechtsport|formule 1|f1|grand prix|motogp|olympische|tennis|wimbledon|roland garros|us open|australian open|basketbal|nba|nfl|nhl|mlb|wielrennen|tour de france|giro|vuelta|darts|schaatsen|zwemmen|atletiek|hockey|handbal|volleybal|honkbal|rugby|cricket|golf|surfen|ski|snowboard)\b/.test(t);
  if(sportSignal && !/\b(airstrike|missile strike|invasion|massacre|shelling)\b/.test(t)){
    tags.push("sport");
  }

  if(/\b(gaza|rafah|khan younis|hamas|palestin|netanyahu|tel aviv|jerusalem|idf|hebron|jenin|nablus|ramallah|west bank)\b/.test(t)) tags.push("gaza", "mideast", "war");
  if(/\b(lebanon|lebanese|beirut|hezbollah|nasrallah|hizbullah|sidon|tripoli|tyre)\b/.test(t)) tags.push("lebanon", "mideast", "war");
  if(/\b(iran|iranian|tehran|irgc|khamenei|persian gulf|pezeshkian)\b/.test(t)) tags.push("iran", "mideast", "war");
  if(/\b(syria|syrian|damascus|assad|idlib|aleppo|homs|raqqa|sharaa)\b/.test(t)) tags.push("syria", "mideast", "war");
  if(/\b(yemen|yemeni|houthi|sanaa|aden|taiz|hodeidah)\b/.test(t)) tags.push("yemen", "mideast", "war");
  if(/\b(ukraine|ukrainian|kyiv|kiev|zelensky|kharkiv|odesa|donbas|crimea|donetsk|luhansk|mariupol|putin|kremlin|moscow|russia)\b/.test(t)) tags.push("ukraine", "war");
  if(/\b(sudan|sudanese|khartoum|darfur|rsf|omdurman)\b/.test(t)) tags.push("sudan", "war");
  if(/\b(morocco|moroccan|maroc|rabat|casablanca|marrakech|agadir|fes|tanger|western sahara|sahara)\b/.test(t)) tags.push("maroc");

  if(/\b(airstrike|air strike|missile|invasion|invaded|ceasefire|cease-fire|military|soldier|troops|combat|offensive|bombing|shelling|artillery|tank|drone strike|hostage|massacre|war crime)\b/.test(t)){
    if(tags.indexOf("war") === -1) tags.push("war");
  }

  return tags.filter(function(v, i, a){ return a.indexOf(v) === i; });
}

function ensureTags(items){
  return items.map(function(it){
    if(!it.tags || !Array.isArray(it.tags) || it.tags.length === 0){
      it.tags = extractTags(it.title, it.desc || "", it.cat);
    }
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

/* ============================================================
   PROXY FALLBACK + GOOGLE NEWS SEMAPHORE
   ============================================================ */
window.__proxyHealth = {};

var PROXY_COOLDOWN_MS = 30000;
var PROXY_FAIL_THRESHOLD = 5;

var googleNewsSem = { active: 0, max: 2, queue: [] };

function googleNewsAcquire(){
  return new Promise(function(resolve){
    if(googleNewsSem.active < googleNewsSem.max){
      googleNewsSem.active++;
      resolve();
    } else {
      googleNewsSem.queue.push(resolve);
    }
  });
}

function googleNewsRelease(){
  if(googleNewsSem.queue.length > 0){
    var next = googleNewsSem.queue.shift();
    next();
  } else {
    googleNewsSem.active--;
  }
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
  if(trimmed.charAt(0) === "<"){
    return { shape: "xml", items: parseRssXml(txt) };
  }
  try{
    var data = JSON.parse(txt);
    var items = [];
    if(data.items && data.items.length) items = data.items;
    else if(data.entries && data.entries.length) items = data.entries;
    else if(data.data && data.data.items && data.data.items.length) items = data.data.items;
    else if(Array.isArray(data)) items = data;
    return { shape: "json", items: items };
  }catch(e){
    return { shape: "?", items: [] };
  }
}

async function fetchFeedWithFallback(feedUrl){
  var isGoogleNews = /news\.google\.com/.test(feedUrl);

  if(isGoogleNews) await googleNewsAcquire();

  try {
    var proxies;
    if(isGoogleNews && CONFIG.googleNewsProxies && CONFIG.googleNewsProxies.length){
      proxies = CONFIG.googleNewsProxies;
    } else if(CONFIG.proxies && CONFIG.proxies.length){
      proxies = CONFIG.proxies;
    } else {
      proxies = [CONFIG.proxy];
    }

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

/* ============================================================
   LOAD FEEDS — merge-based progressive rendering
   ============================================================ */
async function loadAllFeeds(){
  var session = ++State.loadSession;

  window.__proxyHealth = {};

  /* Snapshot van bestaande items — deze worden NOOIT verwijderd */
  var itemsAtStart = State.items.slice();
  var minKeep = itemsAtStart.length;

  var active = FEEDS.filter(function(f){ return !State.disabled[f.n]; });
  State.totalSources = active.length;
  State.failedSources = [];
  State.loadedSources = 0;

  var collected = [];
  var collectedLinks = {};
  var tried = 0;
  var bar = document.getElementById("progressBar");
  if(bar){
    bar.classList.add("show");
    bar.style.width = "10%";
  }

  window.__wdDiagCount = 0;

  /* ===== PROGRESSIVE RENDERING ===== */
  var lastProgressiveCount = 0;
  var progressiveTimer = setInterval(function(){
    if(session !== State.loadSession){
      clearInterval(progressiveTimer);
      return;
    }
    if(collected.length <= lastProgressiveCount) return;
    lastProgressiveCount = collected.length;

    var merged = dedupe(collected.concat(itemsAtStart));

    /* SAFETY: nooit minder items tonen dan we begonnen zijn */
    if(merged.length < minKeep){
      merged = itemsAtStart.slice();
    }

    State.items = merged;

    var itemsEl = document.getElementById("statItems");
    if(itemsEl) itemsEl.textContent = State.items.length;

    State._lastRenderHash = "";
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
        window.wdLog.info("✓ " + f.n + " [" + shape + "/" + pTag + "] items=" + items.length + " nieuw=" + added);
      }

      State.loadedSources++;
      if(State.health[f.n]) State.health[f.n].fails = 0;

      var srcEl = document.getElementById("statSources");
      if(srcEl && session === State.loadSession){
        srcEl.textContent = State.loadedSources + "/" + State.totalSources;
      }
    }catch(e){
      State.failedSources.push(f.n);
      if(!State.health[f.n]) State.health[f.n] = {fails:0, last:0};
      State.health[f.n].fails++;
      State.health[f.n].last = Date.now();
      if(State.health[f.n].fails >= CONFIG.failThreshold){
        State.disabled[f.n] = true;
      }
    }

    if(bar && session === State.loadSession){
      bar.style.width = (10 + Math.round((tried / active.length) * 85)) + "%";
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

  /* Finale merge */
  State.items = dedupe(collected.concat(itemsAtStart));
  if(State.items.length < minKeep){
    State.items = itemsAtStart.slice();
  }

  var srcEl = document.getElementById("statSources");
  if(srcEl) srcEl.textContent = State.loadedSources + "/" + State.totalSources;
  var itemsEl = document.getElementById("statItems");
  if(itemsEl) itemsEl.textContent = State.items.length;

  NewsDB.saveItems(State.items);
  NewsDB.saveHealth(State.health);

  if(bar){
    bar.style.width = "100%";
    setTimeout(function(){ bar.classList.remove("show"); bar.style.width = "0%"; }, 400);
  }

  detectBreaking();

  State._lastRenderHash = "";
  renderNews();

  if(window.__wdDebug && window.wdLog){
    window.wdLog[State.items.length ? "ok" : "warn"](
      "loadAllFeeds klaar — " + State.items.length + " items uit " + State.loadedSources + "/" + State.totalSources + " bronnen"
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
}

function filterItems(){
  var list = State.items.slice();

  if(State.currentCat !== "all"){
    var cats = CAT_GROUPS[State.currentCat] || [State.currentCat];
    list = list.filter(function(it){
      var matchCat = cats.indexOf(it.cat) >= 0;
      var matchTags = it.tags && it.tags.some(function(t){ return cats.indexOf(t) >= 0; });
      return matchCat || matchTags;
    });
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

  var hash = State.currentCat + "|" + State.currentSort + "|" + State.currentSearch + "|" + State.viewMode + "|" + list.length;
  for(var h = 0; h < list.length; h++){
    hash += "|" + (list[h].link || "");
  }
  if(hash === State._lastRenderHash) return;
  State._lastRenderHash = hash;

  var titles = {
    all: "Laatste berichten", war: "Oorlog & conflict",
    mideast: "Midden-Oosten", europe: "Europa",
    nl: "Nederland", sport: "Sport"
  };
  var catLabel = titles[State.currentCat] || "Laatste berichten";
  if(title) title.textContent = catLabel;
  if(count) count.textContent = list.length + " artikelen";

  if(!grid) return;

  if(!list.length){
    if(State.items.length === 0){
      renderSkeletons(grid);
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
    var rtl = it.lang === "ar" || /[\u0600-\u06FF]/.test(it.title);
    var isRead = State.readMap[it.link];
    var sources = it.sources || [it.source];
    var multi = sources.length > 1;

    html += '<article class="news-card ' + (it.cat === "war" ? "war " : "") + (isRead ? "read" : "") + '" data-idx="' + i + '">';
    if(it.img) html += '<div class="card-thumb"><img src="' + esc(it.img) + '" loading="lazy" onerror="this.parentNode.remove()"></div>';
    html += '<div class="card-body">';
    html += '<div class="card-meta">';
    html += '<span class="card-source">' + esc(it.source) + '</span>';
    html += '<span class="card-sep">·</span>';
    html += '<span>' + ago(it.date) + '</span>';
    if(multi) html += '<span class="card-multi">' + sources.length + '× bronnen</span>';
    html += '</div>';
    html += '<h3 class="card-title" dir="' + (rtl ? "rtl" : "ltr") + '">' + esc(it.title) + '</h3>';
    if(it.desc) html += '<p class="card-desc" dir="' + (rtl ? "rtl" : "ltr") + '">' + esc(it.desc) + '</p>';
    html += '<div class="card-footer">';
    html += '<span>' + rtime(it.desc) + ' min lezen</span>';
    html += '<button class="card-action card-share" aria-label="Delen">⇗</button>';
    html += '</div></div></article>';
  }
  grid.innerHTML = html;

  Array.prototype.forEach.call(grid.querySelectorAll("article"), function(art, i){
    var it = toShow[i];
    if(!it) return;

    art.addEventListener("click", function(e){
      if(e.target.closest(".card-action")) return;
      if(!State.readMap[it.link]){
        State.readMap[it.link] = Date.now();
        NewsDB.saveRead(it.link);
        art.classList.add("read");
      }
      window.open(it.link, "_blank", "noopener");
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

  State.health = {};
  State.disabled = {};

  State.readMap = await NewsDB.loadReadMap();

  var grid = document.getElementById("feedGrid");
  if(grid && !State.items.length){
    renderSkeletons(grid);
  }

  var cached = await NewsDB.loadItems();
  if(cached.length){
    State.items = ensureTags(cached);
    var itemsEl = document.getElementById("statItems");
    if(itemsEl) itemsEl.textContent = State.items.length;
    State._lastRenderHash = "";
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

/* ============================================================
   HARD REFRESH — wist cache maar behoudt UI-items
   ============================================================ */
window.__hardRefresh = async function(){
  if(!window.NewsAPI) return;
  if(!confirm('Verversen?\n\nAlle bronnen worden opnieuw geladen. Dit kan 30-60 seconden duren.')) return;

  try{
    if(window.showToast) window.showToast("🔄 Verversen gestart...");

    /* Wis alleen de database-cache. State.items blijft intact zodat de UI
       nooit leeg wordt tijdens het laden. */
    await NewsDB.saveItems([]);

    State.disabled = {};
    State.health = {};
    State.loadedSources = 0;
    State.totalSources = 0;
    State.failedSources = [];
    State._lastRenderHash = "";

    await NewsAPI.reload();

    if(window.showToast) window.showToast("✓ Verversen klaar");
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