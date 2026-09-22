/* ============================================================
   WAR DESK v8.0 — IPTV (High Performance)
   - Chunked rendering voor 500+ kanalen
   - Geïntegreerd met window.appStore (Reactive)
   - Behoudt window.IPTVAPI voor compatibiliteit
   ============================================================ */

(function(){
  "use strict";

  var $ = function(id){ return document.getElementById(id); };
  var LOG = function(){ try{ console.log.apply(console, ["[IPTV]"].concat(Array.prototype.slice.call(arguments))); }catch(e){} };
  LOG("v8.0 geladen");

  // Gebruik de store (via de Brug)
  var state = window.appStore ? window.appStore.state : null;

  var IPTV = {
    server: "", user: "", pass: "",
    channels: [],
    currentGroup: "all",
    previousGroup: "all",
    searchQuery: "",
    viewMode: "grid",
    groupsSort: "count",
    hlsInstance: null,
    hlsLoaded: false,
    hlsPromise: null,
    db: null,
    vlcOpenTime: 0,
    vlcWatchdog: null,
    vlcDidHide: false,
    isLoading: false,
    workingChannels: Object.create(null),
    visibleList: [],
    renderLimit: 500,
    currentChannel: null,
    _playToken: 0,
    _initialized: false,
    _groupsBound: false,
    _saveCredsTimer: null,
    _renderChunkTimer: null
  };

  var VOLUME_STORAGE_KEY = "wardesk_iptv_volume";
  var MUTE_STORAGE_KEY = "wardesk_iptv_mute";
  var VIEW_STORAGE_KEY = "wardesk_iptv_view";

  function cfg(key, fallback){
    if(window.CONFIG && CONFIG[key] !== undefined) return CONFIG[key];
    return fallback;
  }

  function isDutchGroup(groupName){
    if(!groupName) return false;
    var t = String(groupName).toLowerCase();
    return /\b(nl|nederland|netherlands|dutch|holland|hollanda|ned)\b/.test(t);
  }

  function findDutchGroup(){
    if(!IPTV.channels || !IPTV.channels.length) return null;
    var matches = {};
    var counts = {};
    IPTV.channels.forEach(function(c){
      if(isDutchGroup(c.group)){
        matches[c.group] = true;
        counts[c.group] = (counts[c.group] || 0) + 1;
      }
    });
    var keys = Object.keys(matches);
    if(!keys.length) return null;
    keys.sort(function(a, b){ return counts[b] - counts[a]; });
    return keys[0];
  }

  function applyDefaultGroup(){
    var dutch = findDutchGroup();
    if(dutch){
      IPTV.currentGroup = dutch;
      IPTV.previousGroup = dutch;
      LOG("Standaard groep:", dutch);
    } else {
      IPTV.currentGroup = "all";
      IPTV.previousGroup = "all";
      LOG("Geen Nederlandse groep, standaard: Alle kanalen");
    }
  }

  function openDB(){
    return new Promise(function(resolve){
      try{
        if(!("indexedDB" in window)){ resolve(null); return; }
        var req = indexedDB.open("wardesk_iptv_v1", 1);
        req.onupgradeneeded = function(e){
          var d = e.target.result;
          if(!d.objectStoreNames.contains("kv")) d.createObjectStore("kv", {keyPath:"k"});
        };
        req.onsuccess = function(e){ IPTV.db = e.target.result; resolve(IPTV.db); };
        req.onerror = function(){ resolve(null); };
      }catch(e){ resolve(null); }
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
    return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }

  function markWorking(ch){
    if(!ch || !ch.id) return;
    IPTV.workingChannels[ch.id] = Date.now();
    pruneWorking();
    try { localStorage.setItem("wardesk_iptv_working", JSON.stringify(IPTV.workingChannels)); }catch(e){}
  }
  function loadWorking(){
    try {
      var raw = localStorage.getItem("wardesk_iptv_working");
      var parsed = raw ? JSON.parse(raw) : {};
      IPTV.workingChannels = Object.create(null);
      if(parsed && typeof parsed === "object"){
        Object.keys(parsed).forEach(function(k){ IPTV.workingChannels[k] = parsed[k]; });
      }
    } catch(e) { IPTV.workingChannels = Object.create(null); }
    pruneWorking();
  }
  function pruneWorking(){
    var cutoff = Date.now() - 86400000;
    var keys = Object.keys(IPTV.workingChannels);
    var changed = false;
    keys.forEach(function(k){
      if(!IPTV.workingChannels[k] || IPTV.workingChannels[k] < cutoff){
        delete IPTV.workingChannels[k];
        changed = true;
      }
    });
    if(changed){
      try { localStorage.setItem("wardesk_iptv_working", JSON.stringify(IPTV.workingChannels)); }catch(e){}
    }
  }
  function isWorking(ch){
    if(!ch) return false;
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
    try { localStorage.setItem(VIEW_STORAGE_KEY, IPTV.viewMode); }catch(e){}
  }

  function buildUrl(action){
    var base = IPTV.server.trim().replace(/\/$/, "");
    if(!base || !IPTV.user || !IPTV.pass) throw new Error("Vul alle velden in");
    var params = "username=" + encodeURIComponent(IPTV.user) + "&password=" + encodeURIComponent(IPTV.pass);
    if(action) params += "&action=" + action;
    return base + "/player_api.php?" + params;
  }

  function getProxies(){
    if(window.CONFIG && CONFIG.proxies && CONFIG.proxies.length) return CONFIG.proxies.slice();
    return ["https://newsfeed2.hassanbadri814.workers.dev/?url="];
  }

  function fetchJson(targetUrl){
    var proxies = getProxies();
    var lastErr = null;
    function tryProxy(idx){
      if(idx >= proxies.length) return Promise.reject(lastErr || new Error("Alle proxies faalden"));
      var proxy = proxies[idx];
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
        lastErr = e;
        LOG("Proxy " + (idx + 1) + " faalde:", e.message);
        return tryProxy(idx + 1);
      });
    }
    return tryProxy(0);
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

  async function loadChannels(){
    if(IPTV.isLoading){ setStatus("Laden is al bezig...", "loading"); return; }

    var s = $("iptvServer"), u = $("iptvUser"), p = $("iptvPass");
    IPTV.server = ((s && s.value) || "").trim();
    IPTV.user = ((u && u.value) || "").trim();
    IPTV.pass = (p && p.value) || "";

    if(!IPTV.server || !IPTV.user || !IPTV.pass){
      setStatus("Vul alle velden in", "err");
      if(window.showToast) window.showToast("Vul alle IPTV-gegevens in.");
      return;
    }

    IPTV.isLoading = true;
    var loadBtn = $("iptvLoadBtn");
    if(loadBtn){ loadBtn.disabled = true; loadBtn.style.opacity = ".6"; }

    await dbPut("creds", {server:IPTV.server, user:IPTV.user, pass:IPTV.pass});
    var setup = $("iptvSetup");
    if(setup) setup.hidden = false;
    setStatus("Categorieen laden...", "loading");

    try{
      var cats = await fetchJson(buildUrl("get_live_categories"));
      if(!Array.isArray(cats)) throw new Error("Geen categorieen");

      var catMap = Object.create(null);
      cats.forEach(function(c){ catMap[String(c.category_id)] = c.category_name || "Overig"; });

      setStatus("Kanalen laden (" + cats.length + " categorieen)...", "loading");
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
      IPTV.renderLimit = cfg("iptvChannelsDisplayMax", 500);

      applyDefaultGroup();

      var sInp = $("iptvSearch");
      if(sInp) sInp.value = "";
      IPTV.searchQuery = "";

      setStatus(IPTV.channels.length + " kanalen geladen", "ok");
      if(setup) setup.hidden = true;
      renderChannels();
    }catch(e){
      setStatus(e.message || "fout", "err");
      if(window.showToast) window.showToast("Kon kanalen niet laden: " + (e.message || "onbekende fout"));
    } finally {
      IPTV.isLoading = false;
      if(loadBtn){ loadBtn.disabled = false; loadBtn.style.opacity = "1"; }
    }
  }

  async function clearChannelsOnly(){
    closePlayer();
    closeGroupsPanel();
    IPTV.channels = [];
    IPTV.currentChannel = null;
    await dbPut("channels", []);
    var setup = $("iptvSetup");
    if(setup) setup.hidden = false;
    renderChannels();
    var t = document.querySelector('.tab[data-view="iptv"]');
    if(t) t.click();
    setStatus("Kanalen verwijderd", "ok");
    if(window.showToast) window.showToast("Kanalen verwijderd.");
  }

  async function clearAll(){
    closePlayer();
    closeGroupsPanel();
    await dbDelete("creds");
    await dbDelete("channels");
    try { localStorage.removeItem("wardesk_iptv_working"); }catch(e){}
    IPTV.workingChannels = Object.create(null);
    IPTV.server = ""; IPTV.user = ""; IPTV.pass = ""; IPTV.channels = [];
    IPTV.currentChannel = null;
    var sEl = $("iptvServer"); if(sEl) sEl.value = "";
    var uEl = $("iptvUser"); if(uEl) uEl.value = "";
    var pEl = $("iptvPass"); if(pEl) pEl.value = "";
    var setup = $("iptvSetup"); if(setup) setup.hidden = false;
    var t = document.querySelector('.tab[data-view="iptv"]');
    if(t) t.click();
    renderChannels();
    setStatus("Alles gewist", "ok");
    if(window.showToast) window.showToast("Alle IPTV-gegevens gewist.");
  }

  window.__iptvLoadChannels = loadChannels;
  window.__iptvClearChannels = clearChannelsOnly;
  window.__iptvClearAll = clearAll;

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

    var groups = Object.create(null);
    var order = [];
    IPTV.channels.forEach(function(c){
      if(!groups[c.group]){ groups[c.group] = 0; order.push(c.group); }
      groups[c.group]++;
    });

    if(IPTV.groupsSort === "name"){
      order.sort(function(a, b){ return a.localeCompare(b); });
    } else {
      order.sort(function(a, b){ return groups[b] - groups[a]; });
    }

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

  function updatePlayBtn(){
    var video = $("iptvVideo");
    var playBtn = $("iptvPlayerPlay");
    if(!video || !playBtn) return;
    var icon = video.paused
      ? '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
    playBtn.innerHTML = icon;
    playBtn.setAttribute("aria-label", video.paused ? "Afspelen" : "Pauzeren");
  }

  async function togglePiP(){
    var video = $("iptvVideo");
    if(!video) return;
    try{
      if(document.pictureInPictureElement){
        await document.exitPictureInPicture();
      } else if(document.pictureInPictureEnabled && video.readyState > 0){
        await video.requestPictureInPicture();
      } else {
        if(window.showToast) window.showToast("PiP niet beschikbaar voor deze stream");
      }
    }catch(e){
      if(window.showToast) window.showToast("PiP: " + (e.message || "fout"));
    }
  }

  function saveCredsNow(){
    IPTV.server = (($("iptvServer") || {}).value || "").trim();
    IPTV.user = (($("iptvUser") || {}).value || "").trim();
    IPTV.pass = ($("iptvPass") || {}).value || "";
    if(!IPTV.server && !IPTV.user && !IPTV.pass) return;
    dbPut("creds", {server:IPTV.server, user:IPTV.user, pass:IPTV.pass});
  }
  function saveCreds(){
    clearTimeout(IPTV._saveCredsTimer);
    IPTV._saveCredsTimer = setTimeout(saveCredsNow, 500);
  }
  function saveCredsImmediate(){
    clearTimeout(IPTV._saveCredsTimer);
    saveCredsNow();
  }

  function bindUI(){
    LOG("bindUI start");

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

    ["iptvServer","iptvUser","iptvPass"].forEach(function(id){
      var el = $(id);
      if(!el) return;
      el.addEventListener("blur", saveCreds);
      el.addEventListener("change", saveCreds);
      el.addEventListener("keydown", function(e){
        if(e.key === "Enter"){ e.preventDefault(); saveCreds(); }
      });
    });

    window.addEventListener("pagehide", saveCredsImmediate);
    window.addEventListener("beforeunload", saveCredsImmediate);
    document.addEventListener("visibilitychange", function(){
      if(document.hidden) saveCredsImmediate();
    });

    var testBtn = $("iptvTestBtn");
    if(testBtn){
      testBtn.addEventListener("click", async function(){
        if(testBtn.disabled) return;
        saveCredsImmediate();
        if(!IPTV.server || !IPTV.user || !IPTV.pass){
          setStatus("Vul alle velden in", "err");
          if(window.showToast) window.showToast("Vul alle IPTV-gegevens in.");
          return;
        }
        testBtn.disabled = true;
        testBtn.style.opacity = ".6";
        setStatus("Testen...", "loading");
        var t0 = performance.now();
        try{
          var cats = await fetchJson(buildUrl("get_live_categories"));
          if(!Array.isArray(cats)) throw new Error("Geen categorieen");
          var ms = Math.round(performance.now() - t0);
          setStatus("Verbinding OK - " + cats.length + " categorieen (" + ms + "ms)", "ok");
          if(window.showToast) window.showToast("Verbinding OK (" + ms + "ms)");
        }catch(e){
          setStatus(e.message || "fout", "err");
          if(window.showToast) window.showToast("Verbinding mislukt: " + (e.message || "fout"));
        } finally {
          testBtn.disabled = false;
          testBtn.style.opacity = "1";
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

        if(IPTV.currentGroup !== "search") IPTV.previousGroup = IPTV.currentGroup;

        IPTV.currentGroup = g;
        if(g !== "search"){
          var sInp = $("iptvSearch");
          if(sInp && sInp.value){ sInp.value = ""; IPTV.searchQuery = ""; }
        }
        IPTV.renderLimit = cfg("iptvChannelsDisplayMax", 500);
        renderChannels();
      });
    }

    var search = $("iptvSearch");
    if(search){
      var searchTimer;
      search.addEventListener("input", function(){
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function(){
          var q = search.value.trim().toLowerCase();
          if(q && IPTV.currentGroup !== "search"){
            IPTV.previousGroup = IPTV.currentGroup;
          }
          IPTV.searchQuery = q;
          IPTV.currentGroup = q ? "search" : (IPTV.previousGroup || "all");
          IPTV.renderLimit = cfg("iptvChannelsDisplayMax", 500);
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
        IPTV.currentGroup = IPTV.previousGroup || "all";
        IPTV.renderLimit = cfg("iptvChannelsDisplayMax", 500);
        renderChannels();
      });
    }

    var viewToggle = $("iptvViewToggle");
    if(viewToggle){
      viewToggle.addEventListener("click", function(e){
        e.preventDefault();
        e.stopPropagation();
        IPTV.viewMode = IPTV.viewMode === "grid" ? "list" : "grid";
        saveViewMode();
        viewToggle.textContent = IPTV.viewMode === "grid" ? "⊞" : "☷";
        renderChannels();
      });
    }

    var groupPanel = $("iptvGroupsPanel");
    if(groupPanel && !IPTV._groupsBound){
      IPTV._groupsBound = true;
      groupPanel.addEventListener("click", function(e){
        if(e.target === groupPanel) closeGroupsPanel();
      });
      var gpc = $("iptvGroupsPanelClose");
      if(gpc) gpc.addEventListener("click", closeGroupsPanel);
      var gps = $("iptvGroupsSearch");
      if(gps) gps.addEventListener("input", function(){ renderGroupsList(gps.value.trim()); });
      var gsort = $("iptvGroupsSort");
      if(gsort){
        gsort.addEventListener("click", function(){
          IPTV.groupsSort = IPTV.groupsSort === "count" ? "name" : "count";
          var lbl = $("iptvGroupsSortLabel");
          if(lbl) lbl.textContent = IPTV.groupsSort === "count" ? "Aantal" : "Naam";
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
          IPTV.previousGroup = g;
          if(IPTV.searchQuery){
            IPTV.searchQuery = "";
            var sInp = $("iptvSearch");
            if(sInp) sInp.value = "";
          }
          closeGroupsPanel();
          IPTV.renderLimit = cfg("iptvChannelsDisplayMax", 500);
          renderChannels();
        });
      }
    }

    var playerClose = $("iptvPlayerClose");
    if(playerClose) playerClose.addEventListener("click", closePlayer);

    var playerFs = $("iptvPlayerFs");
    if(playerFs) playerFs.addEventListener("click", toggleFullscreen);

    var playBtn = $("iptvPlayerPlay");
    if(playBtn){
      playBtn.addEventListener("click", function(){
        var v = $("iptvVideo");
        if(!v) return;
        if(v.paused) v.play().catch(function(){});
        else v.pause();
        setTimeout(updatePlayBtn, 100);
      });
    }

    var stopBtn = $("iptvPlayerStop");
    if(stopBtn){
      stopBtn.addEventListener("click", function(){
        var v = $("iptvVideo");
        if(!v) return;
        v.pause();
        try { v.currentTime = 0; }catch(e){}
        if(IPTV.hlsInstance){ try{ IPTV.hlsInstance.stopLoad(); }catch(e){} }
        updatePlayBtn();
      });
    }

    var pipBtn = $("iptvPlayerPip");
    if(pipBtn) pipBtn.addEventListener("click", togglePiP);

    var copyBtn = $("iptvCopyUrl");
    if(copyBtn) copyBtn.addEventListener("click", function(){
      var urlToCopy = IPTV.currentChannel && IPTV.currentChannel.url;
      if(!urlToCopy){
        var v = $("iptvVideo");
        if(v && v.src && v.src.indexOf("blob:") !== 0) urlToCopy = v.src;
      }
      if(urlToCopy && navigator.clipboard){
        navigator.clipboard.writeText(urlToCopy).then(function(){
          if(window.showToast) window.showToast("Stream-URL gekopieerd");
        }).catch(function(){
          if(window.showToast) window.showToast("Kopieren mislukt");
        });
      } else {
        if(window.showToast) window.showToast("Geen URL beschikbaar");
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
        }catch(e){}
      });
      video.addEventListener("play", updatePlayBtn);
      video.addEventListener("pause", updatePlayBtn);
      video.addEventListener("ended", updatePlayBtn);
    }

    LOG("bindUI klaar");
  }

  function renderPills(){
    var wrap = $("iptvPills");
    if(!wrap) return;
    if(!IPTV.channels.length){ wrap.innerHTML = ""; return; }

    var totalCount = IPTV.channels.length;
    var groupsCount = Object.create(null);
    IPTV.channels.forEach(function(c){
      groupsCount[c.group] = (groupsCount[c.group] || 0) + 1;
    });
    var groupNumber = Object.keys(groupsCount).length;

    var leftHtml = '<button class="iptv-pill iptv-pill-eq iptv-pill-groups" data-action="open-groups" title="Alle groepen">☰ Groepen (' + groupNumber + ')</button>';
    var rightHtml = '<button class="iptv-pill iptv-pill-eq iptv-pill-allchannels ' + (IPTV.currentGroup === "all" ? "active" : "") + '" data-group="all" title="Alle kanalen">Alle kanalen (' + totalCount + ')</button>';

    wrap.innerHTML =
      '<div class="iptv-pills-left">' + leftHtml + '</div>' +
      '<div class="iptv-pills-right">' + rightHtml + '</div>';
  }

  function getVisibleChannels(){
    var list = IPTV.channels;
    if(IPTV.currentGroup === "search" && IPTV.searchQuery){
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

  // PERFORMANCE: Chunked rendering
  function renderChannelsChunked(list){
    var grid = $("iptvGrid");
    if(!grid) return;

    if(IPTV._renderChunkTimer) {
      cancelAnimationFrame(IPTV._renderChunkTimer);
      IPTV._renderChunkTimer = null;
    }

    grid.innerHTML = "";
    var chunkSize = 50;
    var index = 0;

    function renderChunk(){
      var fragment = document.createDocumentFragment();
      var end = Math.min(index + chunkSize, list.length);

      for(var i = index; i < end; i++){
        var c = list[i];
        var color = groupColor(c.group, c.name);
        var initial = (c.name || "?").charAt(0).toUpperCase();
        var logoHtml;
        if(c.logo){
          logoHtml = '<img src="' + esc(c.logo) + '" loading="lazy" alt="" data-initial="' + esc(initial) + '" onerror="this.replaceWith(document.createTextNode(this.dataset.initial))">';
        } else {
          logoHtml = esc(initial);
        }
        var workingDot = isWorking(c) ? '<span class="iptv-ch-working" title="Recent werkend"></span>' : '';
        var html = '<button class="iptv-ch" data-idx="' + i + '" style="--ch-color:' + color + '">';
        html += '<div class="iptv-ch-logo">' + logoHtml + workingDot + '</div>';
        html += '<div class="iptv-ch-info">';
        html += '<div class="iptv-ch-name">' + esc(c.name) + '</div>';
        html += '<div class="iptv-ch-group">' + esc(c.group) + '</div>';
        html += '</div>';
        html += '</button>';

        var temp = document.createElement('div');
        temp.innerHTML = html;
        fragment.appendChild(temp.firstElementChild);
      }

      grid.appendChild(fragment);
      index = end;

      if(index < list.length){
        IPTV._renderChunkTimer = requestAnimationFrame(renderChunk);
      } else {
        IPTV._renderChunkTimer = null;
        bindGridEvents(list);
      }
    }

    IPTV._renderChunkTimer = requestAnimationFrame(renderChunk);
  }

  function bindGridEvents(list){
    var grid = $("iptvGrid");
    if(!grid || grid._iptvBound) return;
    
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

  function renderChannels(){
    var grid = $("iptvGrid");
    var count = $("iptvCount");
    var visibleEl = $("iptvVisibleCount");
    var searchWrap = $("iptvSearchWrap");
    var viewToggle = $("iptvViewToggle");
    var loadMoreWrap = $("iptvLoadMoreWrap");
    if(!grid) return;

    if(searchWrap) searchWrap.hidden = !IPTV.channels.length;
    if(viewToggle){
      viewToggle.hidden = !IPTV.channels.length;
      viewToggle.textContent = IPTV.viewMode === "grid" ? "⊞" : "☷";
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
      if(loadMoreWrap) loadMoreWrap.innerHTML = "";
      return;
    }

    var list = getVisibleChannels();
    IPTV.visibleList = list;

    if(count) count.textContent = list.length + " kanalen";

    if(!list.length){
      var msg;
      if(IPTV.currentGroup === "search") msg = 'Geen kanalen gevonden voor "' + esc(IPTV.searchQuery) + '"';
      else msg = "Geen kanalen in deze groep";
      grid.innerHTML = '<div class="empty-state">' +
        '<div class="empty-icon">🔍</div>' +
        '<div class="empty-msg">' + msg + '</div>' +
        '<div class="empty-hint">Kies een andere groep of wis je zoekopdracht</div>' +
        '</div>';
      if(visibleEl) visibleEl.textContent = "";
      if(loadMoreWrap) loadMoreWrap.innerHTML = "";
      return;
    }

    var limit = IPTV.renderLimit || 500;
    var toShow = list.slice(0, limit);
    
    renderChannelsChunked(toShow);

    if(visibleEl){
      visibleEl.textContent = "Toon " + toShow.length + " van " + list.length + " kanalen";
    }

    if(loadMoreWrap){
      if(list.length > limit){
        loadMoreWrap.innerHTML = '<button class="iptv-load-more" id="iptvLoadMoreBtn">Meer laden (' + (list.length - limit) + ' resterend)</button>';
        var lmBtn = $("iptvLoadMoreBtn");
        if(lmBtn){
          lmBtn.addEventListener("click", function(){
            IPTV.renderLimit = limit + 500;
            renderChannels();
          });
        }
      } else {
        loadMoreWrap.innerHTML = "";
      }
    }
  }

  function closePlayer(){
    IPTV._playToken++;
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
    var video = $("iptvVideo");
    if(!box) return;
    if(!document.fullscreenElement){
      if(box.requestFullscreen){
        box.requestFullscreen().catch(function(){
          if(video && video.webkitEnterFullscreen) video.webkitEnterFullscreen();
        });
      } else if(box.webkitRequestFullscreen){
        box.webkitRequestFullscreen();
      } else if(video && video.webkitEnterFullscreen){
        video.webkitEnterFullscreen();
      } else {
        if(window.showToast) window.showToast("Fullscreen niet ondersteund");
      }
    } else {
      if(document.exitFullscreen) document.exitFullscreen().catch(function(){});
      else if(document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  }

  function loadHls(cdnIndex){
    if(IPTV.hlsLoaded && window.Hls) return Promise.resolve(true);
    if(IPTV.hlsPromise) return IPTV.hlsPromise;

    var cdns = cfg("iptvHlsCdns", [
      "https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js",
      "https://unpkg.com/hls.js@1/dist/hls.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.15/hls.min.js"
    ]);

    IPTV.hlsPromise = (function(){
      function tryLoad(idx){
        if(idx >= cdns.length) return Promise.resolve(false);
        return new Promise(function(res){
          var s = document.createElement("script");
          s.src = cdns[idx];
          s.onload = function(){
            if(window.Hls){ IPTV.hlsLoaded = true; res(true); }
            else { s.remove(); tryLoad(idx + 1).then(res); }
          };
          s.onerror = function(){
            LOG("HLS CDN " + idx + " faalde, probeer volgende...");
            s.remove();
            tryLoad(idx + 1).then(res);
          };
          document.head.appendChild(s);
        });
      }
      return tryLoad(0);
    })();

    return IPTV.hlsPromise;
  }

  function vlcOpen(url, channelName){
    IPTV.vlcOpenTime = Date.now();
    IPTV.vlcDidHide = false;
    clearTimeout(IPTV.vlcWatchdog);
    IPTV.vlcWatchdog = setTimeout(function(){
      if(!IPTV.vlcDidHide){
        if(window.showToast) window.showToast("VLC opent niet - is VLC geinstalleerd?");
      }
    }, 3000);
    try{
      var m = String(url).match(/^(https?):\/\/(.+)$/i);
      if(!m){
        window.location.href = url;
        return;
      }
      var scheme = m[1];
      var rest = m[2];
      var title = encodeURIComponent(channelName || "WAR DESK");
      var intentUrl = "intent://" + rest + "#Intent;scheme=" + scheme + ";package=org.videolan.vlc;type=video/*;S.title=" + title + ";end";
      LOG("VLC intent:", intentUrl);
      window.location.href = intentUrl;
    }catch(e){
      clearTimeout(IPTV.vlcWatchdog);
      if(window.showToast) window.showToast("VLC openen mislukt");
    }
  }

  document.addEventListener("visibilitychange", function(){
    if(document.hidden){
      saveCredsImmediate();
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
    if(!ch) return;
    var url = ch.url;
    var isHttp = /^http:\/\//i.test(url);
    var isHttpsPage = location.protocol === "https:";
    if(isHttp && isHttpsPage){ vlcOpen(url, ch.name); return; }

    IPTV.currentChannel = ch;
    var myToken = ++IPTV._playToken;

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

    var markAndUpdate = function(){
      if(myToken !== IPTV._playToken) return;
      markWorking(ch);
      var btns = document.querySelectorAll(".iptv-ch");
      for(var i = 0; i < btns.length; i++){
        var idx = parseInt(btns[i].dataset.idx, 10);
        if(isNaN(idx)) continue;
        var c = IPTV.visibleList[idx];
        if(c && c.id === ch.id){
          var logo = btns[i].querySelector(".iptv-ch-logo");
          if(logo && !logo.querySelector(".iptv-ch-working")){
            var dot = document.createElement("span");
            dot.className = "iptv-ch-working";
            dot.title = "Recent werkend";
            logo.appendChild(dot);
          }
          break;
        }
      }
    };

    if(isHls && video.canPlayType("application/vnd.apple.mpegurl")){
      video.src = url;
      if(status) status.textContent = "HLS native";
      video.play().then(function(){
        if(myToken !== IPTV._playToken) return;
        if(spinner) spinner.classList.remove("show");
        if(status) status.textContent = "Live - native";
        markAndUpdate();
        updatePlayBtn();
      }).catch(function(){
        if(myToken !== IPTV._playToken) return;
        if(spinner) spinner.classList.remove("show");
        if(status) status.textContent = "Klik play om te starten";
        updatePlayBtn();
        if(window.showToast) window.showToast("Stream kon niet automatisch starten. Tik op play.");
      });
    } else if(isHls){
      if(status) status.textContent = "HLS.js laden...";
      loadHls(0).then(function(ok){
        if(myToken !== IPTV._playToken) return;
        if(ok && window.Hls && window.Hls.isSupported()){
          IPTV.hlsInstance = new window.Hls({enableWorker:true});
          IPTV.hlsInstance.loadSource(url);
          IPTV.hlsInstance.attachMedia(video);
          IPTV.hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, function(){
            if(myToken !== IPTV._playToken) return;
            if(spinner) spinner.classList.remove("show");
            updateQualityLevels(IPTV.hlsInstance);
            var lvl = IPTV.hlsInstance.levels[IPTV.hlsInstance.currentLevel];
            var resTxt = lvl && lvl.height ? lvl.height + "p" : "auto";
            if(status) status.textContent = "Live - " + resTxt;
            markAndUpdate();
            video.play().catch(function(){});
            updatePlayBtn();
          });
          IPTV.hlsInstance.on(window.Hls.Events.LEVEL_SWITCHED, function(e, data){
            if(myToken !== IPTV._playToken) return;
            var lvl = IPTV.hlsInstance.levels[data.level];
            if(lvl && lvl.height && status) status.textContent = "Live - " + lvl.height + "p";
          });
          IPTV.hlsInstance.on(window.Hls.Events.ERROR, function(e, data){
            if(myToken !== IPTV._playToken) return;
            if(data.fatal){
              if(spinner) spinner.classList.remove("show");
              if(status) status.textContent = "Streamfout: " + data.details;
              if(window.showToast) window.showToast("Streamfout: " + data.details);
            }
          });
        } else {
          if(spinner) spinner.classList.remove("show");
          if(status) status.textContent = "HLS niet ondersteund. Gebruik VLC.";
          if(window.showToast) window.showToast("HLS niet ondersteund. Gebruik VLC.");
        }
      });
    } else {
      video.src = url;
      if(status) status.textContent = "Directe stream";
      video.play().then(function(){
        if(myToken !== IPTV._playToken) return;
        if(spinner) spinner.classList.remove("show");
        if(status) status.textContent = "Actief";
        markAndUpdate();
        updatePlayBtn();
      }).catch(function(){
        if(myToken !== IPTV._playToken) return;
        if(spinner) spinner.classList.remove("show");
        if(status) status.textContent = "Klik play om te starten";
        updatePlayBtn();
        if(window.showToast) window.showToast("Stream kon niet automatisch starten. Tik op play.");
      });
    }
  }

  async function init(){
    if(IPTV._initialized){ LOG("init al gedaan, skip"); return; }
    IPTV._initialized = true;

    try{
      LOG("init start");
      await openDB();
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
        IPTV.renderLimit = cfg("iptvChannelsDisplayMax", 500);

        applyDefaultGroup();

        var setup = $("iptvSetup");
        if(setup) setup.hidden = true;
        renderChannels();
      }

      bindUI();
      LOG("init klaar");
    }catch(e){
      LOG("init FOUT:", e);
      if(window.showToast) window.showToast("IPTV kon niet initialiseren.");
    }
  }

  // DE BRUG: IPTVAPI voor compatibiliteit
  window.IPTVAPI = { init: init, state: IPTV };

  function start(){ init(); }
  if(document.readyState === "complete" || document.readyState === "interactive") setTimeout(start, 200);
  else document.addEventListener("DOMContentLoaded", function(){ setTimeout(start, 200); });
  window.addEventListener("load", function(){ setTimeout(start, 500); });

  console.log("[WAR DESK] iptv-v8.js v8.0 geladen");
})();