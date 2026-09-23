/* ============================================================
   WAR DESK v11.15 — Conflictkaart (OpenFreeMap, geen API key)
   - FASE 4 Deel 1: wdLog
   - FASE 4 Deel 2: WDStorage
   - FIX v11.15: prefers-reduced-motion voor marker pulse (B14)
   ============================================================ */

(function(){
  "use strict";

  var $ = function(id){ return document.getElementById(id); };

  var LOG = function(){
    try{ wdLog.info.apply(null, ["[MAP]"].concat(Array.prototype.slice.call(arguments))); }catch(e){}
  };

  LOG("v11.15 geladen — OpenFreeMap tiles + Midden-Oosten filter");

  var LOCATIONS = {
    "mideast": { lat: 31.77, lng: 35.22, country: "Midden-Oosten" },
    "gaza":    { lat: 31.35, lng: 34.31, country: "Gaza" },
    "il":      { lat: 31.77, lng: 35.22, country: "Israël" },
    "iran":    { lat: 35.69, lng: 51.39, country: "Iran" },
    "iraq":    { lat: 33.31, lng: 44.36, country: "Irak" },
    "yemen":   { lat: 15.37, lng: 44.19, country: "Jemen" },
    "qa":      { lat: 25.28, lng: 51.53, country: "Qatar" },
    "sa":      { lat: 24.71, lng: 46.68, country: "Saudi-Arabië" },
    "ae":      { lat: 24.47, lng: 54.37, country: "V.A.E." },
    "eg":      { lat: 30.04, lng: 31.24, country: "Egypte" },
    "sudan":   { lat: 15.55, lng: 32.53, country: "Sudan" }
  };

  var CATEGORY_FILTER = {
    "mideast": "conflict","gaza": "conflict","il": "conflict","iran": "conflict",
    "iraq": "conflict","yemen": "conflict","sudan": "conflict",
    "qa": "political","sa": "political","ae": "political","eg": "political"
  };

  var TYPES = {
    "conflict":  { color: "#e63950", filter: "conflict",  label: "Conflict" },
    "political": { color: "#3b82f6", filter: "political", label: "Politiek" },
    "other":     { color: "#6b7a93", filter: "other",     label: "Overig" }
  };

  var ICONS = {
    conflict:  '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2 L22 21 L2 21 Z"/></svg>',
    political: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2 L22 8 L22 10 L2 10 L2 8 Z M4 12 L4 20 L8 20 L8 12 Z M10 12 L10 20 L14 20 L14 12 Z M16 12 L16 20 L20 20 L20 12 Z M2 20 L22 20 L22 22 L2 22 Z"/></svg>',
    other:     '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2 L22 12 L12 22 L2 12 Z"/></svg>'
  };

  function iconFor(filter){
    if(filter === "conflict") return ICONS.conflict;
    if(filter === "political") return ICONS.political;
    return ICONS.other;
  }

  var MAP = {
    instance: null, cluster: null, tileLayers: {}, events: [],
    currentFilter: "all", refreshTimer: null, isFullscreen: false,
    currentTheme: "dark", themeObserver: null, _timeModeInterval: null,
    currentDetailEvent: null, _lastNewsCount: 0, _waitTimer: null, _waitTries: 0
  };

  var TILES = {
    dark: { style: "https://tiles.openfreemap.org/styles/dark", attribution: "© OpenFreeMap © OpenMapTiles © OpenStreetMap" },
    light: { style: "https://tiles.openfreemap.org/styles/positron", attribution: "© OpenFreeMap © OpenMapTiles © OpenStreetMap" }
  };

  function detectTheme(){ return document.body.classList.contains("light") ? "light" : "dark"; }

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

    if(MAP.tileLayers.dark && MAP.instance.hasLayer(MAP.tileLayers.dark)){
      MAP.instance.removeLayer(MAP.tileLayers.dark);
    }
    if(MAP.tileLayers.light && MAP.instance.hasLayer(MAP.tileLayers.light)){
      MAP.instance.removeLayer(MAP.tileLayers.light);
    }

    if(!MAP.tileLayers[theme]){
      if(L.maplibreGL){
        MAP.tileLayers[theme] = L.maplibreGL({ style: cfg.style, attribution: cfg.attribution });
      } else {
        LOG("⚠️ MapLibre GL niet geladen — val terug op OSM raster tiles");
        MAP.tileLayers[theme] = L.tileLayer(
          "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          { maxZoom: 19, attribution: "© OpenStreetMap" }
        );
      }
    }
    MAP.tileLayers[theme].addTo(MAP.instance);
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

  function checkTimeMode(){
    if(document.hidden) return;
    if(!window.CONFIG || !CONFIG.themeAutoSwitch) return;
    var manualUntil = 0;
    try {
      var stored = window.WDStorage ? WDStorage.get("theme_manual_until", "0") : "0";
      manualUntil = parseInt(stored, 10) || 0;
    }catch(e){}
    if(Date.now() < manualUntil) return;
    var hour = new Date().getHours();
    var shouldBeLight = hour >= CONFIG.themeLightStart && hour < CONFIG.themeDarkStart;
    var isLight = document.body.classList.contains("light");
    if(shouldBeLight !== isLight){
      document.documentElement.classList.toggle("light", shouldBeLight);
      document.body.classList.toggle("light", shouldBeLight);
      if(window.WDStorage) WDStorage.set("theme", shouldBeLight ? "light" : "dark");
      updateMetaTheme();
    }
  }

  function markManualTheme(){
    try{
      var until = Date.now() + 8 * 3600 * 1000;
      if(window.WDStorage) WDStorage.set("theme_manual_until", until);
    }catch(e){}
  }

  /* ============================================================
     B14 FIX: prefers-reduced-motion voor marker pulse
     ============================================================ */
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
      "@media (prefers-reduced-motion: reduce){.wd-marker-pulse{animation:none!important;opacity:.15!important}}" +
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
      "@media (prefers-reduced-motion: reduce){.wd-marker-pulse,.wd-map-close,.map-ctrl{transition:none!important;animation:none!important}}";
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
          '<button class="wd-detail-btn primary" id="wdDetailShowOnMap" aria-label="Toon op kaart">Toon op kaart</button>' +
          '<button class="wd-detail-btn" id="wdDetailCloseBtn">Sluiten</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.addEventListener("click", function(e){
      if(e.target === modal) closeDetail();
    });
    $("wdDetailClose").addEventListener("click", closeDetail);
    $("wdDetailCloseBtn").addEventListener("click", closeDetail);
    $("wdDetailShowOnMap").addEventListener("click", function(){
      if(MAP.currentDetailEvent) showEventOnMap(MAP.currentDetailEvent);
    });
  }

  function openDetail(event){
    ensureDetailModal();
    MAP.currentDetailEvent = event;
    var color = event.typeConfig.color;
    $("wdDetailType").textContent = event.typeConfig.label;
    $("wdDetailType").style.background = color;
    $("wdDetailMeta").textContent = (event.country || "Onbekend") + " · " + timeAgo(event.date) + " · " + (event.source || "");
    $("wdDetailText").textContent = event.fullDescription || event.title || "(geen beschrijving)";
    $("wdDetailModal").classList.add("show");
  }

  function closeDetail(){
    var modal = $("wdDetailModal");
    if(modal) modal.classList.remove("show");
  }

  function showEventOnMap(event){
    if(!event || !MAP.instance) return;
    closeDetail();
    if(MAP.isFullscreen) exitFullscreen();
    setTimeout(function(){
      if(MAP.instance) MAP.instance.setView([event.lat, event.lng], 6);
    }, 300);
  }

  function buildEventsFromNews(){
    if(!window.State || !State.items || !State.items.length) return null;

    LOG("Bouw events uit " + State.items.length + " nieuwsartikelen (filter: Midden-Oosten)");

    var byCat = {};
    var totalMatched = 0;

    State.items.forEach(function(it){
      var cat = it.cat || "";
      if(!LOCATIONS[cat]) return;
      if(!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(it);
      totalMatched++;
    });

    LOG("Matched: " + totalMatched + " items, categorieën: " + Object.keys(byCat).join(", "));

    if(!Object.keys(byCat).length){
      LOG("⚠️ Geen items met Midden-Oosten cats — items hebben cats: " +
        (State.items.slice(0, 10).map(function(it){ return it.cat; }).join(",")));
    }

    var events = [];
    Object.keys(byCat).forEach(function(cat){
      var loc = LOCATIONS[cat];
      var filter = CATEGORY_FILTER[cat] || "other";
      var typeConfig = TYPES[filter];
      var items = byCat[cat];

      items.sort(function(a, b){
        var ta = new Date(a.date).getTime() || 0;
        var tb = new Date(b.date).getTime() || 0;
        return tb - ta;
      });

      var top = items.slice(0, 2);

      top.forEach(function(it, index){
        var offset = index * 0.15; 

        events.push({
          id: "news-" + cat + "-" + index,
          lat: loc.lat + offset, lng: loc.lng + offset,
          title: it.title || "Geen titel",
          fullDescription: "Land: " + loc.country + "\nCategorie: " + cat + "\n\n" + (it.title || "?") + "\n\n" + (it.description || ""),
          type: cat, typeConfig: typeConfig, country: loc.country,
          date: it.date || new Date().toISOString(),
          url: it.link || "", source: it.source || "",
          confidence: "HIGH", count: 1
        });
      });
    });

    LOG("Events gegenereerd: " + events.length);
    return events;
  }

  function refreshFromNews(){
    var events = buildEventsFromNews();
    if(events === null){ LOG("State.items nog niet beschikbaar"); return false; }
    if(!events.length){
      LOG("Geen Midden-Oosten events gevonden in nieuwsfeed");
      var list = $("liveList");
      if(list) list.innerHTML = '<div class="live-empty">Geen Midden-Oosten nieuws beschikbaar.</div>';
      return true;
    }
    MAP.events = events;
    var statEl = $("statEvents");
    if(statEl) statEl.textContent = events.length;
    renderMarkers();
    renderLegend();
    renderLiveList();
    LOG("✅ " + events.length + " events op kaart");
    return true;
  }

  function waitForNewsAndRefresh(){
    if(MAP._waitTimer) clearInterval(MAP._waitTimer);
    MAP._waitTries = 0;
    
    function check(){
      MAP._waitTries++;
      if(window.State && State.items && State.items.length){
        clearInterval(MAP._waitTimer);
        MAP._waitTimer = null;
        LOG("Nieuws binnen (" + State.items.length + " items) → kaart vullen");
        refreshFromNews();
        MAP._lastNewsCount = State.items.length;
      } else if(MAP._waitTries > 30){
        clearInterval(MAP._waitTimer);
        MAP._waitTimer = null;
        LOG("Timeout na 30s — nieuws nog steeds niet beschikbaar");
        var list = $("liveList");
        if(list) list.innerHTML = '<div class="live-empty">Wachten op nieuws...</div>';
      }
    }
    
    if(window.State && State.items && State.items.length){
      refreshFromNews();
      MAP._lastNewsCount = State.items.length;
    } else {
      LOG("State.items leeg — wacht op nieuws...");
      MAP._waitTimer = setInterval(check, 1000);
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
        iconSize: [16, 16], iconAnchor: [8, 8], popupAnchor: [0, -10]
      });
      var marker = L.marker([e.lat, e.lng], {icon: icon});
      var popupHtml =
        '<div class="pop-cat" style="--cat-color:' + color + '">' + e.typeConfig.label + '</div>' +
        '<div class="pop-title">' + escapeHtml(e.title) + '</div>' +
        '<div class="pop-meta">' + escapeHtml(e.country || "?") + '</div>' +
        '<button class="pop-more" data-id="' + escapeHtml(String(e.id)) + '">Details →</button>';
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
    LOG("Markers gerenderd: " + markers.length);
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
    if(countEl) countEl.textContent = filtered.length;
    if(!filtered.length){
      list.innerHTML = '<div class="live-empty">Geen events in deze categorie</div>';
      return;
    }
    list.innerHTML = filtered.map(function(e){
      var color = e.typeConfig.color;
      return '<div class="live-event" data-id="' + escapeHtml(String(e.id)) + '" style="--cat-color:' + color + '">' +
        '<div class="live-event-body">' +
        '<div class="live-event-title">' + escapeHtml(e.title) + '</div>' +
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
    if(diff < 60) return "nu";
    if(diff < 3600) return Math.floor(diff / 60) + " min";
    if(diff < 86400) return Math.floor(diff / 3600) + " u";
    return Math.floor(diff / 86400) + " d";
  }

  function initMap(){
    if(MAP.instance || typeof L === "undefined") return;
    var mapEl = $("map");
    if(!mapEl) return;
    LOG("Init Leaflet map (OpenFreeMap)");
    MAP.instance = L.map("map", {
      center: [29.5, 42.0], zoom: 4, minZoom: 2, maxZoom: 18,
      worldCopyJump: true, zoomControl: false, attributionControl: false,
      preferCanvas: true
    });
    MAP.currentTheme = detectTheme();
    switchTile(MAP.currentTheme);
    MAP.cluster = L.markerClusterGroup({
      maxClusterRadius: 45, spiderfyOnMaxZoom: true, showCoverageOnHover: false,
      zoomToBoundsOnClick: true, disableClusteringAtZoom: 11,
      chunkedLoading: true, chunkInterval: 100, chunkDelay: 50
    });
    MAP.instance.addLayer(MAP.cluster);
    observeThemeChanges();
    LOG("Map klaar");
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
        if(window.WDStorage) WDStorage.set("map_filter", MAP.currentFilter);
        renderMarkers();
        renderLiveList();
      });
    });
  }

  function restoreFilter(){
    try {
      var saved = window.WDStorage ? WDStorage.get("map_filter") : null;
      if(saved && ["all","conflict","political","other"].indexOf(saved) >= 0){
        MAP.currentFilter = saved;
        document.querySelectorAll(".live-filter").forEach(function(b){
          b.classList.toggle("active", b.dataset.cat === saved);
        });
      }
    }catch(e){}
  }

  window.__mapRefresh = function(){
    LOG("Handmatige refresh");
    MAP._lastNewsCount = 0;
    waitForNewsAndRefresh();
  };
  window.__mapResetView = function(){ if(MAP.instance) MAP.instance.setView([29.5, 42.0], 4); };

  function activateMapView(){
    LOG("activateMapView");
    initMap();
    ensureFullscreenClose();
    if(MAP.instance) setTimeout(function(){ if(MAP.instance) MAP.instance.invalidateSize(); }, 350);
    waitForNewsAndRefresh();
  }

  function stopAutoRefresh(){
    if(MAP.refreshTimer){ clearInterval(MAP.refreshTimer); MAP.refreshTimer = null; }
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
      if(!window.State) return;
      var currentCount = State.items.length;
      if(currentCount !== MAP._lastNewsCount && currentCount > 0){
        MAP._lastNewsCount = currentCount;
        LOG("Nieuwsfeed gewijzigd (" + currentCount + ") → kaart updaten");
        var mapTab = document.querySelector('.tab[data-view="map"]');
        if(mapTab && mapTab.classList.contains("active")) refreshFromNews();
      }
    }, 5000);
  }

  function initMapModule(){
    LOG("initMapModule");
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

  window.MAPAPI = { refresh: refreshFromNews, state: MAP };

  wdLog.info("[WAR DESK] map-v11.10.js v11.15 geladen (OpenFreeMap tiles)");
})();