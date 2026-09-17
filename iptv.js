/* ============================================================
   WAR DESK v2.6 — IPTV (Xtream Codes)
   ============================================================ */

(function(){
  "use strict";

  var $ = function(id){ return document.getElementById(id); };
  var LOG = function(){ try{ console.log.apply(console, ["[IPTV]"].concat(Array.prototype.slice.call(arguments))); }catch(e){} };

  LOG("v2.6 geladen");

  var IPTV = {
    server: "", user: "", pass: "",
    channels: [],
    currentGroup: "all",
    hlsInstance: null,
    hlsLoaded: false,
    db: null,
    vlcOpenTime: 0,
    vlcWatchdog: null,
    vlcDidHide: false
  };

  /* ===== DB ===== */
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

  /* ===== KLEUR ===== */
  function langColor(group, name){
    var t = ((group || "") + " " + (name || "")).toLowerCase();
    if(/\b(nl|nederland|netherlands|dutch|holland)\b/.test(t)) return "#fb923c";
    if(/\b(arab|arabic|arabisch|maroc|morocco|eg|egypt|sa|saudi|uae|qatar|iraq|lebanon|syria|jordan)\b/.test(t)) return "#10b981";
    if(/\b(uk|usa|eng|english|british|america|canada|australia|ireland)\b/.test(t)) return "#3b82f6";
    if(/\b(sport|voetbal|football|espn|ziggo|fox|sky sport|eurosport)\b/.test(t)) return "#f59e0b";
    if(/\b(tr|turkey|turk|türk)\b/.test(t)) return "#ef4444";
    if(/\b(fr|france|frans)\b/.test(t)) return "#0ea5e9";
    if(/\b(de|germany|duits|german|deutsch)\b/.test(t)) return "#94a3b8";
    if(/\b(es|spain|spanish)\b/.test(t)) return "#ef4444";
    if(/\b(it|italy|italian|italiano)\b/.test(t)) return "#22c55e";
    return "#6b7a93";
  }

  function esc(s){
    return (s || "").replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }

  /* ===== API ===== */
  function buildUrl(action){
    var base = IPTV.server.trim().replace(/\/$/, "");
    if(!base || !IPTV.user || !IPTV.pass) throw new Error("Vul alle velden in");
    var params = "username=" + encodeURIComponent(IPTV.user) + "&password=" + encodeURIComponent(IPTV.pass);
    if(action) params += "&action=" + action;
    return base + "/player_api.php?" + params;
  }

  function fetchJson(url){
    var proxy = (window.CONFIG && CONFIG.proxy) || "https://nieuwsproxy.hassanbadri814.workers.dev/?url=";
    var ctrl = new AbortController();
    var timer = setTimeout(function(){ ctrl.abort(); }, 45000);
    return fetch(proxy + encodeURIComponent(url), {signal: ctrl.signal})
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

  /* ===== UI ===== */
  function setStatus(msg, type){
    var el = $("iptvStatus");
    if(!el) return;
    el.className = "iptv-status" + (type ? " " + type : "");
    el.textContent = msg || "";
  }

  /* ===== CORE FUNCTIES ===== */
  async function loadChannels(){
    var s = $("iptvServer"), u = $("iptvUser"), p = $("iptvPass");
    IPTV.server = ((s && s.value) || "").trim();
    IPTV.user = ((u && u.value) || "").trim();
    IPTV.pass = (p && p.value) || "";

    if(!IPTV.server || !IPTV.user || !IPTV.pass){
      setStatus("✗ Vul alle velden in", "err");
      return;
    }

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
    var sEl = $("iptvServer"); if(sEl) sEl.value = "";
    var uEl = $("iptvUser"); if(uEl) uEl.value = "";
    var pEl = $("iptvPass"); if(pEl) pEl.value = "";
    var setup = $("iptvSetup"); if(setup) setup.hidden = false;
    var filter = $("iptvFilter"); if(filter) filter.hidden = true;
    var t = document.querySelector('.tab[data-view="iptv"]');
    if(t) t.click();
    renderChannels();
    setStatus("✓ Alles gewist", "ok");
  }

  window.__iptvLoadChannels = loadChannels;
  window.__iptvClearChannels = clearChannelsOnly;
  window.__iptvClearAll = clearAll;

  /* ===== BIND UI ===== */
  function bindUI(){
    LOG("bindUI start");

    var pwToggle = $("iptvPwToggle");
    if(pwToggle){
      pwToggle.addEventListener("click", function(){
        var p = $("iptvPass");
        if(p.type === "password"){ p.type = "text"; this.textContent = "🙈"; }
        else { p.type = "password"; this.textContent = "👁"; }
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
      var t;
      el.addEventListener("input", function(){
        clearTimeout(t);
        t = setTimeout(saveCreds, 400);
      });
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

    var groupFilter = $("iptvGroupFilter");
    if(groupFilter){
      groupFilter.addEventListener("change", function(){
        IPTV.currentGroup = this.value;
        renderChannels();
      });
    }

    var playerClose = $("iptvPlayerClose");
    if(playerClose) playerClose.addEventListener("click", closePlayer);

    var player = $("iptvPlayer");
    if(player) player.addEventListener("click", function(e){
      if(e.target.id === "iptvPlayer") closePlayer();
    });

    LOG("bindUI klaar");
  }

  function renderChannels(){
    var grid = $("iptvGrid");
    var filter = $("iptvFilter");
    var count = $("iptvCount");
    if(!grid) return;

    if(!IPTV.channels.length){
      grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📡</div><div class="empty-msg">Geen kanalen</div></div>';
      if(filter) filter.hidden = true;
      if(count) count.textContent = "0 kanalen";
      return;
    }

    if(filter) filter.hidden = false;

    var groups = [], seen = {};
    IPTV.channels.forEach(function(c){
      if(!seen[c.group]){ seen[c.group] = 1; groups.push(c.group); }
    });

    var sel = $("iptvGroupFilter");
    if(sel){
      var current = sel.value;
      sel.innerHTML = '<option value="all">Alle groepen (' + IPTV.channels.length + ')</option>' +
        groups.map(function(g){
          var n = IPTV.channels.filter(function(c){ return c.group === g; }).length;
          return '<option value="' + esc(g) + '">' + esc(g) + ' (' + n + ')</option>';
        }).join("");
      if(groups.indexOf(current) >= 0 || current === "all") sel.value = current;
      else { sel.value = "all"; IPTV.currentGroup = "all"; }
    }

    var list = IPTV.currentGroup === "all"
      ? IPTV.channels
      : IPTV.channels.filter(function(c){ return c.group === IPTV.currentGroup; });

    if(count) count.textContent = list.length + " kanalen";

    if(!list.length){
      grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📡</div><div class="empty-msg">Geen kanalen in deze groep</div></div>';
      return;
    }

    var html = "";
    list.forEach(function(c, i){
      var color = langColor(c.group, c.name);
      var initial = (c.name || "?").charAt(0).toUpperCase();
      var logoHtml = c.logo
        ? '<img src="' + esc(c.logo) + '" loading="lazy" alt="" onerror="this.parentNode.textContent=\'' + initial + '\'">'
        : initial;
      html += '<button class="iptv-ch" data-idx="' + i + '" style="--ch-color:' + color + '">';
      html += '<div class="iptv-ch-logo">' + logoHtml + '</div>';
      html += '<div class="iptv-ch-name">' + esc(c.name) + '</div>';
      html += '</button>';
    });
    grid.innerHTML = html;

    Array.prototype.forEach.call(grid.querySelectorAll(".iptv-ch"), function(btn, i){
      btn.addEventListener("click", function(){ playChannel(list[i]); });
    });
  }

  /* ===== PLAYER ===== */
  function closePlayer(){
    var p = $("iptvPlayer");
    if(p) p.classList.remove("show");
    if(IPTV.hlsInstance){ try{ IPTV.hlsInstance.destroy(); }catch(e){} IPTV.hlsInstance = null; }
    var v = $("iptvVideo");
    if(v){ v.pause(); v.removeAttribute("src"); v.load(); }
  }

  function loadHls(){
    if(IPTV.hlsLoaded && window.Hls) return Promise.resolve(true);
    return new Promise(function(res){
      var s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js";
      s.onload = function(){ IPTV.hlsLoaded = true; res(true); };
      s.onerror = function(){ res(false); };
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

  function playChannel(ch){
    var url = ch.url;
    var isHttp = /^http:\/\//i.test(url);
    var isHttpsPage = location.protocol === "https:";

    if(isHttp && isHttpsPage){
      vlcOpen(url, ch.name);
      return;
    }

    var overlay = $("iptvPlayer");
    var title = $("iptvPlayerTitle");
    var video = $("iptvVideo");
    var status = $("iptvPlayerStatus");
    if(!overlay || !video) return;

    if(title) title.textContent = ch.name;
    overlay.classList.add("show");
    if(IPTV.hlsInstance){ try{ IPTV.hlsInstance.destroy(); }catch(e){} IPTV.hlsInstance = null; }
    video.pause(); video.removeAttribute("src"); video.load();

    var isHls = /\.m3u8(\?|$)/i.test(url);

    if(isHls && video.canPlayType("application/vnd.apple.mpegurl")){
      video.src = url;
      status.innerHTML = '<span class="iptv-spinner"></span>HLS native';
      video.play().catch(function(){ status.textContent = "Klik play om te starten"; });
    } else if(isHls){
      status.innerHTML = '<span class="iptv-spinner"></span>HLS.js laden...';
      loadHls().then(function(ok){
        if(ok && window.Hls && window.Hls.isSupported()){
          IPTV.hlsInstance = new window.Hls({enableWorker:true});
          IPTV.hlsInstance.loadSource(url);
          IPTV.hlsInstance.attachMedia(video);
          IPTV.hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, function(){
            status.textContent = "Stream actief";
            video.play().catch(function(){});
          });
          IPTV.hlsInstance.on(window.Hls.Events.ERROR, function(e, data){
            if(data.fatal) status.innerHTML = 'Streamfout: ' + data.details;
          });
        } else {
          status.innerHTML = 'HLS niet ondersteund. Gebruik VLC.';
        }
      });
    } else {
      video.src = url;
      status.textContent = "Directe stream";
      video.play().catch(function(){ status.textContent = "Klik play om te starten"; });
    }
  }

  /* ===== INIT ===== */
  async function init(){
    try{
      LOG("init start");
      await openDB();

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