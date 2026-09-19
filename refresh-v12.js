/* ============================================================
   WAR DESK v17.2 — Ronde verversingsknop
   - v12: Update-timer pauzeert op achtergrond (batterij)
   - Luistert naar "wardesk:feedprogress" van news.js
   ============================================================ */

(function(){
  "use strict";

  var $ = function(id){ return document.getElementById(id); };
  var APP_VERSION = window.APP_VERSION || "v11.0";

  function initRefresh(){
    var lastUpdate = null;
    var activeLoad = false;

    var headerActions = document.querySelector(".header-actions");
    if(!headerActions) return;

    var refreshBtn = document.createElement("button");
    refreshBtn.className = "btn-refresh";
    refreshBtn.id = "btnRefresh";
    refreshBtn.setAttribute("aria-label", "Verversen");
    refreshBtn.innerHTML =
      '<svg class="refresh-ring" viewBox="0 0 40 40" aria-hidden="true">' +
        '<circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" stroke-width="2" opacity="0.15"/>' +
        '<circle class="refresh-progress" cx="20" cy="20" r="17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="106.8" stroke-dashoffset="106.8" transform="rotate(-90 20 20)"/>' +
      '</svg>' +
      '<svg class="refresh-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<polyline points="23 4 23 10 17 10"/>' +
        '<polyline points="1 20 1 14 7 14"/>' +
        '<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>' +
      '</svg>';
    headerActions.appendChild(refreshBtn);

    var statsEl = document.querySelector(".header-stats");
    if(statsEl && !$("lastUpdateStat")){
      var updEl = document.createElement("div");
      updEl.className = "hstat teal";
      updEl.id = "lastUpdateStat";
      updEl.innerHTML = '<span class="hstat-label">Update</span><span class="hstat-value" id="lastUpdateVal">—</span>';
      statsEl.appendChild(updEl);
    }

    function fmtAgo(ms){
      var sec = Math.floor(ms/1000);
      if(sec < 10) return "nu";
      if(sec < 60) return sec + "s";
      var min = Math.floor(sec/60);
      if(min < 60) return min + "m";
      var hr = Math.floor(min/60);
      return hr + "u";
    }

    function tickUpdate(){
      var el = $("lastUpdateVal");
      if(!el || !lastUpdate) return;
      el.textContent = fmtAgo(Date.now() - lastUpdate);
    }

    /* ============================================================
       v12: UPDATE-TIMER PAUZEERT OP ACHTERGROND
       ============================================================ */
    var updateTimer = null;

    function startUpdateTimer(){
      if(updateTimer) return;
      tickUpdate();
      updateTimer = setInterval(tickUpdate, 5000);
    }

    function stopUpdateTimer(){
      if(updateTimer){
        clearInterval(updateTimer);
        updateTimer = null;
      }
    }

    document.addEventListener("visibilitychange", function(){
      if(document.hidden) stopUpdateTimer();
      else startUpdateTimer();
    });

    startUpdateTimer();

    function setProgress(pct){
      var circle = refreshBtn.querySelector(".refresh-progress");
      if(!circle) return;
      var dash = 106.8;
      var offset = dash * (1 - Math.max(0, Math.min(100, pct)) / 100);
      circle.setAttribute("stroke-dashoffset", String(offset));
    }

    function resetRing(){
      var circle = refreshBtn.querySelector(".refresh-progress");
      if(!circle) return;
      circle.setAttribute("stroke-dashoffset", "106.8");
    }

    document.addEventListener("wardesk:feedprogress", function(e){
      var d = e.detail || {};
      var pct = typeof d.pct === "number" ? d.pct : 0;

      if(d.done){
        setProgress(100);
        setTimeout(function(){
          resetRing();
          if(refreshBtn.classList.contains("loading")){
            refreshBtn.classList.remove("loading");
            refreshBtn.classList.add("done");
            refreshBtn.disabled = false;
            activeLoad = false;
            setTimeout(function(){ refreshBtn.classList.remove("done"); }, 1400);
          }
        }, 400);
        lastUpdate = Date.now();
        tickUpdate();
      } else {
        setProgress(pct);
      }
    });

    function doRefresh(){
      if(!window.NewsAPI || activeLoad) return;
      activeLoad = true;
      refreshBtn.classList.add("loading");
      refreshBtn.disabled = true;
      setProgress(0);
      var beforeCount = (window.State && State.items.length) || 0;

      Promise.resolve(NewsAPI.reload()).then(function(){
        var afterCount = (window.State && State.items.length) || 0;
        var newCount = Math.max(0, afterCount - beforeCount);
        if(window.showToast) window.showToast(newCount > 0 ? (newCount + " nieuwe artikelen") : "Geen nieuwe artikelen");
      }).catch(function(){
        refreshBtn.classList.remove("loading");
        refreshBtn.disabled = false;
        activeLoad = false;
        resetRing();
        if(window.showToast) window.showToast("Verversen mislukt");
      });
    }

    refreshBtn.addEventListener("click", doRefresh);

    if(window.NewsAPI && typeof NewsAPI.reload === "function" && !NewsAPI._wrapped){
      var origReload = NewsAPI.reload;
      NewsAPI._originalReload = origReload;
      NewsAPI._wrapped = true;
      NewsAPI.reload = function(){
        var p = origReload.apply(this, arguments);
        if(p && p.then){
          return p.then(function(result){
            lastUpdate = Date.now();
            tickUpdate();
            return result;
          });
        }
        return p;
      };
    }

    var attempts = 0;
    var waitInit = setInterval(function(){
      attempts++;
      if(window.State && State.items.length > 0){
        lastUpdate = Date.now();
        tickUpdate();
        clearInterval(waitInit);
      }
      if(attempts > 200) clearInterval(waitInit);
    }, 500);

    console.log("[WAR DESK] refresh-v12.js " + APP_VERSION + " geladen");
  }

  if(document.readyState !== "loading") initRefresh();
  else document.addEventListener("DOMContentLoaded", initRefresh);
})();