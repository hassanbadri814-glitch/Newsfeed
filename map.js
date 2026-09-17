/* ============================================================
   WAR DESK v3.3 — Live Conflictkaart
   - OSM Humanitarian tiles (Engelse labels)
   - Rood/blauw/grijs kleurschema
   - Kleinere, strakkere markers
   - 2 categorieën: Conflict & Politiek
   ============================================================ */

(function(){
  "use strict";

  var $ = function(id){ return document.getElementById(id); };
  var LOG = function(){ try{ console.log.apply(console, ["[MAP]"].concat(Array.prototype.slice.call(arguments))); }catch(e){} };

  LOG("v3.3 geladen");

  var MAP = {
    instance: null,
    cluster: null,
    tileLayer: null,
    events: [],
    currentFilter: "all",
    refreshTimer: null,
    worker: "https://newsfeed2.hassanbadri814.workers.dev/?url=",
    api: "https://war-tracker.com/api/v1/events?limit=100"
  };

  /* ===== 3-KLEUREN SCHEMA ===== */
  var TYPES = {
    "military strike":       { color: "#e63950", filter: "conflict",  label: "Aanval" },
    "ground clash":          { color: "#e63950", filter: "conflict",  label: "Gevecht" },
    "security incident":     { color: "#e63950", filter: "conflict",  label: "Incident" },
    "political development": { color: "#3b82f6", filter: "political", label: "Politiek" },
    "other":                 { color: "#6b7a93", filter: "other",     label: "Overig" },
    "na":                    { color: "#6b7a93", filter: "other",     label: "Onbekend" }
  };

  function getType(t){
    if(!t) return TYPES["na"];
    var key = String(t).toLowerCase().trim();
    return TYPES[key] || TYPES["na"];
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

      LOG(withCoords.length, "events met coördinaten");

      MAP.events = withCoords.map(function(e){
        var type = getType(e.event_type);
        return {
          id: e.id,
          lat: e.lat,
          lng: e.lng,
          title: (e.description || "Event").slice(0, 200),
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

      LOG("Klaar:", MAP.events.length, "events op kaart");
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
      var icon = L.divIcon({
        className: "custom-event-marker",
        html: '<div class="event-marker" style="color:' + color + '">' +
              '<span class="pulse"></span><span class="dot"></span></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });
      var marker = L.marker([e.lat, e.lng], {icon: icon});

      var popupHtml =
        '<div class="pop-cat" style="--cat-color:' + color + '">' + e.typeConfig.label + '</div>' +
        '<div class="pop-title">' + escapeHtml(e.title.slice(0, 150)) + '</div>' +
        '<div class="pop-meta">' +
        escapeHtml(e.country || "?") + ' · ' +
        timeAgo(e.date) + ' · ' +
        e.confidence + '</div>' +
        (e.url ? '<a class="pop-link" href="' + escapeHtml(e.url) + '" target="_blank" rel="noopener">Lees bron →</a>' : "");

      marker.bindPopup(popupHtml);
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
      return '<a class="live-event" style="--cat-color:' + color + '" ' +
        (e.url ? 'href="' + escapeHtml(e.url) + '" target="_blank" rel="noopener"' : "") + '>' +
        '<div class="live-event-body">' +
        '<div class="live-event-title">' + escapeHtml(e.title) + '</div>' +
        '<div class="live-event-meta">' +
        '<span class="live-event-loc">' + escapeHtml(e.country || "—") + '</span>' +
        '<span>·</span>' +
        '<span>' + timeAgo(e.date) + '</span>' +
        '<span class="live-event-cat" style="--cat-color:' + color + '">' + e.typeConfig.label + '</span>' +
        '</div></div></a>';
    }).join("");
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
      maxZoom: 18,
      worldCopyJump: true,
      zoomControl: false,
      attributionControl: true
    });

    /* OSM Humanitarian — Engelse labels internationaal */
    MAP.tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
      maxZoom: 19,
      subdomains: "abc",
      attribution: '&copy; OpenStreetMap · Tiles: HOT'
    }).addTo(MAP.instance);

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

    LOG("Kaart geïnitialiseerd");
  }

  /* ===== CONTROLS ===== */
  function bindControls(){
    var zi = $("mapZoomIn");
    var zo = $("mapZoomOut");
    var loc = $("mapLocate");
    var full = $("mapFull");

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

  /* ===== FILTERS ===== */
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

  /* ===== REFRESH ===== */
  window.__mapRefresh = function(){ fetchEvents(); };
  window.__mapResetView = function(){ if(MAP.instance) MAP.instance.setView([40, 30], 3); };

  /* ===== VIEW SWITCH ===== */
  function activateMapView(){
    initMap();
    if(MAP.instance){
      setTimeout(function(){ if(MAP.instance) MAP.instance.invalidateSize(); }, 150);
    }
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

  /* ===== AUTO REFRESH ===== */
  function startAutoRefresh(){
    clearInterval(MAP.refreshTimer);
    MAP.refreshTimer = setInterval(function(){
      if(document.hidden) return;
      var mapTab = document.querySelector('.tab[data-view="map"]');
      if(mapTab && mapTab.classList.contains("active")) fetchEvents();
    }, 300000);
  }

  /* ===== START ===== */
  window.addEventListener("DOMContentLoaded", function(){
    setTimeout(function(){
      bindControls();
      bindFilters();
      hookViewSwitch();
      startAutoRefresh();

      var mapTab = document.querySelector('.tab[data-view="map"]');
      var viewMap = document.getElementById("viewMap");
      var isMapActive = (mapTab && mapTab.classList.contains("active")) || (viewMap && !viewMap.hidden);
      if(isMapActive) setTimeout(activateMapView, 400);

      LOG("Klaar");
    }, 600);
  });

  window.addEventListener("load", function(){
    setTimeout(function(){
      var mapTab = document.querySelector('.tab[data-view="map"]');
      if(mapTab && mapTab.classList.contains("active") && !MAP.instance) activateMapView();
    }, 1500);
  });

  window.MAPAPI = {
    refresh: fetchEvents,
    state: MAP
  };

})();