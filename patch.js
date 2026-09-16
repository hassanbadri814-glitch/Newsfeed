/* ============================================================
   WAR DESK v19.0 — Fase 2.1 bugfix patch
   Fixes:
   1. Hamburger menu crasht bij categorie-klik
   2. Bronnen-teller springt naar 0 tijdens refresh
   ============================================================ */

(function(){
  "use strict";

  var $ = function(id){ return document.getElementById(id); };

  window.addEventListener("DOMContentLoaded", function(){

    /* ===== FIX 1: Menu handlers opnieuw binden (veilig) ===== */
    var sheet = $("sheet");
    var overlay = $("sheetOverlay");

    function safeCloseSheet(){
      try{
        if(sheet) sheet.classList.remove("open");
        if(overlay) overlay.classList.remove("open");
        document.body.style.overflow = "";
        document.body.style.position = "";
      }catch(e){}
    }

    /* Categorie knoppen — SLUIT EERST, dan filteren */
    document.querySelectorAll(".sheet-item[data-cat]").forEach(function(btn){
      var clone = btn.cloneNode(true);
      btn.parentNode.replaceChild(clone, btn);
      clone.addEventListener("click", function(e){
        e.preventDefault();
        e.stopPropagation();
        safeCloseSheet();
        document.querySelectorAll(".sheet-item[data-cat]").forEach(function(b){
          b.classList.remove("active");
        });
        clone.classList.add("active");
        try{
          if(window.NewsAPI && NewsAPI.setCat) NewsAPI.setCat(clone.dataset.cat);
        }catch(err){ console.error("[patch] setCat fout:", err); }
      });
    });

    /* Sortering knoppen */
    ["sortImportance","sortNewest"].forEach(function(id){
      var btn = $(id);
      if(!btn) return;
      var clone = btn.cloneNode(true);
      btn.parentNode.replaceChild(clone, btn);
      clone.addEventListener("click", function(e){
        e.preventDefault();
        e.stopPropagation();
        safeCloseSheet();
        ["sortImportance","sortNewest"].forEach(function(otherId){
          var other = $(otherId);
          if(other) other.classList.remove("active");
        });
        clone.classList.add("active");
        try{
          if(window.NewsAPI && NewsAPI.setSort) NewsAPI.setSort(id === "sortImportance" ? "importance" : "newest");
        }catch(err){ console.error("[patch] setSort fout:", err); }
      });
    });

    /* Weergave knoppen */
    ["viewCards","viewList"].forEach(function(id){
      var btn = $(id);
      if(!btn) return;
      var clone = btn.cloneNode(true);
      btn.parentNode.replaceChild(clone, btn);
      clone.addEventListener("click", function(e){
        e.preventDefault();
        e.stopPropagation();
        safeCloseSheet();
        ["viewCards","viewList"].forEach(function(otherId){
          var other = $(otherId);
          if(other) other.classList.remove("active");
        });
        clone.classList.add("active");
        try{
          if(window.NewsAPI && NewsAPI.setView) NewsAPI.setView(id === "viewCards" ? "cards" : "list");
        }catch(err){ console.error("[patch] setView fout:", err); }
      });
    });

    /* Escape sluit menu */
    document.addEventListener("keydown", function(e){
      if(e.key === "Escape") safeCloseSheet();
    });

    /* ===== FIX 2: Bronnen-teller niet naar 0 tijdens refresh ===== */
    /* We overschrijven de loadAllFeeds-functie zodat de teller blijft staan */
    if(window.NewsAPI && window.NewsState){
      var NS = window.NewsState;
      var origReload = NewsAPI.reload;
      
      // Houd de laatste goede waarden bij
      var lastGood = {
        loaded: 0,
        total: 0,
        items: 0
      };
      
      // Intercept de stat-update door de DOM te observeren
      var statSources = $("statSources");
      var statItems = $("statItems");
      var statWar = $("statWar");
      
      function captureStats(){
        try{
          var srcTxt = statSources ? statSources.textContent : "";
          var m = srcTxt.match(/(\d+)\/(\d+)/);
          if(m && parseInt(m[1]) > 0){
            lastGood.loaded = parseInt(m[1]);
            lastGood.total = parseInt(m[2]);
          }
          var itemsTxt = statItems ? statItems.textContent : "";
          var itemsVal = parseInt(itemsTxt);
          if(itemsVal > 0) lastGood.items = itemsVal;
        }catch(e){}
      }
      
      function restoreStats(){
        try{
          if(statSources && lastGood.total > 0){
            var m = statSources.textContent.match(/(\d+)\/(\d+)/);
            if(m && parseInt(m[1]) === 0){
              statSources.textContent = lastGood.loaded + "/" + lastGood.total;
            }
          }
          if(statItems && lastGood.items > 0){
            var v = parseInt(statItems.textContent);
            if(v === 0) statItems.textContent = lastGood.items;
          }
        }catch(e){}
      }
      
      // Observeer wijzigingen
      if(window.MutationObserver){
        var obs = new MutationObserver(function(){
          captureStats();
          // Als iemand net 0/0 heeft gezet maar we hadden goede waarden, herstel
          restoreStats();
        });
        if(statSources) obs.observe(statSources, {childList: true, characterData: true, subtree: true});
        if(statItems) obs.observe(statItems, {childList: true, characterData: true, subtree: true});
      }
    }

    console.log("[WAR DESK] Fase 2.1 patch actief");
  });
})();