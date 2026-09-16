/* ============================================================
   WAR DESK v19.0 — Nieuws logica
   ============================================================ */

/* ===== STATE ===== */
window.NewsState = {
  items: [],             // alle artikelen
  filtered: [],          // na categorie/zoek filter
  currentCat: "all",
  currentSort: "importance",  // of "newest"
  currentSearch: "",
  loadedSources: 0,
  totalSources: 0,
  failedSources: [],
  lastActivity: Date.now(),
  isScrolling: false,
  scrollTimer: null,
  refreshTimer: null,
  viewMode: "cards",     // "cards" of "list"
  breakingShownAt: 0,
  breakingCooldown: 1800000,  // 30 min
  lastBreakingItem: null
};

/* ===== INDEXEDDB ===== */
const NewsDB = (() => {
  let db = null;
  const DB_NAME = "wardesk_news_v1";
  const DB_VERSION = 1;
  const STORE_ITEMS = "items";
  const STORE_META = "meta";

  function open() {
    return new Promise(resolve => {
      if (!("indexedDB" in window)) { resolve(null); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(STORE_ITEMS)) d.createObjectStore(STORE_ITEMS, {keyPath: "link"});
        if (!d.objectStoreNames.contains(STORE_META)) d.createObjectStore(STORE_META, {keyPath: "k"});
      };
      req.onsuccess = e => { db = e.target.result; resolve(db); };
      req.onerror = () => resolve(null);
    });
  }

  function put(store, value) {
    if (!db) return Promise.resolve(false);
    return new Promise(res => {
      try {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).put(value);
        tx.oncomplete = () => res(true);
        tx.onerror = () => res(false);
      } catch (e) { res(false); }
    });
  }

  function get(store, key) {
    if (!db) return Promise.resolve(null);
    return new Promise(res => {
      try {
        const tx = db.transaction(store, "readonly");
        const r = tx.objectStore(store).get(key);
        r.onsuccess = () => res(r.result || null);
        r.onerror = () => res(null);
      } catch (e) { res(null); }
    });
  }

  function getAll(store) {
    if (!db) return Promise.resolve([]);
    return new Promise(res => {
      try {
        const tx = db.transaction(store, "readonly");
        const r = tx.objectStore(store).getAll();
        r.onsuccess = () => res(r.result || []);
        r.onerror = () => res([]);
      } catch (e) { res([]); }
    });
  }

  function clear(store) {
    if (!db) return Promise.resolve(false);
    return new Promise(res => {
      try {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).clear();
        tx.oncomplete = () => res(true);
        tx.onerror = () => res(false);
      } catch (e) { res(false); }
    });
  }

  return {
    open,
    saveItems: async (items) => {
      // Bewaar alleen laatste N items (compressie)
      const toSave = items.slice(0, CONFIG.maxCacheItems);
      try {
        const tx = db.transaction(STORE_ITEMS, "readwrite");
        const store = tx.objectStore(STORE_ITEMS);
        store.clear();
        toSave.forEach(it => {
          store.put({
            link: it.link,
            title: it.title,
            desc: it.desc,
            img: it.img,
            date: it.date,
            source: it.source,
            cat: it.cat,
            lang: it.lang,
            sources: it.sources
          });
        });
      } catch (e) {}
    },
    loadItems: async () => {
      const items = await getAll(STORE_ITEMS);
      return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },
    saveRead: (link) => put(STORE_META, {k: "read_" + link, v: Date.now()}),
    loadReadMap: async () => {
      const all = await getAll(STORE_META);
      const map = {};
      all.forEach(rec => {
        if (rec.k && rec.k.startsWith("read_")) {
          map[rec.k.slice(5)] = rec.v;
        }
      });
      return map;
    },
    saveHealth: (health) => put(STORE_META, {k: "health", v: health}),
    loadHealth: async () => {
      const rec = await get(STORE_META, "health");
      return rec && rec.v ? rec.v : {};
    },
    saveFavs: (favs) => put(STORE_META, {k: "favs", v: [...favs]}),
    loadFavs: async () => {
      const rec = await get(STORE_META, "favs");
      return rec && Array.isArray(rec.v) ? new Set(rec.v) : new Set();
    }
  };
})();

/* ===== HELPERS ===== */
function newsEscape(s) {
  return (s || "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function newsStrip(s) {
  return (s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function newsTime(d) {
  const t = new Date(d).getTime();
  return isNaN(t) ? 0 : t;
}
function newsAgo(d) {
  const t = newsTime(d);
  if (!t) return "";
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return "nu";
  if (diff < 3600) return Math.floor(diff / 60) + "m";
  if (diff < 86400) return Math.floor(diff / 3600) + "u";
  return Math.floor(diff / 86400) + "d";
}
function newsReadTime(text) {
  return Math.max(1, Math.round((text || "").split(/\s+/).length / 200));
}

/* ===== IMPORTANCE SCORE ===== */
function scoreArticle(it) {
  let score = 0;
  const sources = (it.sources || [it.source]).length;
  score += sources * 12;

  const t = (it.title + " " + (it.desc || "")).toLowerCase();
  for (const kw of KEYWORDS_HIGH) if (t.includes(kw)) score += 6;
  for (const kw of KEYWORDS_MED)  if (t.includes(kw)) score += 3;

  if (HIGH_PRIORITY.includes(it.source)) score += 15;

  const ageMin = Math.max(0, (Date.now() - newsTime(it.date)) / 60000);
  score += Math.max(0, 40 - ageMin / 2);

  return score;
}

/* ===== DEDUPE ===== */
function titleKey(title) {
  return (title || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 8)
    .sort()
    .join(" ");
}

function dedupe(items) {
  const map = new Map();
  items.forEach(it => {
    const key = titleKey(it.title);
    if (!key) { map.set("__" + Math.random(), it); return; }
    if (!map.has(key)) {
      map.set(key, { ...it, sources: [it.source] });
    } else {
      const e = map.get(key);
      if (!e.sources.includes(it.source)) e.sources.push(it.source);
    }
  });
  return Array.from(map.values());
}

/* ===== TOPIC DETECTION ===== */
function detectTopic(title, desc, fallback) {
  const t = (title + " " + desc).toLowerCase();
  if (/\b(gaza|rafah|hamas|palestin|netanyahu|tel aviv|jerusalem|idf)\b/.test(t)) return "gaza";
  if (/\b(lebanon|beirut|hezbollah|nasrallah)\b/.test(t)) return "lebanon";
  if (/\b(iran|tehran|irgc|khamenei)\b/.test(t)) return "iran";
  if (/\b(syria|damascus|assad|idlib)\b/.test(t)) return "syria";
  if (/\b(yemen|houthi|sanaa|aden)\b/.test(t)) return "yemen";
  if (/\b(ukraine|kyiv|zelensky|kharkiv|donbas|crimea|putin|moscow)\b/.test(t)) return "ukraine";
  if (/\b(sudan|khartoum|darfur|rsf)\b/.test(t)) return "sudan";
  if (/\b(morocco|moroccan|maroc|rabat|casablanca)\b/.test(t)) return "maroc";
  if (/\b(war|conflict|strike|attack|shelling|airstrike|ceasefire|invasion|military)\b/.test(t)) return "war";
  return fallback || "algemeen";
}

/* ===== TRANSLATE (lazy, alleen titels) ===== */
const TranslateCache = new Map();

async function translateTitle(text) {
  if (!text) return "";
  const cached = TranslateCache.get(text);
  if (cached) return cached;
  try {
    const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=nl&dt=t&q=" + encodeURIComponent(text.slice(0, 200));
    const r = await fetch(url);
    if (!r.ok) throw new Error();
    const data = await r.json();
    if (Array.isArray(data?.[0])) {
      const out = data[0].map(x => x[0] || "").join("");
      TranslateCache.set(text, out);
      return out;
    }
  } catch (e) {}
  return text;
}

/* ===== LOAD FEEDS ===== */
async function loadAllFeeds() {
  const session = ++NewsState.loadSession || (NewsState.loadSession = 1);
  const active = FEEDS.filter(f => !NewsState.disabled || !NewsState.disabled.has(f.n));
  NewsState.totalSources = active.length;
  NewsState.loadedSources = 0;
  NewsState.failedSources = [];

  const collected = [];
  const collectedLinks = new Set();
  let tried = 0;

  const processOne = async (f) => {
    tried++;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(CONFIG.proxy + encodeURIComponent(f.url), {signal: ctrl.signal});
      clearTimeout(timer);
      if (!r.ok) throw new Error("HTTP " + r.status);
      const data = await r.json();
      if (!data.items || !data.items.length) throw new Error("leeg");

      data.items.slice(0, CONFIG.perFeed).forEach(it => {
        const raw = it.description || it.content || "";
        const img = it.thumbnail || it.enclosure?.link || (raw.match(/<img[^>]+src="([^"]+)"/i)?.[1]) || "";
        const titleClean = newsStrip(it.title || "");
        const descClean = newsStrip(raw).slice(0, 300);
        const key = (it.link || it.title || "").toLowerCase().trim();
        if (key && !collectedLinks.has(key)) {
          collectedLinks.add(key);
          collected.push({
            title: titleClean,
            link: it.link || "#",
            desc: descClean,
            img,
            date: it.pubDate || "",
            source: f.n,
            cat: detectTopic(titleClean, descClean, f.cat),
            lang: f.lang
          });
        }
      });
      NewsState.loadedSources++;
      // Health: reset fails
      if (NewsState.health[f.n]) NewsState.health[f.n].fails = 0;
    } catch (e) {
      NewsState.failedSources.push(f.n);
      // Health: increment fails
      if (!NewsState.health[f.n]) NewsState.health[f.n] = {fails: 0, last: 0};
      NewsState.health[f.n].fails++;
      NewsState.health[f.n].last = Date.now();
      if (NewsState.health[f.n].fails >= CONFIG.failThreshold) {
        if (!NewsState.disabled) NewsState.disabled = new Set();
        NewsState.disabled.add(f.n);
      }
    }
    // Progress
    const bar = document.getElementById("progressBar");
    if (bar) {
      bar.classList.add("show");
      bar.style.width = (10 + Math.round((tried / active.length) * 85)) + "%";
    }
  };

  // Parallel, max 10 tegelijk
  const queue = [...active];
  const workers = Array.from({length: 10}, async () => {
    while (queue.length) {
      const f = queue.shift();
      if (f) await processOne(f);
    }
  });
  await Promise.all(workers);

  // Dedupe en sorteer
  const deduped = dedupe(collected);
  NewsState.items = deduped.sort((a, b) => newsTime(b.date) - newsTime(a.date));

  // Stats bijwerken
  document.getElementById("statSources").textContent = NewsState.loadedSources + "/" + NewsState.totalSources;
  document.getElementById("statItems").textContent = NewsState.items.length;
  document.getElementById("statWar").textContent = NewsState.items.filter(x => x.cat === "war").length;

  // Opslaan in IndexedDB
  await NewsDB.saveItems(NewsState.items);
  await NewsDB.saveHealth(NewsState.health);

  // Progress afronden
  const bar = document.getElementById("progressBar");
  if (bar) {
    bar.style.width = "100%";
    setTimeout(() => { bar.classList.remove("show"); bar.style.width = "0%"; }, 400);
  }

  // Detecteer breaking
  detectBreaking();

  // Render
  renderNews();
}

/* ===== BREAKING DETECTION ===== */
function detectBreaking() {
  if (Date.now() - NewsState.breakingShownAt < NewsState.breakingCooldown) return;

  const now = Date.now();
  const recent = NewsState.items
    .filter(it => {
      const age = now - newsTime(it.date);
      return age && age < 900000; // 15 min
    })
    .slice(0, 40);

  if (recent.length < 3) return;

  // Groepeer op gedeelde keywords
  const groups = [];
  const used = new Set();

  recent.forEach((a, i) => {
    if (used.has(i)) return;
    const group = { items: [a], sources: new Set([a.source]) };
    used.add(i);
    const aText = (a.title + " " + a.desc).toLowerCase();
    const aKw = KEYWORDS_HIGH.filter(k => aText.includes(k));

    recent.forEach((b, j) => {
      if (used.has(j) || i === j) return;
      const bText = (b.title + " " + b.desc).toLowerCase();
      const shared = aKw.filter(k => bText.includes(k));
      if (shared.length >= 2) {
        group.items.push(b);
        group.sources.add(b.source);
        used.add(j);
      }
    });

    if (group.sources.size >= 3) groups.push(group);
  });

  if (!groups.length) return;
  groups.sort((a, b) => b.sources.size - a.sources.size);

  showBreakingBanner(groups[0]);
}

function showBreakingBanner(group) {
  const banner = document.getElementById("breakingBanner");
  if (!banner) return;
  const item = group.items[0];
  NewsState.breakingShownAt = Date.now();
  NewsState.lastBreakingItem = item;

  document.getElementById("breakingCount").textContent = group.sources.size;
  document.getElementById("breakingTitle").textContent = item.title.slice(0, 180);
  document.getElementById("breakingMeta").textContent = [...group.sources].slice(0, 4).join(" · ");

  banner.classList.add("show");
  clearTimeout(banner._timer);
  banner._timer = setTimeout(() => banner.classList.remove("show"), 30000);
}

/* ===== RENDER ===== */
function filterItems() {
  let list = NewsState.items.slice();

  // Categorie filter
  if (NewsState.currentCat !== "all") {
    const cats = CAT_GROUPS[NewsState.currentCat] || [NewsState.currentCat];
    list = list.filter(it => cats.includes(it.cat));
  }

  // Zoek filter
  if (NewsState.currentSearch) {
    const q = NewsState.currentSearch;
    list = list.filter(it =>
      (it.title + " " + it.desc + " " + it.source).toLowerCase().includes(q)
    );
  }

  // Sortering
  if (NewsState.currentSort === "importance") {
    list.forEach(it => { if (it._score === undefined) it._score = scoreArticle(it); });
    list.sort((a, b) => b._score - a._score);
  } else {
    list.sort((a, b) => newsTime(b.date) - newsTime(a.date));
  }

  NewsState.filtered = list;
  return list;
}

function renderNews() {
  const list = filterItems();
  const grid = document.getElementById("feedGrid");
  const title = document.getElementById("newsTitle");
  const count = document.getElementById("newsCount");

  const titles = {
    all: "Laatste berichten",
    war: "Oorlog & conflict",
    mideast: "Midden-Oosten",
    europe: "Europa",
    nl: "Nederland",
    sport: "Sport"
  };
  title.textContent = titles[NewsState.currentCat] || "Laatste berichten";
  count.textContent = list.length + " artikelen";

  if (!list.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">◌</div>
        <div class="empty-msg">Geen artikelen</div>
        <div class="empty-hint">Probeer een andere categorie of zoekterm</div>
      </div>`;
    return;
  }

  const toShow = list.slice(0, 100);
  grid.classList.toggle("list-mode", NewsState.viewMode === "list");

  grid.innerHTML = toShow.map((it, i) => renderCard(it, i)).join("");

  // Event handlers
  grid.querySelectorAll("article").forEach((art, i) => {
    const it = toShow[i];
    if (!it) return;

    // Klik op artikel → openen
    art.addEventListener("click", (e) => {
      if (e.target.closest(".card-action")) return;
      markAsRead(it.link);
      art.classList.add("read");
      window.open(it.link, "_blank", "noopener");
    });

    // Deel-knop
    const shareBtn = art.querySelector(".card-share");
    if (shareBtn) {
      shareBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (navigator.share) {
          navigator.share({ title: it.title, url: it.link }).catch(() => {});
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(it.link).then(() => {
            if (window.showToast) window.showToast("Link gekopieerd");
          });
        }
      });
    }

    // Multi-bron badge
    const multiBtn = art.querySelector(".card-multi");
    if (multiBtn) {
      multiBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (window.showToast) window.showToast(it.sources.join(", "));
      });
    }

    // Lazy translate voor buitenlandse artikelen
    if (it.lang !== "nl" && it.lang !== "en") {
      lazyTranslate(art, it);
    } else if (it.lang === "en") {
      lazyTranslate(art, it);
    }
  });

  // Lazy translation observer
  if (NewsState.observer) NewsState.observer.disconnect();
  if ("IntersectionObserver" in window) {
    NewsState.observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const art = e.target;
          const idx = parseInt(art.dataset.idx, 10);
          const it = toShow[idx];
          if (it) doTranslate(art, it);
          NewsState.observer.unobserve(art);
        }
      });
    }, {rootMargin: "200px"});
    grid.querySelectorAll("article").forEach(art => NewsState.observer.observe(art));
  }
}

function renderCard(it, i) {
  const rtl = it.lang === "ar" || /[\u0600-\u06FF]/.test(it.title);
  const isRead = NewsState.readMap && NewsState.readMap[it.link];
  const sources = it.sources || [it.source];
  const multiSrc = sources.length > 1;
  const mins = newsReadTime(it.desc);

  return `
    <article class="news-card ${it.cat === "war" ? "war" : ""} ${isRead ? "read" : ""}" data-idx="${i}">
      ${it.img ? `<div class="card-thumb"><img src="${newsEscape(it.img)}" loading="lazy" onerror="this.parentNode.remove()"></div>` : ''}
      <div class="card-body">
        <div class="card-meta">
          <span class="card-source">${newsEscape(it.source)}</span>
          <span class="card-sep">·</span>
          <span>${newsAgo(it.date)}</span>
          ${multiSrc ? `<span class="card-multi" title="${newsEscape(sources.join(', '))}">${sources.length}× bronnen</span>` : ''}
        </div>
        <h3 class="card-title" data-title="${newsEscape(it.title)}" dir="${rtl ? 'rtl' : 'ltr'}">${newsEscape(it.title)}</h3>
        ${it.desc ? `<p class="card-desc" dir="${rtl ? 'rtl' : 'ltr'}">${newsEscape(it.desc)}</p>` : ''}
        <div class="card-footer">
          <span>${mins} min lezen</span>
          <button class="card-action card-share" aria-label="Delen">⇗</button>
        </div>
      </div>
    </article>
  `;
}

/* ===== LAZY TRANSLATE ===== */
function lazyTranslate(art, it) {
  art.dataset.needsTranslate = "1";
}
async function doTranslate(art, it) {
  if (art.dataset.translated) return;
  art.dataset.translated = "1";
  const titleEl = art.querySelector(".card-title");
  if (!titleEl) return;
  const original = titleEl.textContent;
  const translated = await translateTitle(original);
  if (translated && translated !== original) {
    titleEl.textContent = translated;
    titleEl.dataset.original = original;
  }
}

/* ===== READ MARKING ===== */
function markAsRead(link) {
  if (!link) return;
  if (!NewsState.readMap) NewsState.readMap = {};
  NewsState.readMap[link] = Date.now();
  NewsDB.saveRead(link);
}

/* ===== AUTO REFRESH ===== */
function startAutoRefresh() {
  clearInterval(NewsState.refreshTimer);
  NewsState.refreshTimer = setInterval(() => {
    const idle = Date.now() - NewsState.lastActivity;
    const atTop = window.scrollY < 200;
    if (idle < CONFIG.pauseOnScrollMs && !atTop) return;
    if (NewsState.isScrolling) return;
    loadAllFeeds();
  }, CONFIG.autoRefreshMs);
}

/* ===== INIT ===== */
async function initNews() {
  await NewsDB.open();

  // Laad opgeslagen data
  NewsState.health = await NewsDB.loadHealth();
  NewsState.disabled = new Set();
  Object.keys(NewsState.health).forEach(n => {
    const h = NewsState.health[n];
    if (h.fails >= CONFIG.failThreshold && Date.now() - h.last < CONFIG.retryAfterMs) {
      NewsState.disabled.add(n);
    }
  });

  NewsState.readMap = await NewsDB.loadReadMap();

  // Probeer cache eerst
  const cached = await NewsDB.loadItems();
  if (cached.length) {
    NewsState.items = cached;
    document.getElementById("statItems").textContent = cached.length;
    renderNews();
  }

  // Dan live laden
  await loadAllFeeds();

  // Auto-refresh starten
  startAutoRefresh();

  // Activity tracking
  window.addEventListener("scroll", () => {
    NewsState.lastActivity = Date.now();
    NewsState.isScrolling = true;
    clearTimeout(NewsState.scrollTimer);
    NewsState.scrollTimer = setTimeout(() => { NewsState.isScrolling = false; }, 1500);
  }, {passive: true});
  ["touchstart", "mousedown", "keydown", "click"].forEach(ev =>
    window.addEventListener(ev, () => { NewsState.lastActivity = Date.now(); }, {passive: true})
  );
}

window.NewsAPI = {
  init: initNews,
  reload: loadAllFeeds,
  setCat: (cat) => { NewsState.currentCat = cat; renderNews(); },
  setSort: (s) => { NewsState.currentSort = s; renderNews(); },
  setSearch: (s) => { NewsState.currentSearch = s.toLowerCase().trim(); renderNews(); },
  setView: (v) => { NewsState.viewMode = v; renderNews(); },
  render: renderNews,
  state: NewsState
};