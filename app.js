/* ============================================================
   WAR DESK v19.0 — App orchestration
   ============================================================ */

(function(){
  "use strict";

  function $(id){ return document.getElementById(id); }

  function ready(fn){
    if(document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function(){

    /* Thema init */
    if(document.documentElement.classList.contains("light")){
      document.body.classList.add("light");
    }

    /* Klok */
    function tick(){
      var el = $("clock");
      if(el) el.textContent = new Date().toLocaleTimeString("nl-NL", {
        hour: "2-digit", minute: "2-digit", second: "2-digit"
      });
    }
    tick();
    setInterval(tick, 1000);

    /* Thema knop */
    $("btnTheme").addEventListener("click", function(){
      var isLight = document.documentElement.classList.toggle("light");
      document.body.classList.toggle("light", isLight);
      try{ localStorage.setItem("wardesk_theme", isLight ? "light" : "dark"); }catch(e){}
    });

    /* ===== VIEWS ===== */
    var views = {
      news: $("viewNews"),
      iptv: $("viewIptv"),
      map: $("viewMap")
    };

    function showView(name){
      Object.keys(views).forEach(function(k){
        if(views[k]) views[k].hidden = (k !== name);
      });
      Array.prototype.forEach.call(document.querySelectorAll(".bottom-tabs .tab"), function(t){
        t.classList.toggle("active", t.dataset.view === name);
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    Array.prototype.forEach.call(document.querySelectorAll(".bottom-tabs .tab"), function(tab){
      tab.addEventListener("click", function(){ showView(tab.dataset.view); });
    });

    /* ===== BOTTOM SHEET ===== */
    var sheet = $("sheet");
    var overlay = $("sheetOverlay");

    function openSheet(){
      sheet.classList.add("open");
      overlay.classList.add("open");
      document.body.style.overflow = "hidden";
    }
    function closeSheet(){
      sheet.classList.remove("open");
      overlay.classList.remove("open");
      document.body.style.overflow = "";
    }

    $("btnMenu").addEventListener("click", openSheet);
    $("sheetClose").addEventListener("click", closeSheet);
    overlay.addEventListener("click", closeSheet);

    /* Categorie — SLUIT EERST, dan filteren */
    Array.prototype.forEach.call(document.querySelectorAll(".sheet-item[data-cat]"), function(btn){
      btn.addEventListener("click", function(e){
        e.preventDefault();
        e.stopPropagation();
        closeSheet();
        Array.prototype.forEach.call(document.querySelectorAll(".sheet-item[data-cat]"), function(b){
          b.classList.remove("active");
        });
        btn.classList.add("active");
        try{
          if(window.NewsAPI) NewsAPI.setCat(btn.dataset.cat);
        }catch(err){ console.error("[WAR DESK] setCat fout:", err); }
      });
    });

    /* Sortering */
    function bindSort(id, sortValue){
      var btn = $(id);
      if(!btn) return;
      btn.addEventListener("click", function(e){
        e.preventDefault();
        e.stopPropagation();
        closeSheet();
        $("sortImportance").classList.remove("active");
        $("sortNewest").classList.remove("active");
        btn.classList.add("active");
        try{ if(window.NewsAPI) NewsAPI.setSort(sortValue); }catch(err){}
      });
    }
    bindSort("sortImportance", "importance");
    bindSort("sortNewest", "newest");

    /* Weergave */
    function bindView(id, viewValue){
      var btn = $(id);
      if(!btn) return;
      btn.addEventListener("click", function(e){
        e.preventDefault();
        e.stopPropagation();
        closeSheet();
        $("viewCards").classList.remove("active");
        $("viewList").classList.remove("active");
        btn.classList.add("active");
        try{ if(window.NewsAPI) NewsAPI.setView(viewValue); }catch(err){}
      });
    }
    bindView("viewCards", "cards");
    bindView("viewList", "list");

    /* Zoeken */
    var searchInput = $("searchInput");
    if(searchInput){
      var searchTimer;
      searchInput.addEventListener("input", function(){
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function(){
          try{ if(window.NewsAPI) NewsAPI.setSearch(searchInput.value); }catch(err){}
        }, 250);
      });
    }

    /* Swipe sluiten */
    var startY = 0, currentY = 0, dragging = false;
    sheet.addEventListener("touchstart", function(e){
      startY = e.touches[0].clientY;
      dragging = true;
    }, {passive: true});
    sheet.addEventListener("touchmove", function(e){
      if(!dragging) return;
      currentY = e.touches[0].clientY;
      var delta = currentY - startY;
      if(delta > 0) sheet.style.transform = "translateY(" + delta + "px)";
    }, {passive: true});
    sheet.addEventListener("touchend", function(){
      dragging = false;
      if(currentY - startY > 100) closeSheet();
      sheet.style.transform = "";
      startY = currentY = 0;
    });

    /* Escape */
    document.addEventListener("keydown", function(e){
      if(e.key === "Escape") closeSheet();
    });

    /* Breaking banner */
    var bb = $("breakingClose");
    if(bb){
      bb.addEventListener("click", function(e){
        e.stopPropagation();
        $("breakingBanner").classList.remove("show");
      });
    }
    var banner = $("breakingBanner");
    if(banner){
      banner.addEventListener("click", function(e){
        if(e.target.closest(".breaking-close")) return;
        var item = window.State && window.State.lastBreakingItem;
        if(item && item.link){
          window.open(item.link, "_blank", "noopener");
          banner.classList.remove("show");
        }
      });
    }

    /* Toast */
    var toastTimer;
    window.showToast = function(msg){
      var t = $("toast");
      t.textContent = msg;
      t.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function(){ t.classList.remove("show"); }, 2200);
    };

    /* Init nieuws */
    if(window.NewsAPI){
      NewsAPI.init().then(function(){
        console.log("[WAR DESK] Nieuws geladen:", window.State.items.length, "artikelen");
      }).catch(function(err){
        console.error("[WAR DESK] Nieuws init fout:", err);
      });
    }

    console.log("[WAR DESK] app.js geladen");
  });
})();