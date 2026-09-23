/* ============================================================
   WAR DESK v27.4 — Nieuws Logica
   - FIX v27.3: wdLog + WDStorage
   - FIX v27.4: dead code weg (B7), tag-versie fix (B12), state fallback (B5)
   ============================================================ */

(function(){
  "use strict";

  window.__newsVersion = "v27.4";
  const MYMEMORY_EMAIL = "";
  const $ = (id) => document.getElementById(id);

  const state = window.appStore ? window.appStore.state : window.State;
  if (!state) {
    try { console.error("[WAR DESK] news-v27.js: State ontbreekt — kan niet starten"); } catch(e){}
    return;
  }

  const tm = (d) => { const x = new Date(d); return isNaN(x) ? 0 : x.getTime(); };
  const ago = (d) => {
    const t = tm(d); if(!t) return "";
    const diff = (Date.now() - t) / 1000;
    if(diff < 60) return "nu";
    if(diff < 3600) return Math.floor(diff / 60) + "m";
    if(diff < 86400) return Math.floor(diff / 3600) + "u";
    return Math.floor(diff / 86400) + "d";
  };
  const rtime = (t) => Math.max(1, Math.round((t || "").split(/\s+/).length / 200));
  const strip = (s) => (s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

  const emitProgress = (pct, done) => {
    try{
      document.dispatchEvent(new CustomEvent("wardesk:feedprogress", {
        detail: { pct: Math.max(0, Math.min(100, Math.round(pct))), done: !!done }
      }));
    }catch(e){}
  };

  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
        }
        observer.unobserve(img);
      }
    });
  }, { rootMargin: '200px 0px', threshold: 0.01 });

  // ==================== INDEXEDDB ====================
  const NewsDB = (function(){
    let db = null;
    const DB_NAME = "wardesk_v19_news";
    const DB_VERSION = 2;

    function open(){
      return new Promise(resolve => {
        try{
          if(!("indexedDB" in window)){ resolve(null); return; }
          const req = indexedDB.open(DB_NAME, DB_VERSION);
          req.onupgradeneeded = e => {
            const d = e.target.result;
            if(!d.objectStoreNames.contains("items")) d.createObjectStore("items", {keyPath:"link"});
            if(!d.objectStoreNames.contains("meta")) d.createObjectStore("meta", {keyPath:"k"});
            if(!d.objectStoreNames.contains("translations")) d.createObjectStore("translations", {keyPath:"k"});
          };
          req.onsuccess = e => { db = e.target.result; resolve(db); };
          req.onerror = () => resolve(null);
        }catch(e){ resolve(null); }
      });
    }
    function put(store, value){
      if(!db) return Promise.resolve(false);
      return new Promise(res => {
        try{
          const tx = db.transaction(store, "readwrite");
          tx.objectStore(store).put(value);
          tx.oncomplete = () => res(true);
          tx.onerror = () => res(false);
        }catch(e){ res(false); }
      });
    }
    function del(store, key){
      if(!db) return Promise.resolve(false);
      return new Promise(res => {
        try{
          const tx = db.transaction(store, "readwrite");
          tx.objectStore(store).delete(key);
          tx.oncomplete = () => res(true);
          tx.onerror = () => res(false);
        }catch(e){ res(false); }
      });
    }
    function get(store, key){
      if(!db) return Promise.resolve(null);
      return new Promise(res => {
        try{
          const tx = db.transaction(store, "readonly");
          const r = tx.objectStore(store).get(key);
          r.onsuccess = () => res(r.result || null);
          r.onerror = () => res(null);
        }catch(e){ res(null); }
      });
    }
    function getAll(store){
      if(!db) return Promise.resolve([]);
      return new Promise(res => {
        try{
          const tx = db.transaction(store, "readonly");
          const r = tx.objectStore(store).getAll();
          r.onsuccess = () => res(r.result || []);
          r.onerror = () => res([]);
        }catch(e){ res([]); }
      });
    }
    function getAllKeys(store){
      if(!db) return Promise.resolve([]);
      return new Promise(res => {
        try{
          const tx = db.transaction(store, "readonly");
          const r = tx.objectStore(store).getAllKeys();
          r.onsuccess = () => res(r.result || []);
          r.onerror = () => res([]);
        }catch(e){ res([]); }
      });
    }
    async function saveItems(items){
      if(!db) return;
      const max = window.CONFIG?.maxCacheItems ?? 3000;
      const topItems = items.slice(0, max);

      const wantedLinks = new Set(topItems.map(it => it.link).filter(Boolean));
      const existingKeys = await getAllKeys("items");
      const existingSet = new Set(existingKeys);

      return new Promise(res => {
        try{
          const tx = db.transaction("items", "readwrite");
          const store = tx.objectStore("items");
          for(const key of existingKeys){
            if(!wantedLinks.has(key)) store.delete(key);
          }
          for(const it of topItems){
            if(!existingSet.has(it.link)){
              store.put({
                link: it.link, title: it.title, desc: it.desc, img: it.img,
                date: it.date, source: it.source, cat: it.cat, lang: it.lang,
                sources: it.sources, tags: it.tags || []
              });
            }
          }
          tx.oncomplete = () => res();
          tx.onerror = () => res();
        }catch(e){ res(); }
      });
    }

    // B12: herbereken tags voor alle items zonder ze te wissen
    async function retagAll(extractFn){
      if(!db) return 0;
      const all = await getAll("items");
      if(!all.length) return 0;
      return new Promise(res => {
        try{
          const tx = db.transaction("items", "readwrite");
          const store = tx.objectStore("items");
          let count = 0;
          all.forEach(it => {
            try{
              it.tags = extractFn(it.title || "", it.desc || "", it.cat || "");
              store.put(it);
              count++;
            }catch(e){}
          });
          tx.oncomplete = () => res(count);
          tx.onerror = () => res(0);
        }catch(e){ res(0); }
      });
    }

    function pruneOldReads(){
      if(!db) return Promise.resolve(false);
      return new Promise(res => {
        try{
          const cutoffRead = Date.now() - 90 * 86400000;
          const cutoffFav = Date.now() - 365 * 86400000;
          const tx = db.transaction("meta", "readwrite");
          const store = tx.objectStore("meta");
          const req = store.openCursor();
          req.onsuccess = e => {
            const cur = e.target.result;
            if(!cur) return;
            const rec = cur.value;
            const k = rec?.k || "";
            const v = rec?.v || 0;
            if(k.indexOf("read_") === 0 && v < cutoffRead){ cur.delete(); }
            else if(k.indexOf("fav_") === 0 && v < cutoffFav){ cur.delete(); }
            cur.continue();
          };
          tx.oncomplete = () => res(true);
          tx.onerror = () => res(false);
        }catch(e){ res(false); }
      });
    }
    return {
      open, put, del, get, getAll, getAllKeys, saveItems, retagAll, pruneOldReads,
      loadItems: () => getAll("items").then(items => items.sort((a,b) => tm(b.date) - tm(a.date))),
      saveRead: (link) => put("meta", {k:"read_" + link, v: Date.now()}),
      loadReadMap: () => getAll("meta").then(all => {
        const map = {};
        all.forEach(rec => { if(rec.k?.indexOf("read_") === 0) map[rec.k.slice(5)] = rec.v; });
        return map;
      }),
      saveHealth: (health) => put("meta", {k:"health", v: health}),
      saveTranslation: (key, value) => put("translations", {k: key, v: value, t: Date.now()}),
      loadTranslation: (key) => get("translations", key).then(rec => rec?.v || null),
      saveFavorite: (link) => put("meta", {k:"fav_" + link, v: Date.now()}),
      removeFavorite: (link) => del("meta", "fav_" + link),
      loadFavorites: () => getAll("meta").then(all => {
        const map = {};
        all.forEach(rec => { if(rec.k?.indexOf("fav_") === 0) map[rec.k.slice(4)] = rec.v; });
        return map;
      })
    };
  })();

  // ==================== TAGS & SCORING ====================
  function extractTags(title, desc, sourceCat){
    const tags = [];
    const t = ((title || "") + " " + (desc || "")).toLowerCase();

    if(sourceCat === "nl") tags.push("nl");
    if(["be","de","fr","it","uk"].includes(sourceCat)) tags.push("europe");
    if(sourceCat === "us") tags.push("vs");
    if(sourceCat === "maroc") tags.push("maroc");
    if(["eg","sa","ae","qa","il","mideast"].includes(sourceCat)) tags.push("mideast");
    if(["ukraine","gaza","yemen","iran","sudan","war"].includes(sourceCat)) tags.push("war");
    if(sourceCat === "sport") tags.push("sport");

    const sportStrong = /\b(eredivisie|eerste divisie|knvb|johan cruijff schaal|champions league|europa league|conference league|wk voetbal|ek voetbal|formule 1|grand prix|motogp|tour de france|giro d'italia|vuelta|wimbledon|roland garros|us open tennis|australian open|olympische spelen|glory kickboxing|ufc|nba|nfl|nhl|mlb)\b/.test(t);
    const sportTeam = /\b(ajax|psv|feyenoord|az alkmaar|fc utrecht|fc twente|vitesse|sc heerenveen|sparta rotterdam|willem ii|go ahead eagles|pec zwolle|rkc waalwijk|fortuna sittard|excelsior|almere city|heracles|n\.e\.c\.|real madrid|barcelona|atletico madrid|manchester united|manchester city|liverpool|chelsea|arsenal|tottenham|juventus|inter milan|ac milan|bayern münchen|borussia dortmund|paris saint-germain|psg)\b/.test(t);
    const warBlock = /\b(airstrike|raketaanval|invasion|invasie|massacre|bloedbad|shelling|beschieting|offensief|oorlog|war)\b/.test(t);
    if((sportStrong || sportTeam) && !warBlock && !tags.includes("sport")) tags.push("sport");

    const mideastContent = /\b(gaza|rafah|khan younis|hamas|hezbollah|idf|netanyahu|westelijke jordaanoever|palestijn|palestinian|israelisch|israeli|iran|irgc|tehran|khamenei|syrië|syria|damascus|assad|libanon|lebanon|beirut|jemen|yemen|houthi|irak|iraq|bagdad|saudi-arabië|riyadh|qatar|doha|aboe dhabi|dubai|jordanië|amman|jeruzalem|jerusalem|tel aviv|beiroet)\b/.test(t);
    if(mideastContent && !tags.includes("mideast")) tags.push("mideast");

    let warScore = 0;
    if(/\b(airstrike|air strike|raketaanval|missile strike|drone strike|luchtaanval|invasion|invaded|invasie|massacre|bloedbad|genocide|ceasefire|staakt-het-vuren|offensive|offensief|bombing|bombardement|shelling|beschieting|artillery|artillerie|war crime|oorlogsmisdaad|chemical attack|gifgasaanval)\b/.test(t)) warScore += 3;
    if(/\b(killed|gedood|doden|slachtoffers|gewonden|troops|troepen|soldiers|soldaat|militairen|military|combat|gevecht|tank|tanks|frontlinie|frontline)\b/.test(t)) warScore += 1;
    if(/\b(oekraïne|ukraine|zelensky|zelenski|kyiv|kiev|kharkiv|odesa|donbas|crimea|donetsk|luhansk|marioepol|mariupol|poetin|putin|kremlin|moskou)\b/.test(t)) warScore += 2;
    if(warScore >= 2 && !tags.includes("war")) tags.push("war");

    const nlContent = /\b(nederland|nederlands|dutch|holland|amsterdam|rotterdam|den haag|the hague|utrecht|eindhoven|groningen|tilburg|almere|breda|nijmegen|haarlem|arnhem|apeldoorn|enschede|amersfoort|zwolle|leeuwarden|maastricht|tweede kamer|eerste kamer|kabinet|minister-president|premier rutte|mark rutte|geert wilders|d66|vvd|cda|pvda|groenlinks|forum voor democratie|sp partij|christenunie|sgr|bbb|nieuw sociaal contract|gemeente|provincie|randstad|noord-holland|zuid-holland|flevoland|gelderland|overijssel|drenthe|friesland|zeeland|limburg|noord-brabant)\b/.test(t);
    if(nlContent && !tags.includes("nl")) tags.push("nl");

    if(/\b(marokko|morocco|maroc|rabat|casablanca|marrakech|agadir|fes|tanger|sahara|marokkaans|marokkaanse)\b/.test(t) && !tags.includes("maroc")){
      tags.push("maroc");
    }

    const europeStrong = /\b(europese unie|european union|europese commissie|european commission|europese parlement|european parliament|brussel|brussels|nato|europese raad|eurozone|schengen|europese centrale bank|europese verkiezing)\b/.test(t);
    const europeCountry = /\b(duitsland|germany|frankrijk|france|spanje|spain|españa|italië|italy|verenigd koninkrijk|united kingdom|engeland|england|polen|poland|oostenrijk|austria|zwitserland|switzerland|zweden|sweden|noorwegen|norway|denemarken|denmark|finland|ierland|ireland|portugal|griekenland|greece|tsjechië|czech|hongarije|hungary|roemenië|romania|bulgarije|bulgaria|belgië|belgium)\b/.test(t);
    if((europeStrong || europeCountry) && !tags.includes("europe") && !tags.includes("nl")){
      tags.push("europe");
    }

    return [...new Set(tags)];
  }

  const ensureTags = (items) => items.map(it => {
    it.tags = extractTags(it.title, it.desc || "", it.cat);
    return it;
  });

  const scoreArticle = (it) => {
    let score = 0;
    const sources = (it.sources || [it.source]).length;
    score += sources * 12;
    const t = (it.title + " " + (it.desc || "")).toLowerCase();
    for(const kw of KEYWORDS_HIGH) if(t.includes(kw)) score += 6;
    for(const kw of KEYWORDS_MED) if(t.includes(kw)) score += 3;
    if(HIGH_PRIORITY.includes(it.source)) score += 15;
    const ageMin = Math.max(0, (Date.now() - tm(it.date)) / 60000);
    score += Math.max(0, 40 - ageMin / 2);
    return score;
  };

  const titleKey = (title) => (title || "").toLowerCase().replace(/[^\w\s]/g, "")
    .split(/\s+/).filter(w => w.length > 3)
    .slice(0, 8).sort().join(" ");
    
  const dedupe = (items) => {
    const map = new Map();
    items.forEach(it => {
      const key = titleKey(it.title);
      if(!key){ map.set("__" + Math.random(), it); return; }
      if(!map.has(key)){
        const copy = {...it};
        copy.sources = [it.source];
        copy.tags = it.tags ? [...it.tags] : [];
        map.set(key, copy);
      } else {
        const e = map.get(key);
        if(!e.sources.includes(it.source)) e.sources.push(it.source);
        if(it.tags){
          it.tags.forEach(t => { if(!e.tags.includes(t)) e.tags.push(t); });
        }
      }
    });
    return Array.from(map.values());
  };

  // ==================== RSS PARSING ====================
  const parseRssXml = (xmlText) => {
    try{
      const doc = new DOMParser().parseFromString(xmlText, "text/xml");
      if(doc.getElementsByTagName("parsererror").length) return [];
      let nodes = doc.getElementsByTagName("item");
      if(!nodes.length) nodes = doc.getElementsByTagName("entry");
      const out = [];
      for(let i = 0; i < nodes.length; i++){
        const node = nodes[i];
        const gtxt = (tag) => {
          const els = node.getElementsByTagName(tag);
          return els.length ? (els[0].textContent || "").trim() : "";
        };
        const title = gtxt("title");
        const linkEl = node.getElementsByTagName("link")[0];
        const link = linkEl ? ((linkEl.textContent || "") || linkEl.getAttribute("href") || "").trim() : "";
        const desc = gtxt("description") || gtxt("content") || gtxt("summary") || gtxt("encoded");
        const date = gtxt("pubDate") || gtxt("published") || gtxt("updated") || gtxt("date");
        const encEl = node.getElementsByTagName("enclosure")[0];
        const encLink = encEl ? (encEl.getAttribute("url") || encEl.getAttribute("href") || "") : "";
        const mediaEl = node.getElementsByTagName("media:content")[0] || node.getElementsByTagName("media:thumbnail")[0];
        const thumb = mediaEl ? (mediaEl.getAttribute("url") || "") : "";
        out.push({ title, link, description: desc, pubDate: date, thumbnail: thumb, enclosure: encLink ? {link: encLink} : null });
      }
      return out;
    }catch(e){ return []; }
  };

  const normalizeItem = (it) => {
    if(it == null) return {title:"", link:"", description:"", pubDate:"", thumbnail:""};
    if(typeof it === "string") return {title: it, link:"", description:"", pubDate:"", thumbnail:""};
    if(typeof it !== "object") return {title: String(it), link:"", description:"", pubDate:"", thumbnail:""};
    if(it.fields) it = {...it, ...it.fields};
    if(it._source) it = {...it, ...it._source};
    const raw = it.description || it.content || it.summary || it["content:encoded"] || it.contentSnippet || "";
    const enc = it.enclosure && (it.enclosure.link || it.enclosure.url);
    let thumb = it.thumbnail || enc || it.image || "";
    if(!thumb && typeof raw === "string"){
      const m = raw.match(/<img[^>]+src=["']([^"']+)["']/i);
      if(m) thumb = m[1];
    }
    const link = it.link || it.url || it.id || (it.guid && (it.guid.$t || it.guid._ || it.guid)) || "";
    return {
      title: String(it.title || it.name || it.headline || ""),
      link: String(link),
      description: String(raw),
      pubDate: it.pubDate || it.published || it.updated || it.date || it.created || it.pubdate || "",
      thumbnail: String(thumb)
    };
  };

  // ==================== PROXY & FETCH ====================
  if(!window.__proxyHealth) window.__proxyHealth = {};
  const PROXY_COOLDOWN_MS = 30000;
  const PROXY_FAIL_THRESHOLD = 5;
  const googleNewsSem = { active: 0, max: 2, queue: [] };

  const googleNewsAcquire = () => new Promise(resolve => {
    if(googleNewsSem.active < googleNewsSem.max){ googleNewsSem.active++; resolve(); }
    else { googleNewsSem.queue.push(resolve); }
  });
  const googleNewsRelease = () => {
    if(googleNewsSem.queue.length > 0){ const next = googleNewsSem.queue.shift(); next(); }
    else { googleNewsSem.active--; }
  };
  const markProxyFail = (p) => {
    if(!window.__proxyHealth[p]) window.__proxyHealth[p] = { fails: 0, disabledUntil: 0 };
    window.__proxyHealth[p].fails++;
    if(window.__proxyHealth[p].fails >= PROXY_FAIL_THRESHOLD){
      window.__proxyHealth[p].disabledUntil = Date.now() + PROXY_COOLDOWN_MS;
      window.__proxyHealth[p].fails = 0;
    }
  };
  const markProxyOk = (p) => {
    if(!window.__proxyHealth[p]) window.__proxyHealth[p] = { fails: 0, disabledUntil: 0 };
    window.__proxyHealth[p].fails = 0;
    window.__proxyHealth[p].disabledUntil = 0;
  };
  const parseResponse = (txt) => {
    const trimmed = txt.replace(/^\uFEFF/, "").replace(/^\s+/, "");
    if(trimmed.charAt(0) === "<") return { shape: "xml", items: parseRssXml(txt) };
    try{
      const data = JSON.parse(txt);
      let items = [];
      if(data.items?.length) items = data.items;
      else if(data.entries?.length) items = data.entries;
      else if(data.data?.items?.length) items = data.data.items;
      else if(Array.isArray(data)) items = data;
      return { shape: "json", items };
    }catch(e){ return { shape: "?", items: [] }; }
  };

  async function fetchFeedWithFallback(feedUrl){
    const isGoogleNews = /news\.google\.com/.test(feedUrl);
    if(isGoogleNews) await googleNewsAcquire();
    try {
      const proxies = isGoogleNews ? (CONFIG.googleNewsProxies?.length ? CONFIG.googleNewsProxies : CONFIG.proxies) : CONFIG.proxies;
      let lastErr = null;
      for(let i = 0; i < proxies.length; i++){
        const p = proxies[i];
        const health = window.__proxyHealth[p];
        if(health?.disabledUntil && Date.now() < health.disabledUntil) continue;
        try{
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), CONFIG.fetchTimeoutMs);
          const r = await fetch(p + encodeURIComponent(feedUrl), {signal: ctrl.signal});
          clearTimeout(timer);
          if(!r.ok) throw new Error("HTTP " + r.status);
          const txt = await r.text();
          const parsed = parseResponse(txt);
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

  // ==================== TRANSLATION ====================
  const TRANSLATION_SEM = { active: 0, max: 3, queue: [] };

  const titleHashKey = (lang, title) => {
    const str = (lang || "xx") + "|" + (title || "");
    let h1 = 5381, h2 = 52711;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 = ((h1 << 5) + h1) ^ c;
      h2 = ((h2 << 5) + h2 + c) | 0;
    }
    return "tr_" + (h1 >>> 0).toString(36) + "_" + (h2 >>> 0).toString(36);
  };
  const translationAcquire = () => new Promise(resolve => {
    if(TRANSLATION_SEM.active < TRANSLATION_SEM.max){ TRANSLATION_SEM.active++; resolve(); }
    else { TRANSLATION_SEM.queue.push(resolve); }
  });
  const translationRelease = () => {
    if(TRANSLATION_SEM.queue.length > 0){ const next = TRANSLATION_SEM.queue.shift(); next(); }
    else { TRANSLATION_SEM.active--; }
  };
  async function fetchTranslation(text, sourceLang) {
    if(!text) return null;
    const cleanText = text.replace(/\s+/g, " ").trim().slice(0, 500);
    if(!cleanText) return null;
    try {
      const mmUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=${encodeURIComponent(sourceLang || "en")}|nl`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(mmUrl, { signal: ctrl.signal });
      clearTimeout(timer);
      if(r.ok){
        const data = await r.json();
        const out = data?.responseData?.translatedText;
        if(out && out.length > 1 && !out.includes("MYMEMORY WARNING") && !out.includes("QUERY LENGTH LIMIT") && !out.includes("YOU USED ALL AVAILABLE") && out !== cleanText){
          return out;
        }
      }
    }catch(e){}
    try {
      const proxy = CONFIG.proxies[0];
      const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sourceLang || "auto")}&tl=nl&dt=t&q=${encodeURIComponent(cleanText)}`;
      const ctrl2 = new AbortController();
      const timer2 = setTimeout(() => ctrl2.abort(), 8000);
      const r2 = await fetch(proxy + encodeURIComponent(googleUrl), { signal: ctrl2.signal });
      clearTimeout(timer2);
      if(r2.ok){
        const data2 = await r2.json();
        if(data2 && Array.isArray(data2[0])){
          let out2 = "";
          for(const seg of data2[0]) if(seg?.[0]) out2 += seg[0];
          if(out2 && out2.length > 1) return out2;
        }
      }
    }catch(e){}
    return null;
  }
  async function translateItem(item) {
    if(!item?.title || !item.lang || item.lang === "nl" || !state.translateEnabled) return null;
    const key = titleHashKey(item.lang, item.title);
    if(state.translations[key]) return state.translations[key];
    const cached = await NewsDB.loadTranslation(key);
    if(cached){ state.translations[key] = cached; return cached; }
    if(state.translationPending[key]) return null;
    state.translationPending[key] = true;
    await translationAcquire();
    try {
      const translated = await fetchTranslation(item.title, item.lang);
      if(translated){
        state.translations[key] = translated;
        NewsDB.saveTranslation(key, translated).catch(() => {});
        return translated;
      }
    } finally {
      translationRelease();
      delete state.translationPending[key];
    }
    return null;
  }
  async function translateVisibleItems(items) {
    if(!state.translateEnabled) return;
    const toTranslate = items.filter(it => it.lang && it.lang !== "nl" && !state.translations[titleHashKey(it.lang, it.title)]);
    if(!toTranslate.length) return;
    await Promise.all(toTranslate.map(async it => {
      const translated = await translateItem(it);
      if(translated) updateCardTitle(it, translated);
    }));
  }
  const updateCardTitle = (item, translatedTitle) => {
    const cards = document.querySelectorAll(".news-card[data-link]");
    for(const card of cards){
      if(card.getAttribute("data-link") === item.link){
        const titleEl = card.querySelector(".card-title");
        if(titleEl){ titleEl.textContent = translatedTitle; titleEl.setAttribute("dir", "ltr"); }
        const origEl = card.querySelector(".card-original");
        if(!origEl && titleEl){
          const newEl = document.createElement("p");
          newEl.className = "card-original";
          newEl.setAttribute("dir", item.lang === "ar" ? "rtl" : "ltr");
          newEl.textContent = item.title;
          titleEl.parentNode.insertBefore(newEl, titleEl.nextSibling);
        }
        break;
      }
    }
  };
  const getDisplayTitle = (it) => {
    if(!state.translateEnabled || !it.lang || it.lang === "nl") return { title: it.title, original: null };
    const key = titleHashKey(it.lang, it.title);
    if(state.translations[key]) return { title: state.translations[key], original: it.title };
    return { title: it.title, original: null };
  };
  window.__setTranslate = (enabled) => {
    state.translateEnabled = !!enabled;
    if(window.WDStorage) WDStorage.set("translate", enabled ? "1" : "0");
    const btn = $("toggleTranslate");
    if(btn) btn.classList.toggle("toggle-on", enabled);
    renderNews();
    if(window.showToast) window.showToast(enabled ? "Vertaling aan" : "Vertaling uit");
    if(enabled){
      const toShow = filterItems().slice(0, 100);
      translateVisibleItems(toShow);
    }
  };

  // ==================== FAVORITES ====================
  const isFavorite = (link) => !!state.favorites[link];
  const toggleFavorite = (link, btnEl) => {
    if(state.favorites[link]){
      delete state.favorites[link];
      NewsDB.removeFavorite(link);
      if(btnEl){ btnEl.classList.remove("active"); btnEl.textContent = "☆"; }
    } else {
      state.favorites[link] = Date.now();
      NewsDB.saveFavorite(link);
      if(btnEl){ btnEl.classList.add("active"); btnEl.textContent = "★"; }
    }
    updateFavoritesCount();
    if(state.currentCat === "favorites") renderNews();
  };
  const updateFavoritesCount = () => {
    const el = $("favCount");
    if(el) el.textContent = Object.keys(state.favorites).length;
  };

  // ==================== NOTIFICATIONS ====================
  const requestNotificationPermission = async () => {
    if(!("Notification" in window)) return false;
    if(Notification.permission === "granted") return true;
    if(Notification.permission === "denied") return false;
    try {
      const result = await Notification.requestPermission();
      return result === "granted";
    } catch(e) { return false; }
  };

  window.__setNotifications = async (enabled) => {
    if(enabled){
      const ok = await requestNotificationPermission();
      if(!ok){
        if(window.showToast) window.showToast("Notificaties geweigerd door browser");
        return;
      }
      state.notificationsEnabled = true;
      if(window.WDStorage) WDStorage.set("notifications", "1");
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
      state.notificationsEnabled = false;
      if(window.WDStorage) WDStorage.set("notifications", "0");
      if(window.showToast) window.showToast("Notificaties uit");
    }
  };

  const sendBreakingNotification = (group) => {
    if(!state.notificationsEnabled || !("Notification" in window) || Notification.permission !== "granted" || group.sources.length < 5) return;
    try {
      const notif = new Notification("Breaking - " + group.sources.length + " bronnen", {
        body: group.items[0].title.slice(0, 180),
        tag: "wardesk-breaking-" + Math.floor(Date.now() / 60000),
        icon: "./icons/icon-192.png",
        badge: "./icons/icon-96.png"
      });
      notif.onclick = () => { try { window.focus(); }catch(e){} notif.close(); };
    }catch(e) { wdLog.warn("[WAR DESK] notificatie fout:", e); }
  };

  // ==================== LOAD ALL FEEDS ====================
  async function loadAllFeeds(){
    const session = ++state.loadSession;
    const itemsAtStart = [...state.items];
    const minKeep = itemsAtStart.length;
    const active = FEEDS.filter(f => !state.disabled[f.n]);
    state.totalSources = active.length;
    state.failedSources = [];
    state.loadedSources = 0;
    const collected = [];
    const collectedLinks = {};
    let tried = 0;

    emitProgress(3);

    window.__wdDiagCount = 0;
    let lastProgressiveCount = 0;
    const progressiveTimer = setInterval(() => {
      if(session !== state.loadSession || state._loadFeedsDone){
        clearInterval(progressiveTimer);
        return;
      }
      if(collected.length <= lastProgressiveCount) return;
      lastProgressiveCount = collected.length;
      let merged = dedupe([...collected, ...itemsAtStart]);
      if(merged.length < minKeep) merged = [...itemsAtStart];
      state.items = merged;
      const itemsEl = $("statItems");
      if(itemsEl) itemsEl.textContent = state.items.length;
      renderNews();
    }, 1000);

    state._loadFeedsDone = false;

    async function processOne(f){
      if(session !== state.loadSession) return;
      tried++;
      try{
        const result = await fetchFeedWithFallback(f.url);
        const { items, shape, proxyIdx } = result;
        let added = 0;
        items.slice(0, CONFIG.perFeed).forEach(rawIt => {
          const it = normalizeItem(rawIt);
          const titleClean = strip(it.title || "");
          const descClean = strip(it.description || "").slice(0, 300);
          const key = String(it.link || titleClean).toLowerCase().trim();
          if(key && !collectedLinks[key]){
            collectedLinks[key] = 1;
            const detectedTags = extractTags(titleClean, descClean, f.cat);
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
        if(window.WD_DEBUG && window.__wdDiagCount < 5){
          window.__wdDiagCount++;
          const pTag = proxyIdx === 0 ? "p1" : ("p" + (proxyIdx + 1));
          wdLog.info(`${f.n} [${shape}/${pTag}] items=${items.length} nieuw=${added}`);
        }
        state.loadedSources++;
        if(state.health[f.n]) state.health[f.n].fails = 0;
        const srcEl = $("statSources");
        if(srcEl && session === state.loadSession) srcEl.textContent = `${state.loadedSources}/${state.totalSources}`;
      }catch(e){
        state.failedSources.push(f.n);
        if(!state.health[f.n]) state.health[f.n] = {fails:0, last:0};
        state.health[f.n].fails++;
        state.health[f.n].last = Date.now();
        if(state.health[f.n].fails >= CONFIG.failThreshold) state.disabled[f.n] = true;
      }

      if(session === state.loadSession){
        const pct = 3 + Math.round((tried / Math.max(1, active.length)) * 92);
        emitProgress(pct);
      }
    }

    try {
      const queue = [...active];
      const workers = [];
      for(let i = 0; i < CONFIG.parallelWorkers; i++){
        workers.push((async () => {
          while(queue.length && session === state.loadSession){
            const f = queue.shift();
            if(f) await processOne(f);
          }
        })());
      }
      await Promise.all(workers);
    } finally {
      state._loadFeedsDone = true;
      clearInterval(progressiveTimer);
    }

    if(session !== state.loadSession) return;
    state.items = dedupe([...collected, ...itemsAtStart]);
    if(state.items.length < minKeep) state.items = [...itemsAtStart];
    const srcEl = $("statSources");
    if(srcEl) srcEl.textContent = `${state.loadedSources}/${state.totalSources}`;
    const itemsEl = $("statItems");
    if(itemsEl) itemsEl.textContent = state.items.length;

    NewsDB.saveItems(state.items);
    NewsDB.saveHealth(state.health);

    emitProgress(100, true);

    detectBreaking();
    renderNews();
    if(state.translateEnabled){
      const toShow = filterItems().slice(0, 100);
      translateVisibleItems(toShow);
    }

    if(state.items.length === 0 && state.failedSources.length > 0){
      if(window.showToast) window.showToast("Kon geen nieuws laden. Controleer je verbinding.");
    } else if(state.failedSources.length > 0 && state.items.length > 0){
      if(window.showToast) window.showToast(`${state.failedSources.length} bron(nen) konden niet laden.`);
    } else if(state.items.length === 0 && state.loadedSources === 0){
      if(window.showToast) window.showToast("Geen nieuwsbronnen beschikbaar.");
    }

    if(state.items.length){
      wdLog.info(`loadAllFeeds klaar - ${state.items.length} items uit ${state.loadedSources}/${state.totalSources} bronnen`);
    } else {
      wdLog.warn(`loadAllFeeds klaar - 0 items uit ${state.loadedSources}/${state.totalSources} bronnen`);
    }
  }

  // ==================== BREAKING DETECTION ====================
  const detectBreaking = () => {
    if(Date.now() - state.breakingShownAt < 1800000) return;
    const now = Date.now();
    const recent = state.items.filter(it => {
      const age = now - tm(it.date);
      return age > 0 && age < 900000;
    }).slice(0, 40);
    if(recent.length < 3) return;
    const groups = [];
    const used = {};
    recent.forEach((a, i) => {
      if(used[i]) return;
      const group = { items: [a], sources: [a.source] };
      used[i] = 1;
      const aText = (a.title + " " + a.desc).toLowerCase();
      const aKw = KEYWORDS_HIGH.filter(k => aText.includes(k));
      recent.forEach((b, j) => {
        if(used[j] || i === j) return;
        const bText = (b.title + " " + b.desc).toLowerCase();
        const shared = aKw.filter(k => bText.includes(k));
        if(shared.length >= 2){
          group.items.push(b);
          if(!group.sources.includes(b.source)) group.sources.push(b.source);
          used[j] = 1;
        }
      });
      if(group.sources.length >= 3) groups.push(group);
    });
    if(!groups.length) return;
    groups.sort((a, b) => b.sources.length - a.sources.length);
    const g = groups[0];
    state.breakingShownAt = Date.now();
    state.lastBreakingItem = g.items[0];
    const bcEl = $("breakingCount");
    const btEl = $("breakingTitle");
    const bmEl = $("breakingMeta");
    if(bcEl) bcEl.textContent = g.sources.length;
    if(btEl) btEl.textContent = g.items[0].title.slice(0, 180);
    if(bmEl) bmEl.textContent = g.sources.slice(0, 4).join(" · ");
    const banner = $("breakingBanner");
    if(banner){
      banner.classList.add("show");
      clearTimeout(banner._timer);
      banner._timer = setTimeout(() => banner.classList.remove("show"), 30000);
    }
    if(state.notificationsEnabled && document.hidden){
      sendBreakingNotification(g);
    }
  };

  // ==================== FILTER & RENDER ====================
  const filterItems = () => {
    let list = [...state.items];
    if(state.currentCat === "favorites"){
      list = list.filter(it => !!state.favorites[it.link]);
    } else if(state.currentCat !== "all"){
      const cats = window.CAT_GROUPS?.[state.currentCat] ?? [state.currentCat];
      if(cats.length){
        list = list.filter(it => it.tags?.some(t => cats.includes(t)));
      }
    }
    if(state.currentSearch){
      const q = state.currentSearch;
      list = list.filter(it => (it.title + " " + it.desc + " " + it.source).toLowerCase().includes(q));
    }
    if(state.currentSort === "importance"){
      list.forEach(it => { if(it._score === undefined) it._score = scoreArticle(it); });
      list.sort((a, b) => b._score - a._score);
    } else {
      list.sort((a, b) => tm(b.date) - tm(a.date));
    }
    return list;
  };

  const renderSkeletons = (grid) => {
    let html = "";
    for(let i = 0; i < 6; i++){
      html += '<article class="skeleton-card"><div class="skeleton-thumb"></div><div class="skeleton-body"><div class="skeleton-meta"></div><div class="skeleton-line medium"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div></article>';
    }
    grid.innerHTML = html;
  };

  let _renderChunkTimer = null;
  const renderNewsChunked = (list) => {
    const grid = $("feedGrid");
    if(!grid) return;
    
    if(_renderChunkTimer) {
      cancelAnimationFrame(_renderChunkTimer);
      _renderChunkTimer = null;
    }
    
    grid.innerHTML = "";
    const chunkSize = 40;
    let index = 0;
    
    const renderChunk = () => {
      const fragment = document.createDocumentFragment();
      const end = Math.min(index + chunkSize, list.length);
      
      for(let i = index; i < end; i++){
        const it = list[i];
        const disp = getDisplayTitle(it);
        const isTranslated = !!disp.original;
        const isArabic = it.lang === "ar" || /[\u0600-\u06FF]/.test(disp.title);
        const titleDir = isTranslated ? "ltr" : (isArabic ? "rtl" : "ltr");
        const isRead = state.readMap[it.link];
        const isFav = isFavorite(it.link);
        const sources = it.sources || [it.source];
        const multi = sources.length > 1;

        const article = document.createElement('article');
        article.className = `news-card ${it.cat === "war" ? "war " : ""} ${isRead ? "read" : ""}`;
        article.dataset.link = it.link;
        article.dataset.idx = i;

        let html = '';
        if(it.img){
          html += `<div class="card-thumb"><img data-src="${esc(it.img)}" loading="lazy" alt="" onerror="this.parentNode.remove()"></div>`;
        }
        html += `<div class="card-body">
          <div class="card-meta">
            <span class="card-source">${esc(it.source)}</span>
            <span class="card-sep">·</span>
            <span>${ago(it.date)}</span>
            ${multi ? `<span class="card-multi">${sources.length} bronnen</span>` : ''}
          </div>
          <h3 class="card-title" dir="${titleDir}">${esc(disp.title)}</h3>
          ${isTranslated ? `<p class="card-original" dir="${it.lang === "ar" ? "rtl" : "ltr"}">${esc(disp.original)}</p>` : ''}
          ${it.desc ? `<p class="card-desc" dir="${it.lang === "ar" ? "rtl" : "ltr"}">${esc(it.desc)}</p>` : ''}
          <div class="card-footer">
            <span>${rtime(it.desc)} min lezen</span>
            <div class="card-actions">
              <button class="card-fav ${isFav ? "active" : ""}" aria-label="Favoriet">${isFav ? "★" : "☆"}</button>
              <button class="card-action card-share" aria-label="Delen">⇗</button>
            </div>
          </div>
        </div>`;

        article.innerHTML = html;
        
        const img = article.querySelector('img[data-src]');
        if(img) imageObserver.observe(img);
        
        fragment.appendChild(article);
      }

      grid.appendChild(fragment);
      index = end;

      if(index < list.length){
        _renderChunkTimer = requestAnimationFrame(renderChunk);
      } else {
        _renderChunkTimer = null;
        bindCardEvents(list);
        if(state.translateEnabled) translateVisibleItems(list.slice(0, 100));
      }
    };
    
    _renderChunkTimer = requestAnimationFrame(renderChunk);
  };

  const bindCardEvents = (list) => {
    const grid = $("feedGrid");
    if(!grid) return;
    Array.from(grid.querySelectorAll("article")).forEach((art, i) => {
      const it = list[i];
      if(!it) return;
      art.addEventListener("click", e => {
        if(e.target.closest(".card-action") || e.target.closest(".card-fav")) return;
        if(!state.readMap[it.link]){
          state.readMap[it.link] = Date.now();
          NewsDB.saveRead(it.link);
          art.classList.add("read");
        }
        window.open(it.link, "_blank", "noopener");
      });

      const favBtn = art.querySelector(".card-fav");
      if(favBtn) favBtn.addEventListener("click", e => {
        e.stopPropagation();
        toggleFavorite(it.link, favBtn);
      });

      const share = art.querySelector(".card-share");
      if(share) share.addEventListener("click", e => {
        e.stopPropagation();
        if(navigator.share){
          navigator.share({ title: it.title, url: it.link }).catch(() => {});
        } else if(navigator.clipboard){
          navigator.clipboard.writeText(it.link).then(() => {
            if(window.showToast) window.showToast("Link gekopieerd");
          });
        }
      });

      const multi = art.querySelector(".card-multi");
      if(multi) multi.addEventListener("click", e => {
        e.stopPropagation();
        if(window.showToast) window.showToast(it.sources.join(", "));
      });
    });
  };

  const renderNews = () => {
    const list = filterItems();
    const grid = $("feedGrid");
    const title = $("newsTitle");
    const count = $("newsCount");
    const titles = {
      all: "Laatste berichten", war: "Oorlog & conflict", mideast: "Midden-Oosten",
      europe: "Europa", nl: "Nederland", maroc: "Marokko", vs: "Verenigde Staten",
      sport: "Sport", favorites: "Favorieten"
    };
    const catLabel = titles[state.currentCat] || "Laatste berichten";
    if(title) title.textContent = catLabel;
    if(count) count.textContent = `${list.length} artikelen`;
    if(!grid) return;
    if(!list.length){
      if(state.items.length === 0){
        renderSkeletons(grid);
      } else if(state.currentCat === "favorites"){
        grid.innerHTML = '<div class="empty-state"><div class="empty-icon">☆</div><div class="empty-msg">Nog geen favorieten</div><div class="empty-hint">Tik op het ster-icoon bij een artikel om het te bewaren</div></div>';
      } else {
        grid.innerHTML = `<div class="empty-state"><div class="empty-icon"></div><div class="empty-msg">Geen artikelen in <span class="empty-context">${esc(catLabel)}</span></div><div class="empty-hint">Probeer een andere categorie of zoekterm</div></div>`;
      }
      return;
    }
    const toShow = list.slice(0, 100);
    grid.classList.toggle("list-mode", state.viewMode === "list");
    renderNewsChunked(toShow);
  };

  const startAutoRefresh = () => {
    clearInterval(state.refreshTimer);
    if(!CONFIG.autoRefreshMs || CONFIG.autoRefreshMs <= 0) return;
    state.refreshTimer = setInterval(() => {
      if(document.hidden) return;
      const idle = Date.now() - state.lastActivity;
      const atTop = window.scrollY < 200;
      if(idle < CONFIG.pauseOnScrollMs && !atTop) return;
      if(state.isScrolling) return;
      state.disabled = {};
      loadAllFeeds();
    }, CONFIG.autoRefreshMs);
  };

  async function initNews(){
    await NewsDB.open();
    NewsDB.pruneOldReads().catch(() => {});

    // B12: bij tag-versie wijziging → herbereken tags, niet wissen
    try{
      var storedTagsVersion = window.WDStorage ? WDStorage.get("tags_version") : null;
      if(storedTagsVersion !== window.TAGS_VERSION){
        wdLog.info("[WAR DESK] Tags-versie gewijzigd — tags herberekenen...");
        await NewsDB.retagAll(extractTags);
        if(window.WDStorage) WDStorage.set("tags_version", window.TAGS_VERSION);
        wdLog.info("[WAR DESK] Tags herberekend");
      }
    }catch(e){}

    try {
      state.translateEnabled = (window.WDStorage ? WDStorage.get("translate") : null) === "1";
    }catch(e){}
    try {
      state.notificationsEnabled = (window.WDStorage ? WDStorage.get("notifications") : null) === "1";
    }catch(e){}
    state.health = {};
    state.disabled = {};
    state.readMap = await NewsDB.loadReadMap();
    state.favorites = await NewsDB.loadFavorites();
    updateFavoritesCount();

    const grid = $("feedGrid");
    if(grid && !state.items.length) renderSkeletons(grid);

    const cached = await NewsDB.loadItems();
    if(cached.length){
      state.items = ensureTags(cached);
      const itemsEl = $("statItems");
      if(itemsEl) itemsEl.textContent = state.items.length;
      renderNews();
    }
    await loadAllFeeds();
    startAutoRefresh();
    window.addEventListener("scroll", () => {
      state.lastActivity = Date.now();
      state.isScrolling = true;
      clearTimeout(state.scrollTimer);
      state.scrollTimer = setTimeout(() => { state.isScrolling = false; }, 1500);
    }, {passive:true});
    ["touchstart", "mousedown", "keydown", "click"].forEach(ev => {
      window.addEventListener(ev, () => { state.lastActivity = Date.now(); }, {passive:true});
    });
  }

  window.__hardRefresh = async () => {
    if(!window.NewsAPI) return;
    if(!confirm('Verversen?\n\nAlle bronnen worden opnieuw geladen. Dit kan 30-60 seconden duren.')) return;
    try{
      if(window.showToast) window.showToast("Verversen gestart...");
      await NewsDB.saveItems([]);
      state.disabled = {};
      state.health = {};
      state.loadedSources = 0;
      state.totalSources = 0;
      state.failedSources = [];
      await window.NewsAPI.reload();
      if(window.showToast) window.showToast("Verversen klaar");
    }catch(e){
      wdLog.error("[WAR DESK] hard refresh fout:", e);
      if(window.showToast) window.showToast("Verversen mislukt");
    }
  };

  setInterval(() => {
    if(document.hidden) return;
    if(state.translations && Object.keys(state.translations).length > 1000){
      state.translations = {};
      wdLog.info('[NEWS] Translation cache cleared');
    }
  }, 3600000);

  window.NewsAPI = {
    init: initNews,
    reload: loadAllFeeds,
    setCat: (cat) => { state.currentCat = cat; renderNews(); },
    setSort: (s) => { state.currentSort = s; renderNews(); },
    setSearch: (s) => { state.currentSearch = s.toLowerCase().trim(); renderNews(); },
    setView: (v) => { state.viewMode = v; renderNews(); },
    render: renderNews
  };

  wdLog.info("[WAR DESK] news-v27.js " + window.__newsVersion + " geladen");
})();