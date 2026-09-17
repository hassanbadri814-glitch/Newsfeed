/* ============================================================
   WAR DESK v3.9 — Conflictkaart (Esri + labels, subtiele modal)
   ============================================================ */

(function(){
  "use strict";

  var $ = function(id){ return document.getElementById(id); };
  var LOG = function(){ try{ console.log.apply(console, ["[MAP]"].concat(Array.prototype.slice.call(arguments))); }catch(e){} };

  LOG("v3.9 geladen");

  var MAP = {
    instance: null,
    cluster: null,
    tileLayer: null,
    labelLayer: null,
    events: [],
    currentFilter: "all",
    refreshTimer: null,
    worker: "https://newsfeed2.hassanbadri814.workers.dev/?url=",
    api: "https://war-tracker.com/api/v1/events?limit=100",
    detailCache: {}
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

  /* ===== INJECT STYLES ===== */
  function injectMapStyles(){
    if(document.getElementById("wdMapStyles")) return;
    var s = document.createElement("style");
    s.id = "wdMapStyles";
    s.textContent =
      /* --- Leaflet attribution onzichtbaar --- */
      ".leaflet-control-attribution{display:none!important}" +
      ".leaflet-container{background:#0a101c!important}" +

      /* --- Marker --- */
      ".wd-marker{background:transparent!important;border:none!important}" +
      ".wd-marker-inner{position:relative;width:16px;height:16px;display:grid;place-items:center}" +
      ".wd-marker-icon{width:14px;height:14px;display:grid;place-items:center;position:relative;z-index:2;" +
        "filter:drop-shadow(0 1px 2px rgba(0,0,0,.85)) drop-shadow(0 0 3px currentColor);}" +
      ".wd-marker-icon svg{width:100%;height:100%;display:block;" +
        "stroke:#070c16;stroke-width:1.6;stroke-linejoin:round;stroke-linecap:round;}" +
      ".wd-marker-pulse{position:absolute;inset:0;border-radius:50%;background:currentColor;opacity:.22;z-index:1;" +
        "animation:wdMarkerPulse 2.6s ease-out infinite}" +
      "@keyframes wdMarkerPulse{0%{transform:scale(.5);opacity:.35}100%{transform:scale(2.2);opacity:0}}" +

      /* --- Cluster klein (18/22/26) --- */
      ".marker-cluster-small,.marker-cluster-medium,.marker-cluster-large{background:transparent!important}" +
      ".marker-cluster-small div,.marker-cluster-medium div,.marker-cluster-large div{" +
        "background:linear-gradient(135deg,#8a5c26,#e2a857)!important;" +
        "color:#070c16!important;font-weight:800!important;" +
        "border:1px solid rgba(255,255,255,.85)!important;" +
        "box-shadow:0 1px 3px rgba(0,0,0,.55),0 0 6px rgba(226,168,87,.28)!important;" +
        "display:flex!important;align-items:center!important;justify-content:center!important;" +
        "font-family:Inter,sans-serif!important;" +
      "}" +
      ".marker-cluster-small, .marker-cluster-small div{width:18px!important;height:18px!important}" +
      ".marker-cluster-small{margin-left:-9px!important;margin-top:-9px!important}" +
      ".marker-cluster-medium, .marker-cluster-medium div{width:22px!important;height:22px!important}" +
      ".marker-cluster-medium{margin-left:-11px!important;margin-top:-11px!important}" +
      ".marker-cluster-large, .marker-cluster-large div{width:26px!important;height:26px!important}" +
      ".marker-cluster-large{margin-left:-13px!important;margin-top:-13px!important}" +
      ".marker-cluster div span{font-size:.56rem!important;line-height:1!important;letter-spacing:-.02em!important}" +

      /* --- Detail modal: subtieler --- */
      ".wd-detail-box{" +
        "background:linear-gradient(180deg,#0f1728,#0a101c)!important;" +
        "border:1px solid rgba(255,255,255,.06)!important;" +
        "box-shadow:0 30px 80px -30px rgba(0,0,0,.95)!important;" +
      "}" +
      ".wd-detail-head{" +
        "border-bottom:1px solid rgba(255,255,255,.05)!important;" +
      "}" +
      ".wd-detail-type{" +
        "box-shadow:0 0 12px rgba(0,0,0,.4);" +
      "}" +
      ".wd-detail-close{" +
        "background:rgba(255,255,255,.04)!important;" +
        "border:1px solid rgba(255,255,255,.08)!important;" +
      "}" +
      ".wd-detail-meta{" +
        "color:#8a94a8!important;" +
        "border-bottom:1px solid rgba(255,255,255,.05)!important;" +
      "}" +
      ".wd-detail-text{" +
        "color:#e6ebf5!important;" +
        "font-size:.9rem!important;" +
        "line-height:1.65!important;" +
      "}" +
      ".wd-detail-foot{" +
        "border-top:1px solid rgba(255,255,255,.05)!important;" +
        "background:rgba(0,0,0,.2)!important;" +
      "}" +
      ".wd-detail-btn{" +
        "background:transparent!important;" +
        "border:1px solid rgba(255,255,255,.08)!important;" +
        "color:#8a94a8!important;" +
        "font-weight:600!important;" +
      "}" +
      ".wd-detail-btn:hover{" +
        "border-color:rgba(255,255,255,.15)!important;" +
        "color:#e6ebf5!important;" +
      "}" +
      ".wd-detail-btn.primary{" +
        "background:rgba(226,168,87,.1)!important;" +
        "border:1px solid rgba(226,168,87,.28)!important;" +
        "color:#e2a857!important;" +
      "}" +
      ".wd-detail-btn.primary:hover{" +
        "background:rgba(226,168,87,.16)!important;" +
        "border-color:rgba(226,168,87,.45)!important;" +
      "}";
    document.head.appendChild(s);
  }

  /* ===== DETAIL MODAL ===== */
  function ensureDetailModal(){
    var existing = $("wdDetailModal");
    if(existing) return;

    var modal = document.createElement("div");
    modal.id = "wdDetailModal";
    modal.className = "wd-detail-modal";
    /* Geen "Open bron"-knop meer — alleen Sluiten */
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

  function openDetail(event){
    ensureDetailModal();
    var modal = $("wdDetailModal");
    var color = event.typeConfig.color;

    $("wdDetailType").textContent = event.typeConfig.label;
    $("wdDetailType").style.background = color;
    $("wdDetailMeta").textContent =
      (event.country || "Onbekend") + " · " +
      timeAgo(event.date) + " · " +
      "confidence " + (event.confidence || "LOW");

    var textEl = $("wdDetailText");
    textEl.textContent = event.fullDescription || event.title || "(geen beschrijving)";
    textEl.style.transition = "opacity .2s";

    modal.classList.add("show");
    loadFullText(event, textEl);
  }

  async function loadFullText(event, textEl){
    if(!textEl) return;
    if(MAP.detailCache[event.id]){
      textEl.textContent = MAP.detailCache[event.id];
      return;
    }
    textEl.style.opacity = ".55";
    try{
      var detailUrl = "https://war-tracker.com/api/v1/events/" + encodeURIComponent(event.id);
      var ctrl = new AbortController();
      var timer = setTimeout(function(){ ctrl.abort(); }, 15000);
      var r = await fetch(MAP.worker + encodeURIComponent(detailUrl), {signal: ctrl.signal});
      clearTimeout(timer);
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

      MAP.detailCache[event.id] = fullText;
      if(textEl.textContent !== fullText) textEl.textContent = fullText;
      textEl.style.opacity = "1";
    }catch(e){
      LOG("Detail fetch fout:", e.message);
      textEl.style.opacity = "1";
    }
  }

  function closeDetail(){
    var modal = $("wdDetailModal");
    if(modal) modal.classList.remove("show");
  }

  /* ===== DATA ===== */
  async function fetchEvents(){
    LOG("Fetch events...");
    var list = $("liveList");
    if(list && !MAP.events.length){
      list.innerHTML = '<div class="live-empty">Events worden geladen...</div>';
    }

    try{
      var ctrl = new AbortController();
      var timer = setTimeout(function(){ ctrl.abort(); }, 30000);
      var r = await fetch(MAP.worker + encodeURIComponent(MAP.api), {signal: ctrl.signal});
      clearTimeout(timer);
      if(!r.ok) throw new Error("HTTP " + r.status);
      var data = await r.json();

      var events = (data && data.events) ? data.events : (Array.isArray(data) ? data : []);
      LOG(events.length, "events ontvangen");

      var withCoords = events.filter(function(e){
        return typeof e.lat === "number" && typeof e.lng === "number" &&
               isFinite(e.lat) && isFinite(e.lng) &&
               e.lat !== 0 && e.lng !== 0;
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

  /* ===== MARKERS ===== */
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
        '<div class="pop-meta">' +
        escapeHtml(e.country || "?") + ' · ' + timeAgo(e.date) + '</div>' +
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

  /* ===== LEGEND ===== */
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

  /* ===== LIVE LIST ===== */
  function renderLiveList(){
    var list = $("liveList");
    var countEl = $("liveCount");
    if(!list) return;

    var filtered = MAP.events.filter(function(e){
      if(MAP.currentFilter === "all") return true;
      return e.typeConfig.filter === MAP.currentFilter;
    });

    filtered.sort(function(a, b){
      return new Date(b.date) - new Date(a.date);
    });

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

  /* ===== HELPERS ===== */
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

  /* ===== KAART ===== */
  function initMap(){
    if(MAP.instance || typeof L === "undefined") return;
    var mapEl = $("map");
    if(!mapEl) return;

    MAP.instance = L.map("map", {
      center: [40, 30],
      zoom: 3,
      minZoom: 2,
      maxZoom: 16,
      worldCopyJump: true,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true
    });

    /* Esri Dark Gray Base — donkere ondergrond */
    MAP.tileLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 16, crossOrigin: true }
    ).addTo(MAP.instance);

    /* Esri Dark Gray Reference — labels van steden/landen/wegen OVER de base */
    MAP.labelLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 16, crossOrigin: true, opacity: 0.85 }
    ).addTo(MAP.instance);

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
  }

  function bindControls(){
    var zi = $("mapZoomIn"), zo = $("mapZoomOut"), loc = $("mapLocate"), full = $("mapFull");
    if(zi) zi.addEventListener("click", function(){ MAP.instance && MAP.instance.zoomIn(); });
    if(zo) zo.addEventListener("click", function(){ MAP.instance && MAP.instance.zoomOut(); });
    if(full) full.addEventListener("click", function(){
      var wrap = document.querySelector(".map-wrap");
      if(wrap) wrap.classList.toggle("fullscreen");
      if(MAP.instance) setTimeout(function(){ if(MAP.instance) MAP.instance.invalidateSize(); }, 250);
    });
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
        renderMarkers();
        renderLiveList();
      });
    });
  }

  window.__mapRefresh = function(){ fetchEvents(); };
  window.__mapResetView = function(){ if(MAP.instance) MAP.instance.setView([40, 30], 3); };

  function activateMapView(){
    initMap();
    if(MAP.instance) setTimeout(function(){ if(MAP.instance) MAP.instance.invalidateSize(); }, 150);
    if(!MAP.events.length) fetchEvents();
    else { renderMarkers(); renderLegend(); renderLiveList(); }
  }

  function hookViewSwitch(){
    document.querySelectorAll(".bottom-tabs .tab").forEach(function(tab){
      tab.addEventListener("click", function(){
        if(tab.dataset.view === "map") setTimeout(activateMapView, 200);
      });
    });
  }

  function startAutoRefresh(){
    clearInterval(MAP.refreshTimer);
    MAP.refreshTimer = setInterval(function(){
      if(document.hidden) return;
      var mapTab = document.querySelector('.tab[data-view="map"]');
      if(mapTab && mapTab.classList.contains("active")) fetchEvents();
    }, 300000);
  }

  window.addEventListener("DOMContentLoaded", function(){
    setTimeout(function(){
      injectMapStyles();
      ensureDetailModal();
      bindControls();
      bindFilters();
      hookViewSwitch();
      startAutoRefresh();

      var mapTab = document.querySelector('.tab[data-view="map"]');
      var viewMap = document.getElementById("viewMap");
      var isMapActive = (mapTab && mapTab.classList.contains("active")) || (viewMap && !viewMap.hidden);
      if(isMapActive) setTimeout(activateMapView, 400);
    }, 600);
  });

  window.addEventListener("load", function(){
    setTimeout(function(){
      var mapTab = document.querySelector('.tab[data-view="map"]');
      if(mapTab && mapTab.classList.contains("active") && !MAP.instance) activateMapView();
    }, 1500);
  });

  document.addEventListener("keydown", function(e){
    if(e.key === "Escape") closeDetail();
  });

  window.MAPAPI = { refresh: fetchEvents, state: MAP };

})();