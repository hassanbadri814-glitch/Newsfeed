/* ============================================================
   WAR DESK v19.0 — Nieuws logica
   ============================================================ */

/* ===== STATE ===== */
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
  db: null
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
            sources: it.sources
          });
        });
        tx.oncomplete = function(){ res(); };
      }catch(e){ res(); }
    });
  }
  return {
    open: open,
    put: put,
    get: get,
    getAll: getAll,
    saveItems: saveItems,
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

/* ===== HELPERS ===== */
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

/* ===== TOPIC DETECTION — sport eerst ===== */
function detectTopic(title, desc, fallback){
  var t = ((title || "") + " " + (desc || "")).toLowerCase();

  // Sport eerst
  var sportSignal = fallback === "sport" ||
    /\b(voetbal|football|soccer|eredivisie|eerste divisie|knvb|ajax|psv|feyenoord|az alkmaar|fc utrecht|fc twente|vitesse|sc heerenveen|n\.e\.c\.|sparta|willem ii|go ahead|pec zwolle|rkc|fortuna sittard|excelsior|almere city|heracles|voetbalzone|voetbalnieuws|voetbalprimeur|match|wedstrijd|goal|doelpunt|keeper|doelman|coach|trainer|speler|selectie|toernooi|competitie|champions league|europa league|conference league|knvb beker|johan cruijff schaal|fifa|uefa|wk|ek|kickboxing|glory|mma|ufc|boksen|boks|vechtsport|formule 1|f1|grand prix|motogp|olympische|tennis|wimbledon|roland garros|us open|australian open|basketbal|nba|nfl|nhl|mlb|wielrennen|tour de france|giro|vuelta|darts|schaatsen|zwemmen|atletiek|hockey|handbal|volleybal|honkbal|rugby|cricket|golf|surfen|ski|snowboard)\b/.test(t);

  if(sportSignal){
    if(/\b(airstrike|missile strike|invasion|massacre|shelling)\b/.test(t)) return "war";
    return "sport";
  }

  // Conflict zones
  if(/\b(gaza|rafah|khan younis|hamas|palestin|netanyahu|tel aviv|jerusalem|idf|hebron|jenin|nablus|ramallah|west bank)\b/.test(t)) return "gaza";
  if(/\b(lebanon|lebanese|beirut|hezbollah|nasrallah|hizbullah|sidon|tripoli|tyre)\b/.test(t)) return "lebanon";
  if(/\b(iran|iranian|tehran|irgc|khamenei|persian gulf|pezeshkian)\b/.test(t)) return "iran";
  if(/\b(syria|syrian|damascus|assad|idlib|aleppo|homs|raqqa|sharaa)\b/.test(t)) return "syria";
  if(/\b(yemen|yemeni|houthi|sanaa|aden|taiz|hodeidah)\b/.test(t)) return "yemen";
  if(/\b(ukraine|ukrainian|kyiv|kiev|zelensky|kharkiv|odesa|donbas|crimea|donetsk|luhansk|mariupol|putin|kremlin|moscow|russia)\b/.test(t)) return "ukraine";
  if(/\b(sudan|sudanese|khartoum|darfur|rsf|omdurman)\b/.test(t)) return "sudan";
  if(/\b(morocco|moroccan|maroc|rabat|casablanca|marrakech|agadir|fes|tanger|western sahara|sahara)\b/.test(t)) return "maroc";

  // Algemene oorlog
  if(/\b(airstrike|air strike|missile|invasion|invaded|ceasefire|cease-fire|military|soldier|troops|combat|offensive|bombing|shelling|artillery|tank|drone strike|hostage|massacre|war crime)\b/.test(t)) return "war";

  return fallback || "algemeen";
}

/* ===== SCORE ===== */
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

/* ===== DEDUPE ===== */
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
      map.set(key, copy);
    } else {
      var e = map.get(key);
      if(e.sources.indexOf(it.source) < 0) e.sources.push(it.source);
    }
  });
  return Array.from(map.values());
}

/* ===== LOAD FEEDS ===== */
async function loadAllFeeds(){
  var session = ++State.loadSession;
  var active = FEEDS.filter(function(f){ return !State.disabled[f.n]; });
  State.totalSources = active.length;
  State.failedSources = [];

  var collected = [];
  var collectedLinks = {};
  var tried = 0;
  var bar = document.getElementById("progressBar");
  bar.classList.add("show");
  bar.style.width = "10%";

  async function processOne(f){
    if(session !== State.loadSession) return;
    tried++;
    try{
      var ctrl = new AbortController();
      var timer = setTimeout(function(){ ctrl.abort(); }, CONFIG.fetchTimeoutMs);
      var r = await fetch(CONFIG.proxy + encodeURIComponent(f.url), {signal: ctrl.signal});
      clearTimeout(timer);
      if(!r.ok) throw new Error("HTTP " + r.status);
      var data = await r.json();
      if(!data.items || !data.items.length) throw new Error("leeg");

      data.items.slice(0, CONFIG.perFeed).forEach(function(it){
        var raw = it.description || it.content || "";
        var img = it.thumbnail || (it.enclosure && it.enclosure.link) || (raw.match(/<img[^>]+src="([^"]+)"/i) || [])[1] || "";
        var titleClean = strip(it.title || "");
        var descClean = strip(raw).slice(0, 300);
        var key = (it.link || it.title || "").toLowerCase().trim();
        if(key && !collectedLinks[key]){
          collectedLinks[key] = 1;
          collected.push({
            title: titleClean,
            link: it.link || "#",
            desc: descClean,
            img: img,
            date: it.pubDate || "",
            source: f.n,
            cat: detectTopic(titleClean, descClean, f.cat),
            lang: f.lang
          });
        }
      });

      State.loadedSources++;
      if(State.health[f.n]) State.health[f.n].fails = 0;

      if(session === State.loadSession){
        document.getElementById("statSources").textContent =
          State.loadedSources + "/" + State.totalSources;
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

    if(session === State.loadSession){
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

  if(session !== State.loadSession) return;

  var deduped = dedupe(collected);
  State.items = deduped.sort(function(a, b){ return tm(b.date) - tm(a.date); });

  document.getElementById("statSources").textContent = State.loadedSources + "/" + State.totalSources;
  document.getElementById("statItems").textContent = State.items.length;
  document.getElementById("statWar").textContent = State.items.filter(function(x){ return x.cat === "war"; }).length;

  NewsDB.saveItems(State.items);
  NewsDB.saveHealth(State.health);

  bar.style.width = "100%";
  setTimeout(function(){ bar.classList.remove("show"); bar.style.width = "0%"; }, 400);

  detectBreaking();
  renderNews();
}

/* ===== BREAKING ===== */
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

  document.getElementById("breakingCount").textContent = g.sources.length;
  document.getElementById("breakingTitle").textContent = g.items[0].title.slice(0, 180);
  document.getElementById("breakingMeta").textContent = g.sources.slice(0, 4).join(" · ");

  var banner = document.getElementById("breakingBanner");
  banner.classList.add("show");
  clearTimeout(banner._timer);
  banner._timer = setTimeout(function(){ banner.classList.remove("show"); }, 30000);
}

/* ===== FILTER + RENDER ===== */
function filterItems(){
  var list = State.items.slice();

  if(State.currentCat !== "all"){
    var cats = CAT_GROUPS[State.currentCat] || [State.currentCat];
    list = list.filter(function(it){ return cats.indexOf(it.cat) >= 0; });
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
    sport: "Sport"
  };
  title.textContent = titles[State.currentCat] || "Laatste berichten";
  count.textContent = list.length + " artikelen";

  if(!list.length){
    // Onderscheid tussen "nog aan het laden" en "echt geen artikelen"
    if(State.items.length === 0){
      grid.innerHTML = '<div class="empty-state">' +
        '<div class="empty-icon">◌</div>' +
        '<div class="empty-msg">Nieuws wordt geladen...</div>' +
        '<div class="empty-hint">Eerste keer kan 20-30 seconden duren</div>' +
        '</div>';
    } else {
      grid.innerHTML = '<div class="empty-state">' +
        '<div class="empty-icon">◌</div>' +
        '<div class="empty-msg">Geen artikelen in deze categorie</div>' +
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

  // Handlers
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

/* ===== AUTO REFRESH ===== */
function startAutoRefresh(){
  clearInterval(State.refreshTimer);
  State.refreshTimer = setInterval(function(){
    var idle = Date.now() - State.lastActivity;
    var atTop = window.scrollY < 200;
    if(idle < CONFIG.pauseOnScrollMs && !atTop) return;
    if(State.isScrolling) return;
    loadAllFeeds();
  }, CONFIG.autoRefreshMs);
}

/* ===== INIT ===== */
async function initNews(){
  await NewsDB.open();

  State.health = await NewsDB.loadHealth();
  State.disabled = {};
  Object.keys(State.health).forEach(function(n){
    var h = State.health[n];
    if(h.fails >= CONFIG.failThreshold && Date.now() - h.last < CONFIG.retryAfterMs){
      State.disabled[n] = true;
    }
  });

  State.readMap = await NewsDB.loadReadMap();

  var cached = await NewsDB.loadItems();
  if(cached.length){
    State.items = cached;
    document.getElementById("statItems").textContent = cached.length;
    renderNews();
  }

  await loadAllFeeds();
  startAutoRefresh();

  window.addEventListener("scroll", function(){
    State.lastActivity = Date.now();
    State.isScrolling = true;
    clearTimeout(State.scrollTimer);
    State.scrollTimer = setTimeout(function(){ State.isScrolling = false; }, 1500);
  }, {passive: true});

  ["touchstart", "mousedown", "keydown", "click"].forEach(function(ev){
    window.addEventListener(ev, function(){ State.lastActivity = Date.now(); }, {passive: true});
  });
}

/* ===== API ===== */
window.NewsAPI = {
  init: initNews,
  reload: loadAllFeeds,
  setCat: function(cat){ State.currentCat = cat; renderNews(); },
  setSort: function(s){ State.currentSort = s; renderNews(); },
  setSearch: function(s){ State.currentSearch = s.toLowerCase().trim(); renderNews(); },
  setView: function(v){ State.viewMode = v; renderNews(); },
  render: renderNews
};

console.log("[WAR DESK] news.js geladen");