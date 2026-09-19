/* ============================================================
   WAR DESK v2.2 — VOD (Stremio via Cinemeta)
   - FIX: skeletons worden verwijderd vóór items worden geplaatst
   - FIX: isLoading reset bij cache-hit
   - FIX: onerror crash bij wisselen categorieën
   - Race-conditie, timeout, skeleton, zoekfunctie
   ============================================================ */

(function(){
  "use strict";

  var $ = function(id){ return document.getElementById(id); };
  var LOG = function(){ try{ console.log.apply(console, ["[VOD]"].concat(Array.prototype.slice.call(arguments))); }catch(e){} };
  LOG("v2.2 geladen");

  var CINEMETA_BASE = "https://v3-cinemeta.strem.io";

  var VOD = {
    currentCatId: "movie/top",
    currentType: "movie",
    currentLabel: "Top films",
    currentSkip: 0,
    currentItems: [],
    currentDetail: null,
    cache: new Map(),
    cacheMaxSize: 30,
    isLoading: false,
    loadToken: 0,
    _initialized: false,
    _sidebarBound: false,
    _gridBound: false,
    _searchValue: ""
  };

  var CATS = [
    { group: "Populair", items: [
      { id: "movie/top",  label: "Top films",  color: "#e0a857" },
      { id: "series/top", label: "Top series", color: "#e0a857" }
    ]},
    { group: "Film genres", items: [
      { id: "movie/top/genre=Action",     label: "Actie",    color: "#ef4444" },
      { id: "movie/top/genre=Comedy",     label: "Komedie",  color: "#f59e0b" },
      { id: "movie/top/genre=Drama",      label: "Drama",    color: "#a855f7" },
      { id: "movie/top/genre=Sci-Fi",     label: "Sci-Fi",   color: "#06b6d4" },
      { id: "movie/top/genre=Thriller",   label: "Thriller", color: "#8b5cf6" }
    ]},
    { group: "Serie genres", items: [
      { id: "series/top/genre=Action",    label: "Actie",    color: "#ef4444" },
      { id: "series/top/genre=Comedy",    label: "Komedie",  color: "#f59e0b" },
      { id: "series/top/genre=Drama",     label: "Drama",    color: "#a855f7" },
      { id: "series/top/genre=Sci-Fi",    label: "Sci-Fi",   color: "#06b6d4" },
      { id: "series/top/genre=Thriller",  label: "Thriller", color: "#8b5cf6" }
    ]}
  ];

  function esc(s){
    return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }

  function getProxies(){
    if(window.CONFIG && CONFIG.proxies && CONFIG.proxies.length){
      return CONFIG.proxies.slice();
    }
    return ["https://newsfeed2.hassanbadri814.workers.dev/?url="];
  }

  function fetchJsonDirect(url, timeoutMs){
    var ctrl = new AbortController();
    var timer = setTimeout(function(){ ctrl.abort(); }, timeoutMs || 12000);
    return fetch(url, { method: "GET", signal: ctrl.signal })
      .then(function(r){
        clearTimeout(timer);
        if(!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .catch(function(e){
        clearTimeout(timer);
        throw e;
      });
  }

  function fetchJsonViaProxy(url){
    var proxies = getProxies();
    var lastErr = null;
    function tryProxy(idx){
      if(idx >= proxies.length) return Promise.reject(lastErr || new Error("Alle proxies faalden"));
      var proxy = proxies[idx];
      var ctrl = new AbortController();
      var timer = setTimeout(function(){ ctrl.abort(); }, 15000);
      return fetch(proxy + encodeURIComponent(url), { method: "GET", signal: ctrl.signal })
        .then(function(r){
          clearTimeout(timer);
          if(!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
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

  function fetchJson(url){
    return fetchJsonDirect(url, 12000).catch(function(e){
      LOG("Direct faalde:", e.message, "- probeer proxy");
      return fetchJsonViaProxy(url);
    });
  }

  function buildCatalogUrl(catId, skip){
    var url = CINEMETA_BASE + "/catalog/" + catId;
    if(typeof skip === "number" && skip > 0){
      url += "/skip=" + skip;
    }
    return url + ".json";
  }

  function buildSearchUrl(type, query, skip){
    var url = CINEMETA_BASE + "/catalog/" + type + "/top/search=" + encodeURIComponent(query);
    if(typeof skip === "number" && skip > 0){
      url += "/skip=" + skip;
    }
    return url + ".json";
  }

  function buildMetaUrl(type, id){
    return CINEMETA_BASE + "/meta/" + type + "/" + encodeURIComponent(id) + ".json";
  }

  function cacheGet(key){
    var entry = VOD.cache.get(key);
    return entry ? entry.items : null;
  }
  function cacheSet(key, items){
    VOD.cache.set(key, { items: items, t: Date.now() });
    if(VOD.cache.size > VOD.cacheMaxSize){
      var oldestKey = null;
      var oldestT = Infinity;
      VOD.cache.forEach(function(v, k){
        if(v.t < oldestT){ oldestT = v.t; oldestKey = k; }
      });
      if(oldestKey) VOD.cache.delete(oldestKey);
    }
  }

  function renderSidebar(){
    var wrap = $("vodSidebar");
    if(!wrap) return;
    var html = "";
    CATS.forEach(function(group){
      html += '<div class="vod-sidebar-group">';
      html += '<div class="vod-sidebar-title">' + group.group + '</div>';
      group.items.forEach(function(item){
        var isActive = VOD.currentCatId === item.id;
        html += '<button class="vod-sidebar-item ' + (isActive ? "active" : "") + '" data-cat="' + item.id + '" data-label="' + esc(item.label) + '" aria-label="Categorie: ' + esc(item.label) + '">';
        html += '<span class="vod-sidebar-dot" style="background:' + item.color + '"></span>';
        html += '<span class="vod-sidebar-label">' + item.label + '</span>';
        html += '</button>';
      });
      html += '</div>';
    });
    wrap.innerHTML = html;

    if(!VOD._sidebarBound){
      VOD._sidebarBound = true;
      wrap.addEventListener("click", function(e){
        var btn = e.target.closest(".vod-sidebar-item");
        if(!btn) return;
        var catId = btn.dataset.cat;
        var label = btn.dataset.label || "";
        if(!catId) return;
        if(catId === VOD.currentCatId && !VOD._searchValue) return;

        VOD._searchValue = "";
        var searchInput = $("vodSearchInput");
        if(searchInput) searchInput.value = "";

        VOD.currentCatId = catId;
        VOD.currentLabel = label;
        VOD.currentType = catId.indexOf("series/") === 0 ? "series" : "movie";
        VOD.currentSkip = 0;
        VOD.currentItems = [];

        var grid = $("vodGrid");
        if(grid) grid.innerHTML = "";
        var lmWrap = $("vodLoadMoreWrap");
        if(lmWrap) lmWrap.innerHTML = "";

        renderSidebar();
        loadCatalog(false);
      });
    }
  }

  function showSkeletons(){
    var grid = $("vodGrid");
    if(!grid) return;
    var html = "";
    for(var i = 0; i < 12; i++){
      html += '<div class="vod-skeleton">';
      html += '<div class="vod-skeleton-img"></div>';
      html += '<div class="vod-skeleton-line"></div>';
      html += '<div class="vod-skeleton-line short"></div>';
      html += '</div>';
    }
    grid.innerHTML = html;
  }

  async function loadCatalog(loadMore){
    var grid = $("vodGrid");
    if(!grid) return;

    var myToken = ++VOD.loadToken;

    if(loadMore && VOD.isLoading) return;

    if(!loadMore){
      VOD.currentSkip = 0;
      VOD.currentItems = [];
      grid.innerHTML = "";
      showSkeletons();
      var lmReset = $("vodLoadMoreWrap");
      if(lmReset) lmReset.innerHTML = "";
    }

    var url;
    if(VOD._searchValue){
      url = buildSearchUrl(VOD.currentType, VOD._searchValue, VOD.currentSkip);
    } else {
      url = buildCatalogUrl(VOD.currentCatId, VOD.currentSkip);
    }

    var cacheKey = "c::" + url;
    var cached = cacheGet(cacheKey);
    if(cached){
      if(myToken !== VOD.loadToken) return;
      VOD.isLoading = false;
      /* FIX v2.2: verwijder skeletons vóór items worden geplaatst */
      if(!loadMore) grid.innerHTML = "";
      appendItems(cached);
      updateHeaderCount();
      updateLoadMore(cached.length);
      return;
    }

    VOD.isLoading = true;
    var loadingEl = $("vodLoading");
    if(loadingEl && loadMore) loadingEl.style.display = "block";

    try{
      LOG("Fetch:", url);
      var data = await fetchJson(url);

      if(myToken !== VOD.loadToken) return;

      var items = (data && data.metas) ? data.metas : [];
      LOG(items.length + " items");

      cacheSet(cacheKey, items);
      /* FIX v2.2: verwijder skeletons vóór items worden geplaatst */
      if(!loadMore) grid.innerHTML = "";
      appendItems(items);
      updateHeaderCount();
      updateLoadMore(items.length);
    }catch(e){
      if(myToken !== VOD.loadToken) return;
      LOG("Fout:", e.message);
      if(!loadMore){
        grid.innerHTML = '<div class="vod-empty">Kon niets laden. Controleer je verbinding en probeer opnieuw.</div>';
      } else {
        var lm = $("vodLoadMoreWrap");
        if(lm) lm.innerHTML = '<div class="vod-empty" style="padding:1rem">Kon niet meer laden.</div>';
      }
    } finally {
      if(myToken === VOD.loadToken){
        VOD.isLoading = false;
        if(loadingEl) loadingEl.style.display = "none";
      }
    }
  }

  function appendItems(items){
    var grid = $("vodGrid");
    if(!grid) return;

    if(!items.length){
      if(!VOD.currentItems.length){
        grid.innerHTML = '<div class="vod-empty">Geen resultaten.</div>';
      }
      return;
    }

    var html = "";
    items.forEach(function(it, i){
      var idx = VOD.currentItems.length + i;
      var poster = it.poster || "";
      var name = it.name || "?";
      var year = it.releaseInfo || it.year || "";
      var rating = it.imdbRating ? "⭐ " + it.imdbRating : "";
      var initial = name.charAt(0).toUpperCase();

      html += '<button class="vod-poster" data-idx="' + idx + '" aria-label="Open ' + esc(name) + '">';
      if(poster){
        html += '<div class="vod-poster-img"><img src="' + esc(poster) + '" loading="lazy" alt="Poster van ' + esc(name) + '" onerror="this.style.display=\'none\'; if(this.parentNode) this.parentNode.innerHTML=\'<span class=&quot;vod-poster-fallback&quot;>' + esc(initial) + '</span>\'"></div>';
      } else {
        html += '<div class="vod-poster-img"><span class="vod-poster-fallback">' + esc(initial) + '</span></div>';
      }
      html += '<div class="vod-poster-body">';
      html += '<div class="vod-poster-name">' + esc(name) + '</div>';
      html += '<div class="vod-poster-meta">' + esc(year) + (rating ? ' · ' + esc(rating) : '') + '</div>';
      html += '</div>';
      html += '</button>';
    });

    grid.insertAdjacentHTML("beforeend", html);
    VOD.currentItems = VOD.currentItems.concat(items);

    if(!VOD._gridBound){
      VOD._gridBound = true;
      grid.addEventListener("click", function(e){
        var btn = e.target.closest(".vod-poster");
        if(!btn) return;
        var idx = parseInt(btn.dataset.idx, 10);
        if(isNaN(idx)) return;
        var item = VOD.currentItems[idx];
        if(item) openDetail(item);
      });
    }
  }

  function updateLoadMore(receivedCount){
    var wrap = $("vodLoadMoreWrap");
    if(!wrap) return;
    if(receivedCount >= 100){
      wrap.innerHTML = '<button class="vod-load-more" id="vodLoadMoreBtn">Meer laden</button>';
      var btn = $("vodLoadMoreBtn");
      if(btn){
        btn.addEventListener("click", function(){
          VOD.currentSkip += 100;
          loadCatalog(true);
        });
      }
    } else {
      wrap.innerHTML = '';
    }
  }

  function updateHeaderCount(){
    var countEl = $("vodCount");
    if(!countEl) return;
    var n = VOD.currentItems.length;
    var label = VOD._searchValue ? 'Zoeken: "' + VOD._searchValue + '"' : VOD.currentLabel;
    countEl.textContent = label + ' · ' + n + ' resultaten';
  }

  function bindSearch(){
    var input = $("vodSearchInput");
    var clearBtn = $("vodSearchClear");
    if(!input) return;

    var searchTimer;
    input.addEventListener("input", function(){
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function(){
        var q = input.value.trim();
        if(q.length < 2){
          if(VOD._searchValue){
            VOD._searchValue = "";
            VOD.currentSkip = 0;
            VOD.currentItems = [];
            var grid = $("vodGrid");
            if(grid){ grid.innerHTML = ""; showSkeletons(); }
            loadCatalog(false);
          }
          return;
        }
        VOD._searchValue = q;
        VOD.currentSkip = 0;
        VOD.currentItems = [];
        var grid2 = $("vodGrid");
        if(grid2){ grid2.innerHTML = ""; showSkeletons(); }
        loadCatalog(false);
      }, 500);
    });

    if(clearBtn){
      clearBtn.addEventListener("click", function(){
        input.value = "";
        if(VOD._searchValue){
          VOD._searchValue = "";
          VOD.currentSkip = 0;
          VOD.currentItems = [];
          var grid3 = $("vodGrid");
          if(grid3){ grid3.innerHTML = ""; showSkeletons(); }
          loadCatalog(false);
        }
      });
    }
  }

  function bindScrollTop(){
    var btn = $("vodScrollTop");
    if(!btn) return;
    function checkScroll(){
      var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
      btn.classList.toggle("show", scrollY > 400);
    }
    window.addEventListener("scroll", checkScroll, { passive: true });
    btn.addEventListener("click", function(){
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    checkScroll();
  }

  async function openDetail(item){
    var modal = $("vodDetailModal");
    if(!modal) return;

    VOD.currentDetail = item;
    document.body.style.overflow = "hidden";

    $("vodDetailTitle").textContent = item.name || "?";
    $("vodDetailMeta").textContent = "Laden...";
    $("vodDetailText").textContent = "";
    $("vodDetailPoster").innerHTML = item.poster
      ? '<img src="' + esc(item.poster) + '" alt="Poster van ' + esc(item.name || "") + '">'
      : '<span class="vod-poster-fallback">' + esc((item.name || "?").charAt(0)) + '</span>';

    modal.classList.add("show");

    var type = "movie";
    if(VOD.currentCatId && VOD.currentCatId.indexOf("series/") === 0){
      type = "series";
    } else if(VOD._searchValue && item.type){
      type = item.type === "series" ? "series" : "movie";
    }

    var metaUrl = buildMetaUrl(type, item.imdb_id || item.id);

    try{
      var data = await fetchJson(metaUrl);
      var meta = (data && data.meta) ? data.meta : null;
      if(meta){
        $("vodDetailTitle").textContent = meta.name || item.name;
        var metaParts = [];
        if(meta.releaseInfo) metaParts.push(meta.releaseInfo);
        if(meta.runtime) metaParts.push(meta.runtime);
        if(meta.imdbRating) metaParts.push("⭐ " + meta.imdbRating);
        if(meta.genres && meta.genres.length) metaParts.push(meta.genres.slice(0, 3).join(", "));
        $("vodDetailMeta").textContent = metaParts.join(" · ");
        $("vodDetailText").textContent = meta.description || meta.plot || item.description || "(geen beschrijving)";

        if(meta.poster){
          $("vodDetailPoster").innerHTML = '<img src="' + esc(meta.poster) + '" alt="Poster van ' + esc(meta.name || "") + '">';
        }

        var dl = buildStremioLink(type, meta.imdb_id || meta.id);
        var dlBtn = $("vodDetailOpenStremio");
        if(dlBtn){
          dlBtn.onclick = function(){
            try{ window.location.href = dl; }catch(e){
              if(window.showToast) window.showToast("Kon Stremio niet openen");
            }
          };
        }
      }
    }catch(e){
      LOG("Meta fout:", e.message);
      $("vodDetailMeta").textContent = "";
      $("vodDetailText").textContent = item.description || "(geen beschrijving)";
      var dl2 = buildStremioLink(type, item.imdb_id || item.id);
      var dlBtn2 = $("vodDetailOpenStremio");
      if(dlBtn2){
        dlBtn2.onclick = function(){
          try{ window.location.href = dl2; }catch(e){}
        };
      }
    }
  }

  function buildStremioLink(type, id){
    if(!id) return "stremio:///";
    return "stremio:///detail/" + type + "/" + encodeURIComponent(id);
  }

  function closeDetail(){
    var modal = $("vodDetailModal");
    if(modal) modal.classList.remove("show");
    document.body.style.overflow = "";
    VOD.currentDetail = null;
  }

  function bindDetailModal(){
    var modal = $("vodDetailModal");
    if(!modal) return;
    var closeBtn = $("vodDetailClose");
    var closeBtn2 = $("vodDetailCloseBtn");
    if(closeBtn) closeBtn.addEventListener("click", closeDetail);
    if(closeBtn2) closeBtn2.addEventListener("click", closeDetail);
    modal.addEventListener("click", function(e){
      if(e.target === modal) closeDetail();
    });
    document.addEventListener("keydown", function(e){
      if(e.key === "Escape" && modal.classList.contains("show")){
        closeDetail();
      }
    });
  }

  async function init(){
    if(VOD._initialized) return;
    VOD._initialized = true;
    LOG("init");
    renderSidebar();
    bindDetailModal();
    bindSearch();
    bindScrollTop();
    setTimeout(function(){
      showSkeletons();
      loadCatalog(false);
    }, 100);
  }

  window.__vodRefresh = function(){
    VOD.cache.clear();
    VOD.currentSkip = 0;
    VOD.currentItems = [];
    var grid = $("vodGrid");
    if(grid){ grid.innerHTML = ""; showSkeletons(); }
    loadCatalog(false);
  };
  window.VODAPI = { init: init, state: VOD };

  function autoInit(){
    var view = document.getElementById("viewVod");
    if(view && !view.hidden) init();
  }

  if(document.readyState !== "loading"){
    setTimeout(autoInit, 800);
  } else {
    document.addEventListener("DOMContentLoaded", function(){
      setTimeout(autoInit, 800);
    });
  }

  console.log("[WAR DESK] vod.js v2.2 geladen");
})();