/* ============================================================
   WAR DESK v3.2 — Live Conflictkaart
   Bronnen: War-Tracker + GDELT
   Kaart: OpenFreeMap (geen API key)
   ============================================================ */

(function(){
  "use strict";

  var $ = function(id){ return document.getElementById(id); };
  var LOG = function(){ try{ console.log.apply(console, ["[MAP]"].concat(Array.prototype.slice.call(arguments))); }catch(e){} };

  LOG("v3.2 geladen");

  /* ===== STATE ===== */
  var MAP = {
    instance: null,
    cluster: null,
    tileLayer: null,
    events: [],
    currentCat: "all",
    lastUpdate: 0,
    refreshTimer: null,
    proxy: "https://nieuwsproxy.hassanbadri814.workers.dev/?url="
  };

  /* ===== CATEGORIEËN ===== */
  var CATS = {
    mideast:  { label: "Midden-Oosten", color: "#e63950", icon: "🔥" },
    ukraine:  { label: "Oekraïne",      color: "#3b82f6", icon: "🇺🇦" },
    africa:   { label: "Afrika",        color: "#f59e0b", icon: "🌍" },
    asia:     { label: "Azië",          color: "#a855f7", icon: "🏯" },
    europe:   { label: "Europa",        color: "#14b8a6", icon: "🇪🇺" },
    americas: { label: "Amerika",       color: "#8b5cf6", icon: "🌎" },
    world:    { label: "Wereld",        color: "#64748b", icon: "🌐" }
  };

  /* ===== LAND-NAAR-CATEGORIE ===== */
  var COUNTRY_CAT = {
    IL:"mideast", PS:"mideast", LB:"mideast", SY:"mideast", IR:"mideast", IQ:"mideast",
    YE:"mideast", SA:"mideast", AE:"mideast", QA:"mideast", JO:"mideast", KW:"mideast",
    TR:"mideast", EG:"mideast", BH:"mideast", OM:"mideast",
    UA:"ukraine", RU:"ukraine", BY:"ukraine", MD:"ukraine",
    SD:"africa", LY:"africa", ET:"africa", SO:"africa", ML:"africa", NG:"africa",
    CD:"africa", CF:"africa", BF:"africa", NE:"africa", TD:"africa", CM:"africa",
    ZA:"africa", KE:"africa", TZ:"africa", MZ:"africa", ZW:"africa", AO:"africa",
    MA:"africa", DZ:"africa", TN:"africa", MR:"africa",
    CN:"asia", IN:"asia", PK:"asia", AF:"asia", BD:"asia", MM:"asia", TH:"asia",
    VN:"asia", PH:"asia", ID:"asia", MY:"asia", SG:"asia", JP:"asia", KR:"asia",
    KP:"asia", TW:"asia", LK:"asia", NP:"asia", KH:"asia", LA:"asia",
    GB:"europe", FR:"europe", DE:"europe", IT:"europe", ES:"europe", PT:"europe",
    NL:"europe", BE:"europe", PL:"europe", RO:"europe", GR:"europe", SE:"europe",
    NO:"europe", FI:"europe", DK:"europe", IE:"europe", AT:"europe", CH:"europe",
    CZ:"europe", HU:"europe", RS:"europe", HR:"europe", BG:"europe", SK:"europe",
    US:"americas", CA:"americas", MX:"americas", BR:"americas", AR:"americas",
    CO:"americas", VE:"americas", CL:"americas", PE:"americas", CU:"americas",
    HT:"americas", DO:"americas", GT:"americas", HN:"americas", SV:"americas",
    NI:"americas", CR:"americas", PA:"americas", EC:"americas", BO:"americas",
    PY:"americas", UY:"americas"
  };

  /* ===== LAND-NAAR-NAAM (westerse tekens) ===== */
  var COUNTRY_NAME = {
    IL:"Israël", PS:"Palestina", LB:"Libanon", SY:"Syrië", IR:"Iran", IQ:"Irak",
    YE:"Jemen", SA:"Saoedi-Arabië", AE:"VAE", QA:"Qatar", JO:"Jordanië", KW:"Koeweit",
    TR:"Turkije", EG:"Egypte", BH:"Bahrein", OM:"Oman",
    UA:"Oekraïne", RU:"Rusland", BY:"Wit-Rusland", MD:"Moldavië",
    SD:"Soedan", LY:"Libië", ET:"Ethiopië", SO:"Somalië", ML:"Mali", NG:"Nigeria",
    CD:"Congo", CF:"Centraal-Afrikaanse Rep.", BF:"Burkina Faso", NE:"Niger",
    TD:"Tsjaad", CM:"Kameroen", ZA:"Zuid-Afrika", KE:"Kenia", TZ:"Tanzania",
    MZ:"Mozambique", ZW:"Zimbabwe", AO:"Angola", MA:"Marokko", DZ:"Algerije",
    TN:"Tunesië", MR:"Mauritanië",
    CN:"China", IN:"India", PK:"Pakistan", AF:"Afghanistan", BD:"Bangladesh",
    MM:"Myanmar", TH:"Thailand", VN:"Vietnam", PH:"Filipijnen", ID:"Indonesië",
    MY:"Maleisië", SG:"Singapore", JP:"Japan", KR:"Zuid-Korea", KP:"Noord-Korea",
    TW:"Taiwan", LK:"Sri Lanka", NP:"Nepal", KH:"Cambodja", LA:"Laos",
    GB:"Verenigd Koninkrijk", FR:"Frankrijk", DE:"Duitsland", IT:"Italië",
    ES:"Spanje", PT:"Portugal", NL:"Nederland", BE:"België", PL:"Polen",
    RO:"Roemenië", GR:"Griekenland", SE:"Zweden", NO:"Noorwegen", FI:"Finland",
    DK:"Denemarken", IE:"Ierland", AT:"Oostenrijk", CH:"Zwitserland",
    CZ:"Tsjechië", HU:"Hongarije", RS:"Servië", HR:"Kroatië", BG:"Bulgarije",
    SK:"Slowakije",
    US:"Verenigde Staten", CA:"Canada", MX:"Mexico", BR:"Brazilië",
    AR:"Argentinië", CO:"Colombia", VE:"Venezuela", CL:"Chili", PE:"Peru",
    CU:"Cuba", HT:"Haïti", DO:"Dominicaanse Rep.", GT:"Guatemala",
    HN:"Honduras", SV:"El Salvador", NI:"Nicaragua", CR:"Costa Rica",
    PA:"Panama", EC:"Ecuador", BO:"Bolivia", PY:"Paraguay", UY:"Uruguay"
  };

  /* ===== CATEGORIE HELPERS ===== */
  function getCategory(countryCode, text){
    if(countryCode && COUNTRY_CAT[countryCode]) return COUNTRY_CAT[countryCode];
    var t = (text || "").toLowerCase();
    if(/\b(gaza|israel|palestin|hamas|lebanon|syria|iran|iraq|yemen|houthi|hezbollah|mideast)\b/.test(t)) return "mideast";
    if(/\b(ukraine|russia|putin|zelensky|kyiv|moscow|donbas)\b/.test(t)) return "ukraine";
    if(/\b(sudan|libya|ethiopia|somalia|mali|nigeria|congo|darfur)\b/.test(t)) return "africa";
    if(/\b(china|india|pakistan|afghanistan|myanmar|korea|japan|taiwan)\b/.test(t)) return "asia";
    if(/\b(france|germany|uk|britain|italy|spain|poland|europe|eu)\b/.test(t)) return "europe";
    if(/\b(usa|america|canada|mexico|brazil|argentina)\b/.test(t)) return "americas";
    return "world";
  }

  function getCountryName(code){
    if(!code) return "";
    return COUNTRY_NAME[code.toUpperCase()] || code.toUpperCase();
  }

  /* ===== DATA OPHALEN ===== */
  function proxyFetch(url){
    var ctrl = new AbortController();
    var timer = setTimeout(function(){ ctrl.abort(); }, 20000);
    return fetch(MAP.proxy + encodeURIComponent(url), {signal: ctrl.signal})
      .then(function(r){
        clearTimeout(timer);
        if(!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then(function(text){
        try{ return JSON.parse(text); }
        catch(e){ throw new Error("geen JSON"); }
      })
      .catch(function(e){ clearTimeout(timer); throw e; });
  }

  /* ===== WAR-TRACKER ===== */
  async function fetchWarTracker(){
    try{
      var url = "https://war-tracker.com/api/v1/events?limit=200";
      var data = await proxyFetch(url);
      if(!Array.isArray(data)) return [];
      return data.map(function(e){
        var lat = parseFloat(e.latitude || e.lat);
        var lon = parseFloat(e.longitude || e.lon || e.lng);
        if(!isFinite(lat) || !isFinite(lon)) return null;
        var countryCode = (e.country || "").toUpperCase();
        var cat = getCategory(countryCode, (e.title || "") + " " + (e.description || ""));
        return {
          id: e.id || e.slug || Math.random().toString(36),
          lat: lat, lon: lon,
          title: (e.title || e.summary || "Conflict event").slice(0, 200),
          desc: (e.description || "").slice(0, 250),
          date: e.timestamp || e.date || new Date().toISOString(),
          country: getCountryName(countryCode),
          countryCode: countryCode,
          cat: cat,
          source: "War-Tracker",
          url: e.url || e.source_url || ""
        };
      }).filter(Boolean);
    }catch(e){ LOG("War-Tracker fout:", e.message); return []; }
  }

  /* ===== GDELT ===== */
  async function fetchGDELT(){
    try{
      var url = "https://api.gdeltproject.org/api/v2/geo/geo?query=conflict%20OR%20strike%20OR%20attack&mode=PointData&format=GeoJSON&maxrecords=200&timespan=1440";
      var data = await proxyFetch(url);
      if(!data || !data.features) return [];
      return data.features.map(function(f){
        var coords = f.geometry && f.geometry.coordinates;
        if(!coords || coords.length < 2) return null;
        var lon = coords[0], lat = coords[1];
        if(!isFinite(lat) || !isFinite(lon)) return null;
        var props = f.properties || {};
        var name = props.name || "";
        var country = props.country || "";
        var cc = (props.countrycode || "").toUpperCase();
        var cat = getCategory(cc, name);
        return {
          id: "gdelt-" + (props.url || Math.random().toString(36)),
          lat: lat, lon: lon,
          title: (name || "Global event").slice(0, 200),
          desc: (props.html || "").replace(/<[^>]*>/g, " ").slice(0, 250),
          date: props.date || new Date().toISOString(),
          country: getCountryName(cc) || country,
          countryCode: cc,
          cat: cat,
          source: "GDELT",
          url: props.url || ""
        };
      }).filter(Boolean);
    }catch(e){ LOG("GDELT fout:", e.message); return []; }
  }

  /* ===== DEDUPE ===== */
  function dedupe(events){
    var map = new Map();
    events.forEach(function(e){
      var key = (e.title || "").toLowerCase().slice(0, 40) + "|" + Math.round(e.lat) + "|" + Math.round(e.lon);
      if(!map.has(key)) map.set(key, e);
    });
    return Array.from(map.values());
  }

  /* ===== ALLES LADEN ===== */
  async function loadAllEvents(){
    LOG("Events laden...");
    var list = $("liveList");
    if(list && !MAP.events.length){
      list.innerHTML = '<div class="live-empty">Live events worden geladen...</div>';
    }

    var results = await Promise.all([fetchWarTracker(), fetchGDELT()]);
    var all = [].concat(results[0], results[1]);
    var deduped = dedupe(all);

    MAP.events = deduped.sort(function(a, b){
      return new Date(b.date) - new Date(a.date);
    });
    MAP.lastUpdate = Date.now();

    var statEl = $("statEvents");
    if(statEl) statEl.textContent = MAP.events.length;

    renderMarkers();
    renderLegend();
    renderLiveList();

    LOG(MAP.events.length, "events geladen (", results[0].length, "WT +", results[1].length, "GDELT)");
  }

  /* ===== MARKERS OP KAART ===== */
  function renderMarkers(){
    if(!MAP.cluster) return;
    MAP.cluster.clearLayers();

    var filtered = MAP.events.filter(function(e){
      if(MAP.currentCat === "all") return true;
      return e.cat === MAP.currentCat;
    });

    var markers = [];
    filtered.forEach(function(e){
      var cat = CATS[e.cat] || CATS.world;
      var icon = L.divIcon({
        className: "custom-event-marker",
        html: '<div class="event-marker" style="color:' + cat.color + '">' +
              '<span class="pulse"></span><span class="dot"></span></div>',
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });
      var marker = L.marker([e.lat, e.lon], {icon: icon});
      var popupHtml =
        '<div class="pop-cat" style="--cat-color:' + cat.color + '">' +
        cat.icon + " " + cat.label + "</div>" +
        '<div class="pop-title">' + escapeHtml(e.title) + "</div>" +
        '<div class="pop-meta">' +
        (e.country ? escapeHtml(e.country) + " · " : "") +
        e.source + " · " + timeAgo(e.date) + "</div>" +
        (e.url ? '<a class="pop-link" href="' + escapeHtml(e.url) + '" target="_blank" rel="noopener">Lees bron →</a>' : "");
      marker.bindPopup(popupHtml);
      markers.push(marker);
    });

    MAP.cluster.addLayers(markers);
  }

  /* ===== LEGENDA ===== */
  function renderLegend(){
    var el = $("legendItems");
    if(!el) return;
    var counts = {};
    MAP.events.forEach(function(e){ counts[e.cat] = (counts[e.cat] || 0) + 1; });
    var sorted = Object.entries(counts).sort(function(a, b){ return b[1] - a[1]; });
    if(!sorted.length){ el.innerHTML = '<div class="legend-item">Geen data</div>'; return; }
    el.innerHTML = sorted.map(function(pair){
      var cat = CATS[pair[0]] || CATS.world;
      return '<div class="legend-item">' +
        '<span class="legend-dot" style="background:' + cat.color + '"></span>' +
        '<span>' + cat.label + '</span>' +
        '<span class="legend-num">' + pair[1] + '</span></div>';
    }).join("");
  }

  /* ===== LIVE LIJST ===== */
  function renderLiveList(){
    var list = $("liveList");
    var countEl = $("liveCount");
    if(!list) return;

    var filtered = MAP.events.filter(function(e){
      if(MAP.currentCat === "all") return true;
      if(MAP.currentCat === "world") return true;
      return e.cat === MAP.currentCat;
    });

    if(countEl) countEl.textContent = filtered.length;

    if(!filtered.length){
      list.innerHTML = '<div class="live-empty">Geen events in deze categorie</div>';
      return;
    }

    list.innerHTML = filtered.slice(0, 100).map(function(e){
      var cat = CATS[e.cat] || CATS.world;
      return '<a class="live-event" style="--cat-color:' + cat.color + '" ' +
        (e.url ? 'href="' + escapeHtml(e.url) + '" target="_blank" rel="noopener"' : "") + ">" +
        '<div class="live-event-icon">' + cat.icon + "</div>" +
        '<div class="live-event-body">' +
        '<div class="live-event-title">' + escapeHtml(e.title) + "</div>" +
        '<div class="live-event-meta">' +
        '<span class="live-event-loc">' + escapeHtml(e.country || "—") + "</span>" +
        "<span>·</span>" +
        "<span>" + timeAgo(e.date) + "</span>" +
        '<span class="live-event-cat" style="--cat-color:' + cat.color + '">' + cat.label + "</span>" +
        "</div></div></a>";
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

  /* ===== KAART INITIALISATIE ===== */
  function initMap(){
    if(MAP.instance || typeof L === "undefined") return;
    var mapEl = $("map");
    if(!mapEl) return;

    MAP.instance = L.map("map", {
      center: [33, 30],
      zoom: 3,
      minZoom: 2,
      maxZoom: 18,
      worldCopyJump: true,
      zoomControl: false,
      attributionControl: true
    });

    var isLight = document.documentElement.classList.contains("light") || document.body.classList.contains("light");
    var tileUrl = isLight
      ? "https://tiles.openfreemap.org/styles/positron"
      : "https://tiles.openfreemap.org/styles/dark";

    MAP.tileLayer = L.tileLayer(tileUrl, {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap &copy; OpenFreeMap'
    }).addTo(MAP.instance);

    MAP.cluster = L.markerClusterGroup({
      maxClusterRadius: 55,
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

  /* ===== MAP CONTROLS ===== */
  function bindControls(){
    var zoomIn = $("mapZoomIn");
    var zoomOut = $("mapZoomOut");
    var locate = $("mapLocate");
    var full = $("mapFull");

    if(zoomIn) zoomIn.addEventListener("click", function(){ MAP.instance && MAP.instance.zoomIn(); });
    if(zoomOut) zoomOut.addEventListener("click", function(){ MAP.instance && MAP.instance.zoomOut(); });
    if(full) full.addEventListener("click", function(){
      var wrap = document.querySelector(".map-wrap");
      if(wrap) wrap.classList.toggle("fullscreen");
      if(MAP.instance) setTimeout(function(){ MAP.instance.invalidateSize(); }, 250);
    });
    if(locate) locate.addEventListener("click", function(){
      if(!navigator.geolocation){ if(window.showToast) window.showToast("Locatie niet ondersteund"); return; }
      navigator.geolocation.getCurrentPosition(function(pos){
        if(!MAP.instance) return;
        MAP.instance.setView([pos.coords.latitude, pos.coords.longitude], 8);
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
        MAP.currentCat = btn.dataset.cat;
        renderMarkers();
        renderLiveList();
      });
    });
  }

  /* ===== THEMA-SWITCH ===== */
  function bindThemeWatch(){
    var btnTheme = $("btnTheme");
    if(!btnTheme) return;
    btnTheme.addEventListener("click", function(){
      setTimeout(function(){
        if(!MAP.tileLayer) return;
        var isLight = document.documentElement.classList.contains("light") || document.body.classList.contains("light");
        MAP.tileLayer.setUrl(isLight
          ? "https://tiles.openfreemap.org/styles/positron"
          : "https://tiles.openfreemap.org/styles/dark");
      }, 150);
    });
  }

  /* ===== REFRESH ===== */
  window.__mapRefresh = function(){
    LOG("Handmatige refresh");
    loadAllEvents();
  };
  window.__mapResetView = function(){
    if(MAP.instance) MAP.instance.setView([33, 30], 3);
  };

  /* ===== VIEW SWITCH HOOK ===== */
  function hookViewSwitch(){
    var tabs = document.querySelectorAll(".bottom-tabs .tab");
    tabs.forEach(function(tab){
      tab.addEventListener("click", function(){
        if(tab.dataset.view === "map"){
          setTimeout(function(){
            initMap();
            if(MAP.instance){ MAP.instance.invalidateSize(); }
            if(!MAP.events.length) loadAllEvents();
            else { renderMarkers(); renderLegend(); renderLiveList(); }
          }, 200);
        }
      });
    });
  }

  /* ===== START ===== */
  window.addEventListener("DOMContentLoaded", function(){
    setTimeout(function(){
      bindControls();
      bindFilters();
      bindThemeWatch();
      hookViewSwitch();
      LOG("Klaar");
    }, 600);
  });

  window.MAPAPI = {
    refresh: function(){ loadAllEvents(); },
    state: MAP
  };

})();