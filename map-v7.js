/* ============================================================
   WAR DESK v7.0 — Conflictkaart
   - v7: Thema-check pauzeert op achtergrond (batterij)
   - OLED theme-color support
   ============================================================ */

(function(){
  "use strict";

  var $ = function(id){ return document.getElementById(id); };
  var LOG = function(){ try{ console.log.apply(console, ["[MAP]"].concat(Array.prototype.slice.call(arguments))); }catch(e){} };

  LOG("v7.0 geladen");

  function buildStadiaUrl(style){
    var key = (window.CONFIG && CONFIG.stadiaKey) ? CONFIG.stadiaKey : "";
    var base = "https://tiles.stadiamaps.com/tiles/" + style + "/{z}/{x}/{y}{r}.png";
    if(key) base += "?api_key=" + encodeURIComponent(key);
    return base;
  }

  var TILES = {
    dark: { url: buildStadiaUrl("alidade_smooth_dark"), attribution: "© Stadia Maps © OpenMapTiles © OpenStreetMap" },
    light: { url: buildStadiaUrl("alidade_smooth"), attribution: "© Stadia Maps © OpenMapTiles © OpenStreetMap" }
  };

  var MAP = {
    instance: null,
    cluster: null,
    tileLayers: {},
    events: [],
    currentFilter: "all",
    refreshTimer: null,
    isFullscreen: false,
    worker: "https://newsfeed2.hassanbadri814.workers.dev/?url=",
    apiBase: "https://war-tracker.com/api/v1/events",
    detailCache: {},
    currentTheme: "dark",
    themeObserver: null,
    detailAbort: null,
    _timeModeInterval: null
  };

  var TYPES = {
    "military strike":       { color: "#e63950", filter: "conflict",  label: "Aanval" },
    "ground clash":          { color: "#e63950", filter: "conflict",  label: "Gevecht" },
    "security incident":     { color: "#e63950", filter: "conflict",  label: "Incident" },
    "political development": { color: "#3b82f6", filter: "political", label: "Politiek" },
    "other":                 { color: "#6b7a93", filter: "other",     label: "Overig" },
    "na":                    { color: "#6b7a93", filter: "other",     label: "Onbekend" }
  };

  var ICONS = {
    conflict:  '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2 L22 21 L2 21 Z"/></svg>',
    political: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2 L22 8 L22 10 L2 10 L2 8 Z M4 12 L4 20 L8 20 L8 12 Z M10 12 L10 20 L14 20 L14 12 Z M16 12 L16 20 L20 20 L20 12 Z M2 20 L22 20 L22 22 L2 22 Z"/></svg>',
    other:     '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2 L22 12 L12 22 L2 12 Z"/></svg>'
  };

  function getType(t){
    if(!t) return TYPES["na"];
    var key = String(t).toLowerCase().trim();
    return TYPES[key] || TYPES["na"];
  }
  function iconFor(filter){
    if(filter === "conflict") return ICONS.conflict;
    if(filter === "political") return ICONS.political;
    return ICONS.other;
  }

  function detectTheme(){
    return document.body.classList.contains("light") ? "light" : "dark";
  }

  function updateMetaTheme(){
    var meta = document.querySelector('meta[name="theme-color"]');
    if(!meta) return;
    var oled = document.documentElement.getAttribute("data-oled") === "true";
    var light = document.body.classList.contains("light");
    var color;
    if(oled) color = "#000000";
    else if(light) color = "#f6f4ee";
    else color = "#070c16";
    meta.setAttribute("content", color);
  }

  function switchTile(theme){
    if(!MAP.instance) return;
    var cfg = TILES[theme] || TILES.dark;
    if(!MAP.tileLayers[theme]){
      MAP.tileLayers[theme] = L.tileLayer(cfg.url, {
        maxZoom: 20,
        attribution: cfg.attribution,
        crossOrigin: true
      });
    }
    Object.keys(MAP.tileLayers).forEach(function(k){
      var layer = MAP.tileLayers[k];
      if(k === theme){
        if(!MAP.instance.hasLayer(layer)) layer.addTo(MAP.instance);
      } else {
        if(MAP.instance.hasLayer(layer)) MAP.instance.removeLayer(layer);
      }
    });
  }

  function observeThemeChanges(){
    if(MAP.themeObserver) return;
    MAP.themeObserver = new MutationObserver(function(mutations){
      mutations.forEach(function(m){
        if(m.attributeName === "class"){
          var newTheme = detectTheme();
          if(newTheme !== MAP.currentTheme){
            MAP.currentTheme = newTheme;
            switchTile(newTheme);
            updateMetaTheme();
          }
        }
      });
    });
    MAP.themeObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }

  /* ============================================================
     TIJDMODUS — v7: pauzeert op achtergrond
     ============================================================ */
  function checkTimeMode(){
    if(document.hidden) return;
    if(!window.CONFIG || !CONFIG.themeAutoSwitch) return;
    var manualUntil = 0;
    try { manualUntil = parseInt(localStorage.getItem("wardesk_theme_manual_until") || "0", 10); }catch(e){}
    if(Date.now() < manualUntil) return;
    var hour = new Date().getHours();
    var shouldBeLight = hour >= CONFIG.themeLightStart && hour < CONFIG.themeDarkStart;
    var isLight = document.body.classList.contains("light");
    if(shouldBeLight !== isLight){
      document.documentElement.classList.toggle("light", shouldBeLight);
      document.body.classList.toggle("light", shouldBeLight);
      try { localStorage.setItem("wardesk_theme", shouldBeLight ? "light" : "dark"); }catch(e){}
      updateMetaTheme();
      LOG("Tijd-modus: thema →", shouldBeLight ? "licht" : "donker");
    }
  }

  function markManualTheme(){
    try{
      var until = Date.now() + 8 * 3600 * 1000;
      localStorage.setItem("wardesk_theme_manual_until", String(until));
    }catch(e){}
  }

  function injectMapStyles(){
    if($("wdMapStyles")) return;
    var s = document.createElement("style");
    s.id = "wdMapStyles";
    s.textContent =
      ".leaflet-control-attribution{display:none!important}" +
      ".leaflet-container{background:#05080f!important}" +
      "body.light .leaflet-container{background:#f5f5f5!important}" +
      "html[data-oled='true'] .leaflet-container{background:#000000!important}" +
      ".wd-marker{background:transparent!important;border:none!important}" +
      ".wd-marker-inner{position:relative;width:16px;height:16px;display:grid;place-items:center}" +
      ".wd-marker-icon{width:14px;height:14px;display:grid;place-items:center;position:relative;z-index:2;filter:drop-shadow(0 1px 2px rgba(0,0,0,.85)) drop-shadow(0 0 3px currentColor);}" +
      ".wd-marker-icon svg{width:100%;height:100%;display:block;stroke:#070c16;stroke-width:1.6;stroke-linejoin:round;stroke-linecap:round;}" +
      ".wd-marker-pulse{position:absolute;inset:0;border-radius:50%;background:currentColor;opacity:.22;z-index:1;animation:wdMarkerPulse 2.6s ease-out infinite}" +
      "@keyframes wdMarkerPulse{0%{transform:scale(.5);opacity:.35}100%{transform:scale(2.2);opacity:0}}" +
      ".marker-cluster-small,.marker-cluster-medium,.marker-cluster-large{background:transparent!important}" +
      ".marker-cluster-small div,.marker-cluster-medium div,.marker-cluster-large div{background:linear-gradient(135deg,#1e3a5f,#3b6ba8)!important;color:#ffffff!important;font-weight:800!important;border:1px solid rgba(255,255,255,.75)!important;box-shadow:0 1px 3px rgba(0,0,0,.55),0 0 6px rgba(59,130,246,.3)!important;display:flex!important;align-items:center!important;justify-content:center!important;font-family:Inter,sans-serif!important;}" +
      ".marker-cluster-small, .marker-cluster-small div{width:18px!important;height:18px!important}" +
      ".marker-cluster-small{margin-left:-9px!important;margin-top:-9px!important}" +
      ".marker-cluster-medium, .marker-cluster-medium div{width:22px!important;height:22px!important}" +
      ".marker-cluster-medium{margin-left:-11px!important;margin-top:-11px!important}" +
      ".marker-cluster-large, .marker-cluster-large div{width:26px!important;height:26px!important}" +
      ".marker-cluster-large{margin-left:-13px!important;margin-top:-13px!important}" +
      ".marker-cluster div span{font-size:.56rem!important;line-height:1!important;letter-spacing:-.02em!important}" +
      ".map-wrap.fullscreen .map-legend{display:none!important}" +
      ".map-wrap.fullscreen .map-controls .map-ctrl[data-role='full']{display:none!important}" +
      ".wd-map-close{display:none!important;position:absolute;top:.8rem;right:.8rem;z-index:600;width:42px;height:42px;border-radius:50%;background:rgba(10,16,28,.92);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.12);color:#e6ebf5;font-size:1.15rem;font-weight:400;line-height:1;place-items:center;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.6);transition:all .18s}" +
      ".wd-map-close:hover{background:rgba(20,28,44,.95);border-color:rgba(255,255,255,.25);transform:rotate(90deg)}" +
      ".map-wrap.fullscreen .wd-map-close{display:grid!important}" +
      ".map-wrap.fullscreen .map-controls{top:.8rem;left:.8rem;right:auto}" +
      ".wd-detail-modal{z-index:10050!important}" +
      ".wd-detail-box{background:linear-gradient(180deg,#0f1728,#0a101c)!important;border:1px solid rgba(255,255,255,.06)!important;box-shadow:0 30px 80px -30px rgba(0,0,0,.95)!important;}" +
      "body.light .wd-detail-box{background:linear-gradient(180deg,#ffffff,#fafafa)!important;border-color:rgba(0,0,0,.08)!important}" +
      ".wd-detail-head{border-bottom:1px solid rgba(255,255,255,.05)!important}" +
      ".wd-detail-type{box-shadow:0 0 12px rgba(0,0,0,.4)}" +
      ".wd-detail-close{background:rgba(255,255,255,.04)!important;border:1px solid rgba(255,255,255,.08)!important}" +
      ".wd-detail-meta{color:#8a94a8!important;border-bottom:1px solid rgba(255,255,255,.05)!important}" +
      ".wd-detail-text{color:#e6ebf5!important;font-size:.9rem!important;line-height:1.65!important}" +
      "body.light .wd-detail-text{color:#1a1a1a!important}" +
      ".wd-detail-foot{border-top:1px solid rgba(255,255,255,.05)!important;background:rgba(0,0,0,.2)!important}" +
      "body.light .wd-detail-foot{background:rgba(0,0,0,.03)!important}" +
      ".wd-detail-btn{background:transparent!important;border:1px solid rgba(255,255,255,.08)!important;color:#8a94a8!important;font-weight:600!important;}" +
      ".wd-detail-btn:hover{border-color:rgba(255,255,255,.15)!important;color:#e6ebf5!important}" +
      ".wd-detail-btn.primary{background:rgba(224,168,87,.1)!important;border:1px solid rgba(224,168,87,.28)!important;color:#e0a857!important;}" +
      ".wd-detail-btn.primary:hover{background:rgba(224,168,87,.16)!important;border-color:rgba(224,168,87,.45)!important;}";
    document.head.appendChild(s);
  }

  function enterFullscreen(){
    var wrap = document.querySelector(".map-wrap");
    if(!wrap || wrap.classList.contains("fullscreen")) return;
    wrap.classList.add("fullscreen");
    MAP.isFullscreen = true;
    if(MAP.instance) setTimeout(function(){ MAP.instance.invalidateSize(); }, 250);
  }
  function exitFullscreen(){
    var wrap = document.querySelector(".map-wrap");
    if(!wrap) return;
    wrap.classList.remove("fullscreen");
    MAP.isFullscreen = false;
    if(MAP.instance) setTimeout(function(){ MAP.instance.invalidateSize(); }, 250);
  }
  function ensureFullscreenClose(){
    var wrap = document.querySelector(".map-wrap");
    if(!wrap) return;
    if(wrap.querySelector(".wd-map-close")) return;
    var btn = document.createElement("button");
    btn.className = "wd-map-close";
    btn.setAttribute("aria-label", "Sluiten");
    btn.textContent = "✕";
    btn.addEventListener("click", function(e){
      e.stopPropagation();
      exitFullscreen();
    });
    wrap.appendChild(btn);
  }

  function ensureDetailModal(){
    if($("wdDetailModal")) return;
    var modal = document.createElement("div");
    modal.id = "wdDetailModal";
    modal.className = "wd-detail-modal";
    modal.innerHTML =
      '<div class="wd-detail-box">' +
        '<div class="wd-detail-head">' +
          '<span class="wd-detail-type" id="wdDetailType">—</span>' +
          '<button class="wd-detail-close" id="wdDetailClose" aria-label="Sluiten">✕</button>' +
        '</div>' +
        '<div class="wd-detail-body">' +
          '<div class="wd-detail-meta" id="wdDetailMeta">—</div>' +
          '<div class="wd-detail-text" id="wdDetailText">—</div>' +
        '</div>' +
        '<div class="wd-detail-foot">' +
          '<button class="wd-detail-btn primary" id="wdDetailCloseBtn">Sluiten</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.addEventListener("click", function(e){
      if(e.target === modal) closeDetail();
    });
    $("wdDetailClose").addEventListener("click", closeDetail);
    $("wdDetailCloseBtn").addEventListener("click", closeDetail);
  }

  function cacheDetail(id, text){
    MAP.detailCache[id] = { text: text, t: Date.now() };
    cleanupDetailCache();
  }
  function getCachedDetail(id){
    var entry = MAP.detailCache[id];
    if(!entry) return null;
    var ttl = (window.CONFIG && CONFIG.detailCacheTTL) ? CONFIG.detailCacheTTL : 7200000;
    if(Date.now() - entry.t > ttl){ delete MAP.detailCache[id]; return null; }
    return entry.text;
  }
  function cleanupDetailCache(){
    var ttl = (window.CONFIG && CONFIG.detailCacheTTL) ? CONFIG.detailCacheTTL : 7200000;
    var max = (window.CONFIG && CONFIG.detailCacheMax) ? CONFIG.detailCacheMax : 500;
    var now = Date.now();
    var ids = Object.keys(MAP.detailCache);
    var toRemove = [];
    ids.forEach(function(id){
      if(now - MAP.detailCache[id].t > ttl) toRemove.push(id);
    });
    toRemove.forEach(function(id){ delete MAP.detailCache[id]; });
    ids = Object.keys(MAP.detailCache);
    if(ids.length > max){
      ids.sort(function(a, b){ return MAP.detailCache[a].t - MAP.detailCache[b].t; });
      var excess = ids.slice(0, ids.length - max);
      excess.forEach(function(id){ delete MAP.detailCache[id]; });
    }
  }

  function openDetail(event){
    ensureDetailModal();
    var modal = $("wdDetailModal");
    var color = event.typeConfig.color;
    $("wdDetailType").textContent = event.typeConfig.label;
    $("wdDetailType").style.background = color;
    $("wdDetailMeta").textContent = (event.country || "Onbekend") + " · " + timeAgo(event.date) + " · confidence " + (event.confidence || "LOW");
    var textEl = $("wdDetailText");
    textEl.textContent = event.fullDescription || event.title || "(geen beschrijving)";
    textEl.style.transition = "opacity .2s";
    modal.classList.add("show");
    loadFullText(event, textEl);
  }

  async function loadFullText(event, textEl){
    if(!textEl) return;
    var cached = getCachedDetail(event.id);
    if(cached){ textEl.textContent = cached; return; }
    if(MAP.detailAbort){ try{ MAP.detailAbort.abort(); }catch(e){} }
    MAP.detailAbort = new AbortController();
    var signal = MAP.detailAbort.signal;
    textEl.style.opacity = ".55";
    try{
      var detailUrl = "https://war-tracker.com/api/v1/events/" + encodeURIComponent(event.id);
      var r = await fetch(MAP.worker + encodeURIComponent(detailUrl), { signal: signal });
      if(!r.ok) throw new Error("HTTP " + r.status);
      var data = await r.json();
      var fullText = "";
      if(typeof data.description === "string" && data.description.length > fullText.length){
        fullText = data.description;
      }
      if(Array.isArray(data.article_paragraphs) && data.article_paragraphs.length){
        var joined = data.article_paragraphs.join("\n\n");
        if(joined.length > fullText.length) fullText = joined;
      }
      if(!fullText) fullText = event.fullDescription || event.title || "(geen beschrijving)";
      cacheDetail(event.id, fullText);
      if(textEl.textContent !== fullText) textEl.textContent = fullText;
      textEl.style.opacity = "1";
    }catch(e){
      if(e.name === "AbortError") return;
      LOG("Detail fetch fout:", e.message);
      textEl.style.opacity = "1";
    }
  }

  function closeDetail(){
    if(MAP.detailAbort){ try{ MAP.detailAbort.abort(); }catch(e){} MAP.detailAbort = null; }
    var modal = $("wdDetailModal");
    if(modal) modal.classList.remove("show");
  }

  async function fetchEvents(){
    LOG("Fetch events...");
    var list = $("liveList");
    if(list && !MAP.events.length){
      list.innerHTML = '<div class="live-empty">Events worden geladen...</div>';
    }
    var limit = (window.CONFIG && CONFIG.warTrackerLimit) ? CONFIG.warTrackerLimit : 100;
    var apiUrl = MAP.apiBase + "?limit=" + limit;
    try{
      var ctrl = new AbortController();
      var timer = setTimeout(function(){ ctrl.abort(); }, 30000);
      var r = await fetch(MAP.worker + encodeURIComponent(apiUrl), {signal: ctrl.signal});
      clearTimeout(timer);
      if(!r.ok) throw new Error("HTTP " + r.status);
      var data = await r.json();
      var events = (data && data.events) ? data.events : (Array.isArray(data) ? data : []);
      LOG(events.length, "events ontvangen");
      var withCoords = events.filter(function(e){
        return typeof e.lat === "number" && typeof e.lng === "number" && isFinite(e.lat) && isFinite(e.lng) && e.lat !== 0 && e.lng !== 0;
      });
      MAP.events = withCoords.map(function(e){
        var type = getType(e.event_type);
        var fullDesc = (e.description || "").trim();
        return {
          id: e.id,
          lat: e.lat,
          lng: e.lng,
          title: fullDesc.slice(0, 100) || "Event",
          fullDescription: fullDesc,
          type: e.event_type || "NA",
          typeConfig: type,
          country: e.country || "?",
          date: e.date || new Date().toISOString(),
          url: e.url || "",
          confidence: e.confidence || "LOW"
        };
      });
      var statEl = $("statEvents");
      if(statEl) statEl.textContent = MAP.events.length;
      renderMarkers();
      renderLegend();
      renderLiveList();
      LOG("Klaar:", MAP.events.length, "events");
    }catch(e){
      LOG("Fetch fout:", e.message);
      if(list){
        list.innerHTML = '<div class="live-empty">Fout bij laden: ' + (e.message || "onbekend") + '</div>';
      }
    }
  }

  function renderMarkers(){
    if(!MAP.cluster) return;
    MAP.cluster.clearLayers();
    var filtered = MAP.events.filter(function(e){
      if(MAP.currentFilter === "all") return true;
      return e.typeConfig.filter === MAP.currentFilter;
    });
    var markers = [];
    filtered.forEach(function(e){
      var color = e.typeConfig.color;
      var glyph = iconFor(e.typeConfig.filter);
      var icon = L.divIcon({
        className: "wd-marker",
        html: '<div class="wd-marker-inner" style="color:' + color + '">' +
              '<span class="wd-marker-pulse"></span>' +
              '<span class="wd-marker-icon">' + glyph + '</span>' +
              '</div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        popupAnchor: [0, -10]
      });
      var marker = L.marker([e.lat, e.lng], {icon: icon});
      var shortDesc = (e.fullDescription || "").slice(0, 180);
      var popupHtml =
        '<div class="pop-cat" style="--cat-color:' + color + '">' + e.typeConfig.label + '</div>' +
        '<div class="pop-title">' + escapeHtml(shortDesc) + (e.fullDescription.length > 180 ? "…" : "") + '</div>' +
        '<div class="pop-meta">' + escapeHtml(e.country || "?") + ' · ' + timeAgo(e.date) + '</div>' +
        '<button class="pop-more" data-id="' + escapeHtml(String(e.id)) + '">Volledige tekst →</button>';
      marker.bindPopup(popupHtml);
      marker.on("popupopen", function(){
        setTimeout(function(){
          var btn = document.querySelector('.pop-more[data-id="' + e.id + '"]');
          if(btn){
            btn.onclick = function(ev){
              ev.preventDefault();
              ev.stopPropagation();
              openDetail(e);
            };
          }
        }, 50);
      });
      markers.push(marker);
    });
    MAP.cluster.addLayers(markers);
  }

  function renderLegend(){
    var el = $("legendItems");
    if(!el) return;
    var counts = { conflict: 0, political: 0, other: 0 };
    MAP.events.forEach(function(e){
      var f = e.typeConfig.filter;
      if(counts[f] !== undefined) counts[f]++;
    });
    var rows = [
      { key: "conflict",  color: "#e63950", label: "Conflict" },
      { key: "political", color: "#3b82f6", label: "Politiek" },
      { key: "other",     color: "#6b7a93", label: "Overig" }
    ].filter(function(r){ return counts[r.key] > 0; });
    if(!rows.length){ el.innerHTML = '<div class="legend-item">Geen data</div>'; return; }
    el.innerHTML = rows.map(function(r){
      return '<div class="legend-item">' +
        '<span class="legend-dot" style="background:' + r.color + '"></span>' +
        '<span>' + r.label + '</span>' +
        '<span class="legend-num">' + counts[r.key] + '</span></div>';
    }).join("");
  }

  function renderLiveList(){
    var list = $("liveList");
    var countEl = $("liveCount");
    if(!list) return;
    var filtered = MAP.events.filter(function(e){
      if(MAP.currentFilter === "all") return true;
      return e.typeConfig.filter === MAP.currentFilter;
    });
    filtered.sort(function(a, b){ return new Date(b.date) - new Date(a.date); });
    if(countEl) countEl.textContent = filtered.length;
    if(!filtered.length){
      list.innerHTML = '<div class="live-empty">Geen events in deze categorie</div>';
      return;
    }
    list.innerHTML = filtered.slice(0, 80).map(function(e){
      var color = e.typeConfig.color;
      var shortText = (e.fullDescription || "").slice(0, 160);
      var hasMore = e.fullDescription.length > 160;
      return '<div class="live-event" data-id="' + escapeHtml(String(e.id)) + '" style="--cat-color:' + color + '">' +
        '<div class="live-event-body">' +
        '<div class="live-event-title">' + escapeHtml(shortText) + (hasMore ? "…" : "") + '</div>' +
        '<div class="live-event-meta">' +
        '<span class="live-event-loc">' + escapeHtml(e.country || "—") + '</span>' +
        '<span>·</span>' +
        '<span>' + timeAgo(e.date) + '</span>' +
        '<span class="live-event-cat" style="--cat-color:' + color + '">' + e.typeConfig.label + '</span>' +
        '</div></div></div>';
    }).join("");
    Array.prototype.forEach.call(list.querySelectorAll(".live-event"), function(el){
      el.addEventListener("click", function(){
        var id = el.dataset.id;
        var ev = MAP.events.find(function(x){ return String(x.id) === String(id); });
        if(ev) openDetail(ev);
      });
    });
  }

  function escapeHtml(s){
    return (s || "").replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }
  function timeAgo(d){
    var t = new Date(d).getTime();
    if(isNaN(t)) return "";
    var diff = (Date.now() - t) / 1000;
    if(diff < 0) return "nu";
    if(diff < 60) return "nu";
    if(diff < 3600) return Math.floor(diff / 60) + " min";
    if(diff < 86400) return Math.floor(diff / 3600) + " u";
    return Math.floor(diff / 86400) + " d";
  }

  function initMap(){
    if(MAP.instance || typeof L === "undefined") return;
    var mapEl = $("map");
    if(!mapEl) return;
    MAP.instance = L.map("map", {
      center: [40, 30],
      zoom: 3,
      minZoom: 2,
      maxZoom: 18,
      worldCopyJump: true,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true
    });
    MAP.currentTheme = detectTheme();
    switchTile(MAP.currentTheme);
    MAP.cluster = L.markerClusterGroup({
      maxClusterRadius: 45,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      disableClusteringAtZoom: 11,
      chunkedLoading: true,
      chunkInterval: 100,
      chunkDelay: 50
    });
    MAP.instance.addLayer(MAP.cluster);
    observeThemeChanges();
  }

  function bindControls(){
    var zi = $("mapZoomIn"), zo = $("mapZoomOut"), loc = $("mapLocate"), full = $("mapFull");
    if(zi) zi.addEventListener("click", function(){ MAP.instance && MAP.instance.zoomIn(); });
    if(zo) zo.addEventListener("click", function(){ MAP.instance && MAP.instance.zoomOut(); });
    if(full){
      full.setAttribute("data-role", "full");
      full.addEventListener("click", function(){
        if(MAP.isFullscreen) exitFullscreen();
        else enterFullscreen();
      });
    }
    if(loc) loc.addEventListener("click", function(){
      if(!navigator.geolocation){ if(window.showToast) window.showToast("Locatie niet ondersteund"); return; }
      navigator.geolocation.getCurrentPosition(function(p){
        if(MAP.instance) MAP.instance.setView([p.coords.latitude, p.coords.longitude], 8);
      }, function(){
        if(window.showToast) window.showToast("Locatie niet beschikbaar");
      }, {timeout: 8000});
    });
  }

  function bindFilters(){
    document.querySelectorAll(".live-filter").forEach(function(btn){
      btn.addEventListener("click", function(){
        document.querySelectorAll(".live-filter").forEach(function(b){ b.classList.remove("active"); });
        btn.classList.add("active");
        MAP.currentFilter = btn.dataset.cat;
        try { localStorage.setItem("wardesk_map_filter", MAP.currentFilter); }catch(e){}
        renderMarkers();
        renderLiveList();
      });
    });
  }

  function restoreFilter(){
    try {
      var saved = localStorage.getItem("wardesk_map_filter");
      if(saved && ["all","conflict","political","other"].indexOf(saved) >= 0){
        MAP.currentFilter = saved;
        document.querySelectorAll(".live-filter").forEach(function(b){
          b.classList.toggle("active", b.dataset.cat === saved);
        });
      }
    }catch(e){}
  }

  window.__mapRefresh = function(){ fetchEvents(); };
  window.__mapResetView = function(){ if(MAP.instance) MAP.instance.setView([40, 30], 3); };

  function activateMapView(){
    initMap();
    ensureFullscreenClose();
    setTimeout(enterFullscreen, 100);
    if(MAP.instance) setTimeout(function(){ if(MAP.instance) MAP.instance.invalidateSize(); }, 350);
    if(!MAP.events.length) fetchEvents();
    else { renderMarkers(); renderLegend(); renderLiveList(); }
  }

  function stopAutoRefresh(){
    if(MAP.refreshTimer){
      clearInterval(MAP.refreshTimer);
      MAP.refreshTimer = null;
    }
  }

  function hookViewSwitch(){
    document.querySelectorAll(".bottom-tabs .tab").forEach(function(tab){
      tab.addEventListener("click", function(){
        if(tab.dataset.view === "map"){
          setTimeout(activateMapView, 200);
          startAutoRefresh();
        } else {
          if(MAP.isFullscreen) exitFullscreen();
          stopAutoRefresh();
        }
      });
    });
  }

  function startAutoRefresh(){
    stopAutoRefresh();
    MAP.refreshTimer = setInterval(function(){
      if(document.hidden) return;
      var mapTab = document.querySelector('.tab[data-view="map"]');
      if(mapTab && mapTab.classList.contains("active")) fetchEvents();
    }, 300000);
  }

  function initMapModule(){
    injectMapStyles();
    ensureDetailModal();
    ensureFullscreenClose();
    bindControls();
    bindFilters();
    hookViewSwitch();
    restoreFilter();
    startAutoRefresh();

    var themeBtn = $("btnTheme");
    if(themeBtn){
      themeBtn.addEventListener("click", function(){
        markManualTheme();
        setTimeout(updateMetaTheme, 50);
      });
    }

    observeThemeChanges();
    checkTimeMode();
    updateMetaTheme();

    /* v7: managed interval voor tijdmodus — pauzeert op achtergrond */
    if(!MAP._timeModeInterval){
      MAP._timeModeInterval = setInterval(function(){
        if(document.hidden) return;
        checkTimeMode();
      }, 60000);
    }

    var mapTab = document.querySelector('.tab[data-view="map"]');
    var viewMap = document.getElementById("viewMap");
    var isMapActive = (mapTab && mapTab.classList.contains("active")) || (viewMap && !viewMap.hidden);
    if(isMapActive) setTimeout(activateMapView, 400);
  }

  if(document.readyState !== "loading") setTimeout(initMapModule, 600);
  else document.addEventListener("DOMContentLoaded", function(){ setTimeout(initMapModule, 600); });

  window.addEventListener("load", function(){
    setTimeout(function(){
      var mapTab = document.querySelector('.tab[data-view="map"]');
      if(mapTab && mapTab.classList.contains("active") && !MAP.instance) activateMapView();
    }, 1500);
  });

  document.addEventListener("keydown", function(e){
    if(e.key !== "Escape") return;
    if(document.querySelector("#sheet.open")) return;
    var modal = $("wdDetailModal");
    if(modal && modal.classList.contains("show")){
      closeDetail();
    } else if(MAP.isFullscreen){
      exitFullscreen();
    }
  }, true);

  window.MAPAPI = { refresh: fetchEvents, state: MAP };

})();