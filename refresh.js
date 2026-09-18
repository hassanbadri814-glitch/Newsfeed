/* ============================================================
   WAR DESK v16.0 — Refresh knop + status indicator
   ============================================================ */

(function(){
  "use strict";

  var $ = function(id){ return document.getElementById(id); };
  var APP_VERSION = window.APP_VERSION || "v8.1";

  function initRefresh(){
    var lastUpdate = null;
    var newCount = 0;

    var themeBtn = $("btnTheme");
    var headerActions = themeBtn ? themeBtn.parentNode : document.querySelector(".header-actions");
    if(!headerActions) return;

    var refreshBtn = document.createElement("button");
    refreshBtn.className = "btn-mini";
    refreshBtn.id = "btnRefresh";
    refreshBtn.setAttribute("aria-label", "Verversen");
    refreshBtn.textContent = "↻";
    if(themeBtn) headerActions.insertBefore(refreshBtn, themeBtn);
    else headerActions.appendChild(refreshBtn);

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

    setInterval(tickUpdate, 5000);

    function doRefresh(){
      if(!window.NewsAPI) return;
      refreshBtn.style.animation = "spin 1s linear infinite";
      refreshBtn.disabled = true;
      refreshBtn.style.opacity = ".6";

      var beforeCount = (window.State && State.items.length) || 0;

      if(!document.getElementById("spinStyle")){
        var s = document.createElement("style");
        s.id = "spinStyle";
        s.textContent = "@keyframes spin{to{transform:rotate(360deg)}}";
        document.head.appendChild(s);
      }

      Promise.resolve(NewsAPI.reload()).then(function(){
        var afterCount = (window.State && State.items.length) || 0;
        newCount = Math.max(0, afterCount - beforeCount);
        lastUpdate = Date.now();
        tickUpdate();
        refreshBtn.style.animation = "";
        refreshBtn.disabled = false;
        refreshBtn.style.opacity = "1";
        if(window.showToast) window.showToast(newCount > 0 ? (newCount + " nieuwe artikelen") : "Geen nieuwe artikelen");
      }).catch(function(){
        refreshBtn.style.animation = "";
        refreshBtn.disabled = false;
        refreshBtn.style.opacity = "1";
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

    console.log("[WAR DESK] refresh.js " + APP_VERSION + " geladen");
  }

  if(document.readyState !== "loading") initRefresh();
  else document.addEventListener("DOMContentLoaded", initRefresh);
})();