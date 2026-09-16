/* ============================================================
   WAR DESK v19.0 — Refresh knop + status indicator
   ============================================================ */

(function(){
  "use strict";

  var $ = function(id){ return document.getElementById(id); };

  window.addEventListener("DOMContentLoaded", function(){
    var lastUpdate = null;
    var newCount = 0;

    // Voeg refresh-knop toe aan header naast thema-knop
    var themeBtn = $("btnTheme");
    if(!themeBtn) return;

    var refreshBtn = document.createElement("button");
    refreshBtn.className = "btn-mini";
    refreshBtn.id = "btnRefresh";
    refreshBtn.setAttribute("aria-label", "Verversen");
    refreshBtn.textContent = "↻";
    themeBtn.parentNode.insertBefore(refreshBtn, themeBtn);

    // Voeg "laatst bijgewerkt" indicator toe aan header-stats
    var statsEl = document.querySelector(".header-stats");
    if(statsEl){
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

    // Verversen
    function doRefresh(){
      if(!window.NewsAPI) return;
      refreshBtn.style.animation = "spin 1s linear infinite";
      refreshBtn.disabled = true;
      refreshBtn.style.opacity = ".6";

      var beforeCount = (window.State && State.items.length) || 0;

      // Voeg style toe voor spinner als nog niet bestaat
      if(!document.getElementById("spinStyle")){
        var s = document.createElement("style");
        s.id = "spinStyle";
        s.textContent = "@keyframes spin{to{transform:rotate(360deg)}}";
        document.head.appendChild(s);
      }

      NewsAPI.reload().then(function(){
        var afterCount = (window.State && State.items.length) || 0;
        newCount = Math.max(0, afterCount - beforeCount);
        lastUpdate = Date.now();
        tickUpdate();
        refreshBtn.style.animation = "";
        refreshBtn.disabled = false;
        refreshBtn.style.opacity = "1";
        if(newCount > 0){
          if(window.showToast) window.showToast(newCount + " nieuwe artikelen");
        } else {
          if(window.showToast) window.showToast("Geen nieuwe artikelen");
        }
      }).catch(function(){
        refreshBtn.style.animation = "";
        refreshBtn.disabled = false;
        refreshBtn.style.opacity = "1";
        if(window.showToast) window.showToast("Verversen mislukt");
      });
    }

    refreshBtn.addEventListener("click", doRefresh);

    // Vang de bestaande NewsAPI.reload op om lastUpdate te kunnen zetten
    if(window.NewsAPI && window.NewsAPI.reload){
      var origReload = NewsAPI.reload;
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

    // Zet initiele waarde zodra eerste load klaar is
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

    console.log("[WAR DESK] refresh.js geladen");
  });
})();