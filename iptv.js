/* ============================================================
   WAR DESK v3.3 — IPTV
   - Nieuw: "Alle groepen" paneel (verticaal, doorzoekbaar, sorteerbaar)
   ============================================================ */

(function(){
  "use strict";

  var $ = function(id){ return document.getElementById(id); };
  var LOG = function(){ try{ console.log.apply(console, ["[IPTV]"].concat(Array.prototype.slice.call(arguments))); }catch(e){} };
  LOG("v3.3 geladen");

  var IPTV = {
    server: "", user: "", pass: "",
    channels: [],
    currentGroup: "all",
    searchQuery: "",
    viewMode: "grid",
    groupsSort: "count",
    hlsInstance: null,
    hlsLoaded: false,
    db: null,
    vlcOpenTime: 0,
    vlcWatchdog: null,
    vlcDidHide: false,
    isLoading: false,
    recent: [],
    workingChannels: {},
    visibleList: [],
    _initialized: false,
    _groupsBound: false
  };

  var MAX_RECENT = 10;
  var RECENT_STORAGE_KEY = "wardesk_iptv_recent";
  var VOLUME_STORAGE_KEY = "wardesk_iptv_volume";
  var MUTE_STORAGE_KEY = "wardesk_iptv_mute";
  var VIEW_STORAGE_KEY = "wardesk_iptv_view";

  /* ========== DB ========== */
  function openDB(){
    return new Promise(function(resolve){
      if(!("indexedDB" in window)){ resolve(null); return; }
      var req = indexedDB.open("wardesk_iptv_v1", 1);
      req.onupgradeneeded = function(e){
        var d = e.target.result;
        if(!d.objectStoreNames.contains("kv")) d.createObjectStore("kv", {keyPath:"k"});
      };
      req.onsuccess = function(e){ IPTV.db = e.target.result; resolve(IPTV.db); };
      req.onerror = function(){ resolve(null); };
    });
  }
  function dbPut(key, value){
    if(!IPTV.db) return Promise.resolve(false);
    return new Promise(function(res){
      try{
        var tx = IPTV.db.transaction("kv", "readwrite");
        tx.objectStore("kv").put({k:key, v:value});
        tx.oncomplete = function(){ res(true); };
        tx.onerror = function(){ res(false); };
      }catch(e){ res(false); }
    });
  }
  function dbGet(key){
    if(!IPTV.db) return Promise.resolve(null);
    return new Promise(function(res){
      try{
        var tx = IPTV.db.transaction("kv", "readonly");
        var r = tx.objectStore("kv").get(key);
        r.onsuccess = function(){ res(r.result ? r.result.v : null); };
        r.onerror = function(){ res(null); };
      }catch(e){ res(null); }
    });
  }
  function dbDelete(key){
    if(!IPTV.db) return Promise.resolve(false);
    return new Promise(function(res){
      try{
        var tx = IPTV.db.transaction("kv", "readwrite");
        tx.objectStore("kv").delete(key);
        tx.oncomplete = function(){ res(true); };
        tx.onerror = function(){ res(false); };
      }catch(e){ res(false); }
    });
  }

  /* ========== KLEUR-DETECTIE ========== */
  function groupColor(group, name){
    var t = ((group || "") + " " + (name || "")).toLowerCase();
    if(/\b(sport|voetbal|football|espn|ziggo sport|fox sport|sky sport|eurosport|nba|nfl|formule|f1|motogp|golf|tennis)\b/.test(t)) return "#f59e0b";
    if(/\b(kids|children|cartoon|peppa|paw patrol|disney jr|nickelodeon|jeugd)\b/.test(t)) return "#ec4899";
    if(/\b(vod|movie|film|cinema|ppv|series|netflix|prime)\b/.test(t)) return "#a855f7";
    if(/\b(music|muziek|mtv|vh1|stingray|radio)\b/.test(t)) return "#06b6d4";
    if(/\b(xxx|adult|18\+|playboy|brazzers)\b/.test(t)) return "#991b1b";
    if(/\b(nl|nederland|netherlands|dutch|holland|hollanda|ned)\b/.test(t)) return "#fb923c";
    if(/\b(arab|arabic|arabisch|maroc|morocco|eg|egypt|sa|saudi|uae|qatar|iraq|lebanon|syria|jordan|dubai|alkass)\b/.test(t)) return "#10b981";
    if(/\b(uk|usa|eng|english|british|america|canada|australia|ireland)\b/.test(t)) return "#3b82f6";
    if(/\b(tr|turkey|turk|türk)\b/.test(t)) return "#ef4444";
    if(/\b(fr|france|frans)\b/.test(t)) return "#0ea5e9";
    if(/\b(de|germany|duits|german|deutsch)\b/.test(t)) return "#94a3b8";
    if(/\b(es|spain|spanish|españa)\b/.test(t)) return "#fbbf24";
    if(/\b(it|italy|italian|italiano)\b/.test(t)) return "#22c55e";
    return "#6b7a93";
  }

  function esc(s){
    return (s || "").replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }

  /* ========== RECENT + WORKING ========== */
  function loadRecent(){
    try {
      var raw = localStorage.getItem(RECENT_STORAGE_KEY);
      IPTV.recent = raw ? JSON.parse(raw) : [];
      if(!Array.isArray(IPTV.recent)) IPTV.recent = [];
    } catch(e) { IPTV.recent = []; }
  }
  function saveRecent(){
    try { localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(IPTV.recent.slice(0, MAX_RECENT))); } catch(e){}
  }
  function addRecent(ch){
    IPTV.recent = IPTV.recent.filter(function(x){ return x.id !== ch.id; });
    IPTV.recent.unshift({ id: ch.id, name: ch.name, logo: ch.logo, group: ch.group });
    IPTV.recent = IPTV.recent.slice(0, MAX_RECENT);
    saveRecent();
  }
  function markWorking(ch){
    IPTV.workingChannels[ch.id] = Date.now();
    try { localStorage.setItem("wardesk_iptv_working", JSON.stringify(IPTV.workingChannels)); } catch(e){}
  }
  function loadWorking(){
    try {
      var raw = localStorage.getItem("wardesk_iptv_working");
      IPTV.workingChannels = raw ? JSON.parse(raw) : {};
      if(typeof IPTV.workingChannels !== "object" || !IPTV.workingChannels) IPTV.workingChannels = {};
    } catch(e) { IPTV.workingChannels = {}; }
  }
  function isWorking(ch){
    var t = IPTV.workingChannels[ch.id];
    if(!t) return false;
    return (Date.now() - t) < 86400000;
  }

  function loadViewMode(){
    try {
      var v = localStorage.getItem(VIEW_STORAGE_KEY);
      if(v === "grid" || v === "list") IPTV.viewMode = v;
    } catch(e){}
  }
  function saveViewMode(){
    try { localStorage.setItem(VIEW_STORAGE_KEY, IPTV.viewMode); } catch(e){}
  }

  /* ========== API ========== */
  function buildUrl(action){
    var base = IPTV.server.trim().replace(/\/$/, "");
    if(!base || !IPTV.user || !IPTV.pass) throw new Error("Vul alle velden in");
    var params = "username=" + encodeURIComponent(IPTV.user) + "&password=" + encodeURIComponent(IPTV.pass);
    if(action) params += "&action=" + action;
    return base + "/player_api.php?" + params;
  }

  function fetchJson(targetUrl){
    var proxy = (window.CONFIG && CONFIG.proxies && CONFIG.proxies[0]) ||
                "https://newsfeed2.hassanbadri814.workers.dev/?url=";
    var ctrl = new AbortController();
    var timer = setTimeout(function(){ ctrl.abort(); }, 45000);
    return fetch(proxy, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: targetUrl }),
      signal: ctrl.signal
    })
      .then(function(r){
        clearTimeout(timer);
        if(!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then(function(text){
        try{ return JSON.parse(text); }
        catch(e){ throw new Error("Geen geldige JSON"); }
      })
      .catch(function(e){
        clearTimeout(timer);
        throw e;
      });
  }

  function setStatus(msg, type){
    var el = $("iptvStatus");
    if(!el) return;
    el.className = "iptv-status" + (type ? " " + type : "");
    el.textContent = msg || "";
    clearTimeout(setStatus._t);
    if(type === "ok"){
      setStatus._t = setTimeout(function(){
        el.textContent = "";
        el.className = "iptv-status";
      }, 5000);
    }
  }

  /* ========== CORE ========== */
  async function loadChannels(){
    if(IPTV.isLoading){ setStatus("⏳ Laden is al bezig...", "loading"); return; }

    var s = $("iptvServer"), u = $("iptvUser"), p = $("iptvPass");
    IPTV.server = ((s && s.value) || "").trim();
    IPTV.user = ((u && u.value) || "").trim();
    IPTV.pass = (p && p.value) || "";

    if(!IPTV.server || !IPTV.user || !IPTV.pass){
      setStatus("✗ Vul alle velden in", "err");
      return;
    }

    IPTV.isLoading = true;
    var loadBtn = $("iptvLoadBtn");
    if(loadBtn){ loadBtn.disabled = true; loadBtn.style.opacity = ".6"; }

    await dbPut("creds", {server:IPTV.server, user:IPTV.user, pass:IPTV.pass});
    var setup = $("iptvSetup");
    if(setup) setup.hidden = false;
    setStatus("Categorieën laden...", "loading");

    try{
      var cats = await fetchJson(buildUrl("get_live_categories"));
      if(!Array.isArray(cats)) throw new Error("Geen categorieën");

      var catMap = {};
      cats.forEach(function(c){ catMap[String(c.category_id)] = c.category_name || "Overig"; });

      setStatus("Kanalen laden (" + cats.length + " categorieën)...", "loading");
      var streams = await fetchJson(buildUrl("get_live_streams"));
      if(!Array.isArray(streams)) throw new Error("Geen kanalen");

      var base = IPTV.server.replace(/\/$/, "");
      var newChannels = streams.map(function(s){
        return {
          id: String(s.stream_id),
          name: s.name || ("Kanaal " + s.stream_id),
          url: base + "/live/" + encodeURIComponent(IPTV.user) + "/" + encodeURIComponent(IPTV.pass) + "/" + s.stream_id + ".m3u8",
          logo: s.stream_icon || "",
          group: catMap[String(s.category_id)] || "Overig"
        };
      }).filter(function(c){ return c.name && c.url; });

      IPTV.channels = newChannels;
      await dbPut("channels", IPTV.channels);
      IPTV.currentGroup = "all";

      setStatus("✓ " + IPTV.channels.length + " kanalen geladen", "ok");
      if(setup) setup.hidden = true;
      renderChannels();
    }catch(e){
      setStatus("✗ " + (e.message || "fout"), "err");
    } finally {
      IPTV.isLoading = false;
      if(loadBtn){ loadBtn.disabled = false; loadBtn.style.opacity = "1"; }
    }
  }

  async function clearChannelsOnly(){
    IPTV.channels = [];
    await dbPut("channels", []);
    var setup = $("iptvSetup");
    if(setup) setup.hidden = false;
    renderChannels();
    var t = document.querySelector('.tab[data-view="iptv"]');
    if(t) t.click();
    setStatus("✓ Kanalen verwijderd — inlog bewaard", "ok");
  }

  async function clearAll(){
    await dbDelete("creds");
    await dbDelete("channels");
    IPTV.server = ""; IPTV.user = ""; IPTV.pass = ""; IPTV.channels = [];
    IPTV.recent = []; saveRecent();
    var sEl = $("iptvServer"); if(sEl) sEl.value = "";
    var uEl = $("iptvUser"); if(uEl) uEl.value = "";
    var pEl = $("iptvPass"); if(pEl) pEl.value = "";
    var setup = $("iptvSetup"); if(setup) setup.hidden = false;
    var t = document.querySelector('.tab[data-view="iptv"]');
    if(t) t.click();
    renderChannels();
    setStatus("✓ Alles gewist", "ok");
  }

  window.__iptvLoadChannels = loadChannels;
  window.__iptvClearChannels = clearChannelsOnly;
  window.__iptvClearAll = clearAll;

  /* ========== GROUPS PANEL ========== */
  function openGroupsPanel(){
    var panel = $("iptvGroupsPanel");
    if(!panel) return;
    var search = $("iptvGroupsSearch");
    if(search) search.value = "";
    renderGroupsList("");
    panel.classList.add("show");
  }

  function closeGroupsPanel(){
    var panel = $("iptvGroupsPanel");
    if(panel) panel.classList.remove("show");
  }

  function renderGroupsList(query){
    var listEl = $("iptvGroupsList");
    if(!listEl) return;

    var groups = {}, order = [];
    IPTV.channels.forEach(function(c){
      if(!groups[c.group]){ groups[c.group] = 0; order.push(c.group); }
      groups[c.group]++;
    });

    /* Sorteer */
    if(IPTV.groupsSort === "name"){
      order.sort(function(a, b){ return a.localeCompare(b); });
    } else {
      order.sort(function(a, b){ return groups[b] - groups[a]; });
    }

    /* Filter op query */
    if(query){
      var q = query.toLowerCase();
      order = order.filter(function(g){ return g.toLowerCase().indexOf(q) >= 0; });
    }

    var html = "";
    order.forEach(function(g){
      var color = groupColor(g, "");
      var isActive = IPTV.currentGroup === g;
      html += '<button class="iptv-group-item ' + (isActive ? "active" : "") + '" data-group="' + esc(g) + '">';
      html += '<span class="iptv-group-color" style="background:' + color + '"></span>';
      html += '<span class="iptv-group-name">' + esc(g) + '</span>';
      html += '<span class="iptv-group-count">' + groups[g] + '</span>';
      html += '</button>';
    });

    if(!order.length){
      html = '<div style="text-align:center;padding:2rem 1rem;color:var(--ink-3);font-size:.85rem">Geen groepen gevonden</div>';
    }

    listEl.innerHTML = html;
  }

  /* ========== UI BINDING ========== */
  function bindUI(){
    LOG("bindUI start");

    /* Wachtwoord-oog */
    var pwToggle = $("iptvPwToggle");
    if(pwToggle){
      pwToggle.addEventListener("click", function(e){
        e.preventDefault();
        e.stopPropagation();
        var p = $("iptvPass");
        if(!p) return;
        var isPassword = p.getAttribute("type") === "password";
        p.setAttribute("type", isPassword ? "text" : "password");
        this.textContent = isPassword ? "🙈" : "👁";
      });
    }

    function saveCreds(){
      IPTV.server = (($("iptvServer") || {}).value || "").trim();
      IPTV.user = (($("iptvUser") || {}).value || "").trim();
      IPTV.pass = ($("iptvPass") || {}).value || "";
      if(!IPTV.server && !IPTV.user && !IPTV.pass) return;
      dbPut("creds", {server:IPTV.server, user:IPTV.user, pass:IPTV.pass});
    }

    ["iptvServer","iptvUser","iptvPass"].forEach(function(id){
      var el = $(id);
      if(!el) return;
      el.addEventListener("blur", saveCreds);
      el.addEventListener("change", saveCreds);
      el.addEventListener("keydown", function(e){
        if(e.key === "Enter"){ e.preventDefault(); saveCreds(); }
      });
    });

    window.addEventListener("pagehide", saveCreds);
    window.addEventListener("beforeunload", saveCreds);
    document.addEventListener("visibilitychange", function(){
      if(document.hidden) saveCreds();
    });

    var testBtn = $("iptvTestBtn");
    if(testBtn){
      testBtn.addEventListener("click", async function(){
        saveCreds();
        if(!IPTV.server || !IPTV.user || !IPTV.pass){ setStatus("✗ Vul alle velden in", "err"); return; }
        setStatus("Testen...", "loading");
        var t0 = performance.now();
        try{
          var cats = await fetchJson(buildUrl("get_live_categories"));
          if(!Array.isArray(cats)) throw new Error("Geen categorieën");
          var ms = Math.round(performance.now() - t0);
          setStatus("✓ Verbinding OK — " + cats.length + " categorieën (" + ms + "ms)", "ok");
        }catch(e){
          setStatus("✗ " + (e.message || "fout"), "err");
        }
      });
    }

    var loadBtn = $("iptvLoadBtn");
    if(loadBtn) loadBtn.addEventListener("click", loadChannels);

    var clearBtn = $("iptvClearBtn");
    if(clearBtn){
      clearBtn.addEventListener("click", async function(){
        if(!confirm("Alle IPTV gegevens en kanalen wissen?")) return;
        await clearAll();
      });
    }

    /* PILLS — klik op pill of "Alle groepen" knop */
    var pills = $("iptvPills");
    if(pills){
      pills.addEventListener("click", function(e){
        var btn = e.target.closest(".iptv-pill");
        if(!btn) return;
        e.preventDefault();
        e.stopPropagation();

        if(btn.dataset.action === "open-groups"){
          openGroupsPanel();
          return;
        }

        var g = btn.dataset.group;
        if(!g) return;
        IPTV.currentGroup = g;
        if(g !== "search"){
          var sInp = $("iptvSearch");
          if(sInp && sInp.value){ sInp.value = ""; IPTV.searchQuery = ""; }
        }
        renderChannels();
      });
    }

    /* Zoekbalk kanaal */
    var search = $("iptvSearch");
    if(search){
      var searchTimer;
      search.addEventListener("input", function(){
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function(){
          IPTV.searchQuery = search.value.trim().toLowerCase();
          IPTV.currentGroup = IPTV.searchQuery ? "search" : "all";
          renderChannels();
        }, 200);
      });
    }
    var searchClear = $("iptvSearchClear");
    if(searchClear){
      searchClear.addEventListener("click", function(){
        var s = $("iptvSearch");
        if(s) s.value = "";
        IPTV.searchQuery = "";
        IPTV.currentGroup = "all";
        renderChannels();
      });
    }

    /* View toggle */
    var viewToggle = $("iptvViewToggle");
    if(viewToggle){
      viewToggle.addEventListener("click", function(e){
        e.preventDefault();
        e.stopPropagation();
        IPTV.viewMode = IPTV.viewMode === "grid" ? "list" : "grid";
        saveViewMode();
        viewToggle.textContent = IPTV.viewMode === "grid" ? "▦" : "☰";
        renderChannels();
      });
    }

    /* Groups panel bindings */
    var groupPanel = $("iptvGroupsPanel");
    if(groupPanel && !IPTV._groupsBound){
      IPTV._groupsBound = true;

      groupPanel.addEventListener("click", function(e){
        if(e.target === groupPanel) closeGroupsPanel();
      });

      var gpc = $("iptvGroupsPanelClose");
      if(gpc) gpc.addEventListener("click", closeGroupsPanel);

      var gps = $("iptvGroupsSearch");
      if(gps){
        gps.addEventListener("input", function(){
          renderGroupsList(gps.value.trim());
        });
      }

      var gsort = $("iptvGroupsSort");
      if(gsort){
        gsort.addEventListener("click", function(){
          IPTV.groupsSort = IPTV.groupsSort === "count" ? "name" : "count";
          gsort.textContent = IPTV.groupsSort === "count" ? "▤ Aantal" : "🔤 Naam";
          var s = $("iptvGroupsSearch");
          renderGroupsList(s ? s.value.trim() : "");
        });
      }

      var gList = $("iptvGroupsList");
      if(gList){
        gList.addEventListener("click", function(e){
          var btn = e.target.closest(".iptv-group-item");
          if(!btn) return;
          e.preventDefault();
          e.stopPropagation();
          var g = btn.dataset.group;
          if(!g) return;
          IPTV.currentGroup = g;
          if(IPTV.searchQuery){
            IPTV.searchQuery = "";
            var sInp = $("iptvSearch");
            if(sInp) sInp.value = "";
          }
          closeGroupsPanel();
          renderChannels();
        });
      }
    }

    /* Player controls */
    var playerClose = $("iptvPlayerClose");
    if(playerClose) playerClose.addEventListener("click", closePlayer);

    var playerFs = $("iptvPlayerFs");
    if(playerFs) playerFs.addEventListener("click", toggleFullscreen);

    var copyBtn = $("iptvCopyUrl");
    if(copyBtn) copyBtn.addEventListener("click", function(){
      var v = $("iptvVideo");
      if(v && v.src && navigator.clipboard){
        navigator.clipboard.writeText(v.src).then(function(){
          if(window.showToast) window.showToast("Stream-URL gekopieerd");
        });
      }
    });

    var quality = $("iptvQualitySelect");
    if(quality){
      quality.addEventListener("change", function(){
        var lvl = parseInt(quality.value, 10);
        if(IPTV.hlsInstance && IPTV.hlsInstance.levels){
          IPTV.hlsInstance.currentLevel = isNaN(lvl) ? -1 : lvl;
          if(window.showToast) window.showToast("Kwaliteit: " + (isNaN(lvl) ? "Auto" : IPTV.hlsInstance.levels[lvl].height + "p"));
        }
      });
    }

    var player = $("iptvPlayer");
    if(player) player.addEventListener("click", function(e){
      if(e.target.id === "iptvPlayer") closePlayer();
    });

    var video = $("iptvVideo");
    if(video){
      var savedVol = parseFloat(localStorage.getItem(VOLUME_STORAGE_KEY) || "1");
      var savedMute = localStorage.getItem(MUTE_STORAGE_KEY) === "1";
      if(!isNaN(savedVol)) video.volume = Math.max(0, Math.min(1, savedVol));
      video.muted = savedMute;
      video.addEventListener("volumechange", function(){
        try {
          localStorage.setItem(VOLUME_STORAGE_KEY, String(video.volume));
          localStorage.setItem(MUTE_STORAGE_KEY, video.muted ? "1" : "0");
        } catch(e){}
      });
    }

    LOG("bindUI klaar");
  }

  /* ========== RENDER ========== */
  function renderPills(){
    var wrap = $("iptvPills");
    if(!wrap) return;
    if(!IPTV.channels.length){ wrap.innerHTML = ""; return; }

    var groups = {}, order = [];
    IPTV.channels.forEach(function(c){
      if(!groups[c.group]){ groups[c.group] = 0; order.push(c.group); }
      groups[c.group]++;
    });
    order.sort(function(a, b){ return groups[b] - groups[a]; });

    var html = "";
    if(IPTV.recent.length){
      html += '<button class="iptv-pill ' + (IPTV.currentGroup === "recent" ? "active" : "") + '" data-group="recent">★ Recent (' + IPTV.recent.length + ')</button>';
    }
    html += '<button class="iptv-pill ' + (IPTV.currentGroup === "all" ? "active" : "") + '" data-group="all">Alle (' + IPTV.channels.length + ')</button>';

    /* Top 6 groepen in pills */
    order.slice(0, 6).forEach(function(g){
      var short = g.length > 18 ? g.slice(0, 17) + "…" : g;
      html += '<button class="iptv-pill ' + (IPTV.currentGroup === g ? "active" : "") + '" data-group="' + esc(g) + '">' + esc(short) + ' (' + groups[g] + ')</button>';
    });

    /* Altijd "Alle groepen" knop tonen als er groepen zijn */
    if(order.length > 0){
      var label = order.length > 6 ? "☰ Alle groepen (" + order.length + ")" : "☰ Toon alle groepen";
      html += '<button class="iptv-pill iptv-pill-more" data-action="open-groups">' + label + '</button>';
    }

    wrap.innerHTML = html;
  }

  function getVisibleChannels(){
    var list = IPTV.channels;
    if(IPTV.currentGroup === "recent"){
      var recentIds = {};
      IPTV.recent.forEach(function(r){ recentIds[r.id] = 1; });
      list = list.filter(function(c){ return recentIds[c.id]; });
    } else if(IPTV.currentGroup === "search" && IPTV.searchQuery){
      var q = IPTV.searchQuery;
      list = list.filter(function(c){
        return (c.name || "").toLowerCase().indexOf(q) >= 0 ||
               (c.group || "").toLowerCase().indexOf(q) >= 0;
      });
    } else if(IPTV.currentGroup !== "all"){
      list = list.filter(function(c){ return c.group === IPTV.currentGroup; });
    }
    return list;
  }

  function renderChannels(){
    var grid = $("iptvGrid");
    var count = $("iptvCount");
    var visibleEl = $("iptvVisibleCount");
    var searchWrap = $("iptvSearchWrap");
    var viewToggle = $("iptvViewToggle");
    if(!grid) return;

    if(searchWrap) searchWrap.hidden = !IPTV.channels.length;
    if(viewToggle){
      viewToggle.hidden = !IPTV.channels.length;
      viewToggle.textContent = IPTV.viewMode === "grid" ? "▦" : "☰";
    }

    grid.classList.toggle("list-mode", IPTV.viewMode === "list");
    renderPills();

    if(!IPTV.channels.length){
      grid.innerHTML = '<div class="empty-state">' +
        '<div class="empty-icon">📡</div>' +
        '<div class="empty-msg">Geen kanalen geladen</div>' +
        '<div class="empty-hint">Vul je Xtream-gegevens in en tik op <strong>Laad kanalen</strong></div>' +
        '</div>';
      if(count) count.textContent = "0 kanalen";
      if(visibleEl) visibleEl.textContent = "";
      return;
    }

    var list = getVisibleChannels();
    IPTV.visibleList = list;

    if(count) count.textContent = list.length + " kanalen";
    if(visibleEl) visibleEl.textContent = "Toon " + list.length + " van " + IPTV.channels.length;

    if(!list.length){
      var msg;
      if(IPTV.currentGroup === "search") msg = 'Geen kanalen gevonden voor "' + esc(IPTV.searchQuery) + '"';
      else if(IPTV.currentGroup === "recent") msg = "Nog geen recent bekeken kanalen";
      else msg = "Geen kanalen in deze groep";
      grid.innerHTML = '<div class="empty-state">' +
        '<div class="empty-icon">🔍</div>' +
        '<div class="empty-msg">' + msg + '</div>' +
        '<div class="empty-hint">Kies een andere groep of wis je zoekopdracht</div>' +
        '</div>';
      return;
    }

    var toShow = list.slice(0, 500);
    var html = "";
    toShow.forEach(function(c, i){
      var color = groupColor(c.group, c.name);
      var initial = (c.name || "?").charAt(0).toUpperCase();
      var logoHtml;
      if(c.logo){
        logoHtml = '<img src="' + esc(c.logo) + '" loading="lazy" alt="" data-initial="' + esc(initial) + '" onerror="this.replaceWith(document.createTextNode(this.dataset.initial))">';
      } else {
        logoHtml = esc(initial);
      }
      var workingDot = isWorking(c) ? '<span class="iptv-ch-working" title="Recent werkend"></span>' : '';
      html += '<button class="iptv-ch" data-idx="' + i + '" style="--ch-color:' + color + '">';
      html += '<div class="iptv-ch-logo">' + logoHtml + workingDot + '</div>';
      html += '<div class="iptv-ch-info">';
      html += '<div class="iptv-ch-name">' + esc(c.name) + '</div>';
      html += '<div class="iptv-ch-group">' + esc(c.group) + '</div>';
      html += '</div>';
      html += '</button>';
    });
    grid.innerHTML = html;

    if(!grid._iptvBound){
      grid._iptvBound = true;
      grid.addEventListener("click", function(e){
        var btn = e.target.closest(".iptv-ch");
        if(!btn) return;
        var idx = parseInt(btn.dataset.idx, 10);
        if(isNaN(idx)) return;
        var ch = IPTV.visibleList[idx];
        if(ch) playChannel(ch);
      });
    }
  }

  /* ========== PLAYER ========== */
  function closePlayer(){
    var p = $("iptvPlayer");
    if(p) p.classList.remove("show");
    if(IPTV.hlsInstance){ try{ IPTV.hlsInstance.destroy(); }catch(e){} IPTV.hlsInstance = null; }
    var v = $("iptvVideo");
    if(v){ v.pause(); v.removeAttribute("src"); v.load(); }
    var spinner = $("iptvPlayerSpinner");
    if(spinner) spinner.classList.remove("show");
    var qSel = $("iptvQualitySelect");
    if(qSel){ qSel.innerHTML = '<option value="auto">Auto</option>'; qSel.disabled = true; }
  }

  function toggleFullscreen(){
    var box = document.querySelector(".iptv-player-box");
    if(!box) return;
    if(!document.fullscreenElement){
      if(box.requestFullscreen) box.requestFullscreen().catch(function(){});
      else if(box.webkitRequestFullscreen) box.webkitRequestFullscreen();
      else if(window.showToast) window.showToast("Fullscreen niet ondersteund");
    } else {
      if(document.exitFullscreen) document.exitFullscreen().catch(function(){});
      else if(document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  }

  function loadHls(cdnIndex){
    cdnIndex = cdnIndex || 0;
    if(IPTV.hlsLoaded && window.Hls) return Promise.resolve(true);
    var CDNS = [
      "https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js",
      "https://unpkg.com/hls.js@1/dist/hls.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.15/hls.min.js"
    ];
    if(cdnIndex >= CDNS.length) return Promise.resolve(false);
    return new Promise(function(res){
      var s = document.createElement("script");
      s.src = CDNS[cdnIndex];
      s.onload = function(){ IPTV.hlsLoaded = true; res(true); };
      s.onerror = function(){
        LOG("HLS CDN " + cdnIndex + " faalde, probeer volgende...");
        s.remove();
        loadHls(cdnIndex + 1).then(res);
      };
      document.head.appendChild(s);
    });
  }

  function vlcOpen(url, channelName){
    IPTV.vlcOpenTime = Date.now();
    IPTV.vlcDidHide = false;
    clearTimeout(IPTV.vlcWatchdog);
    IPTV.vlcWatchdog = setTimeout(function(){
      if(!IPTV.vlcDidHide){
        if(window.showToast) window.showToast("VLC opent niet — is VLC geïnstalleerd?");
      }
    }, 3000);
    try{
      window.location.href = "intent:" + url + "#Intent;package=org.videolan.vlc;type=video/*;S.title=" + encodeURIComponent(channelName || "WAR DESK") + ";end";
    }catch(e){
      clearTimeout(IPTV.vlcWatchdog);
      if(window.showToast) window.showToast("VLC niet gevonden");
    }
  }

  document.addEventListener("visibilitychange", function(){
    if(document.hidden){
      if(IPTV.vlcOpenTime && Date.now() - IPTV.vlcOpenTime < 5000){
        IPTV.vlcDidHide = true;
        clearTimeout(IPTV.vlcWatchdog);
      }
    } else {
      if(IPTV.vlcOpenTime){
        var elapsed = Date.now() - IPTV.vlcOpenTime;
        IPTV.vlcOpenTime = 0;
        if(elapsed < 2000 && IPTV.vlcDidHide){
          setTimeout(function(){
            if(window.showToast) window.showToast("Stream lijkt offline");
          }, 500);
        }
      }
    }
  });

  function updateQualityLevels(hls){
    var sel = $("iptvQualitySelect");
    if(!sel) return;
    if(!hls.levels || !hls.levels.length){
      sel.innerHTML = '<option value="auto">Auto</option>';
      sel.disabled = true;
      return;
    }
    var html = '<option value="-1">Auto</option>';
    hls.levels.forEach(function(lvl, i){
      html += '<option value="' + i + '">' + (lvl.height || "?") + 'p</option>';
    });
    sel.innerHTML = html;
    sel.disabled = false;
  }

  function playChannel(ch){
    var url = ch.url;
    var isHttp = /^http:\/\//i.test(url);
    var isHttpsPage = location.protocol === "https:";
    if(isHttp && isHttpsPage){ vlcOpen(url, ch.name); return; }

    var overlay = $("iptvPlayer");
    var title = $("iptvPlayerTitle");
    var video = $("iptvVideo");
    var status = $("iptvPlayerStatus");
    var spinner = $("iptvPlayerSpinner");
    if(!overlay || !video) return;

    if(title) title.textContent = ch.name;
    overlay.classList.add("show");
    if(IPTV.hlsInstance){ try{ IPTV.hlsInstance.destroy(); }catch(e){} IPTV.hlsInstance = null; }
    video.pause(); video.removeAttribute("src"); video.load();
    if(spinner) spinner.classList.add("show");

    var isHls = /\.m3u8(\?|$)/i.test(url);
    addRecent(ch);

    var markAndUpdate = function(){
      markWorking(ch);
      if($("iptvGrid")) renderChannels();
    };

    if(isHls && video.canPlayType("application/vnd.apple.mpegurl")){
      video.src = url;
      status.textContent = "HLS native";
      video.play().then(function(){
        if(spinner) spinner.classList.remove("show");
        status.textContent = "● Live · native";
        markAndUpdate();
      }).catch(function(){
        if(spinner) spinner.classList.remove("show");
        status.textContent = "Klik play om te starten";
      });
    } else if(isHls){
      status.textContent = "HLS.js laden...";
      loadHls(0).then(function(ok){
        if(ok && window.Hls && window.Hls.isSupported()){
          IPTV.hlsInstance = new window.Hls({enableWorker:true});
          IPTV.hlsInstance.loadSource(url);
          IPTV.hlsInstance.attachMedia(video);
          IPTV.hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, function(){
            if(spinner) spinner.classList.remove("show");
            updateQualityLevels(IPTV.hlsInstance);
            var lvl = IPTV.hlsInstance.levels[IPTV.hlsInstance.currentLevel];
            var resTxt = lvl && lvl.height ? lvl.height + "p" : "auto";
            status.textContent = "● Live · " + resTxt;
            markAndUpdate();
            video.play().catch(function(){});
          });
          IPTV.hlsInstance.on(window.Hls.Events.LEVEL_SWITCHED, function(e, data){
            var lvl = IPTV.hlsInstance.levels[data.level];
            if(lvl && lvl.height) status.textContent = "● Live · " + lvl.height + "p";
          });
          IPTV.hlsInstance.on(window.Hls.Events.ERROR, function(e, data){
            if(data.fatal){
              if(spinner) spinner.classList.remove("show");
              status.innerHTML = 'Streamfout: ' + data.details;
            }
          });
        } else {
          if(spinner) spinner.classList.remove("show");
          status.textContent = 'HLS niet ondersteund. Gebruik VLC.';
        }
      });
    } else {
      video.src = url;
      status.textContent = "Directe stream";
      video.play().then(function(){
        if(spinner) spinner.classList.remove("show");
        status.textContent = "● Actief";
        markAndUpdate();
      }).catch(function(){
        if(spinner) spinner.classList.remove("show");
        status.textContent = "Klik play om te starten";
      });
    }
  }

  /* ========== INIT ========== */
  async function init(){
    if(IPTV._initialized){ LOG("init al gedaan, skip"); return; }
    IPTV._initialized = true;

    try{
      LOG("init start");
      await openDB();
      loadRecent();
      loadWorking();
      loadViewMode();

      var creds = await dbGet("creds");
      if(creds){
        IPTV.server = creds.server || "";
        IPTV.user = creds.user || "";
        IPTV.pass = creds.pass || "";
        var sEl = $("iptvServer"); if(sEl) sEl.value = IPTV.server;
        var uEl = $("iptvUser"); if(uEl) uEl.value = IPTV.user;
        var pEl = $("iptvPass"); if(pEl) pEl.value = IPTV.pass;
      }

      var channels = await dbGet("channels");
      if(channels && channels.length){
        IPTV.channels = channels;
        var setup = $("iptvSetup");
        if(setup) setup.hidden = true;
        renderChannels();
      }

      bindUI();
      LOG("init klaar");
    }catch(e){
      LOG("init FOUT:", e);
    }
  }

  window.IPTVAPI = { init: init, state: IPTV };

  function start(){ init(); }
  if(document.readyState === "complete" || document.readyState === "interactive") setTimeout(start, 200);
  else document.addEventListener("DOMContentLoaded", function(){ setTimeout(start, 200); });
  window.addEventListener("load", function(){ setTimeout(start, 500); });
})();