/* ============================================================
   WAR DESK v20.0 — App orchestration
   ============================================================ */

(function(){
  "use strict";

  var $ = function(id){ return document.getElementById(id); };
  var APP_VERSION = window.APP_VERSION || "v8.1";

  function ready(fn){
    if(document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function(){

    if(document.documentElement.classList.contains("light")){
      document.body.classList.add("light");
    }

    function tick(){
      var el = $("clock");
      if(el) el.textContent = new Date().toLocaleTimeString("nl-NL", {
        hour: "2-digit", minute: "2-digit", second: "2-digit"
      });
    }
    tick();
    setInterval(tick, 1000);

    var themeBtn = $("btnTheme");
    if(themeBtn){
      themeBtn.addEventListener("click", function(){
        var isLight = document.documentElement.classList.toggle("light");
        document.body.classList.toggle("light", isLight);
        try{ localStorage.setItem("wardesk_theme", isLight ? "light" : "dark"); }catch(e){}
      });
    }

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

    var sheet = $("sheet");
    var overlay = $("sheetOverlay");

    function openSheet(){
      if(!sheet || !overlay) return;
      sheet.classList.add("open");
      overlay.classList.add("open");
      document.body.style.overflow = "hidden";
    }
    function closeSheet(){
      if(!sheet || !overlay) return;
      sheet.classList.remove("open");
      overlay.classList.remove("open");
      document.body.style.overflow = "";
    }

    var btnMenu = $("btnMenu");
    if(btnMenu) btnMenu.addEventListener("click", openSheet);
    var sheetClose = $("sheetClose");
    if(sheetClose) sheetClose.addEventListener("click", closeSheet);
    if(overlay) overlay.addEventListener("click", closeSheet);

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

    function bindSort(id, sortValue){
      var btn = $(id);
      if(!btn) return;
      btn.addEventListener("click", function(e){
        e.preventDefault();
        e.stopPropagation();
        closeSheet();
        var imp = $("sortImportance"); if(imp) imp.classList.remove("active");
        var nn = $("sortNewest"); if(nn) nn.classList.remove("active");
        btn.classList.add("active");
        try{ if(window.NewsAPI) NewsAPI.setSort(sortValue); }catch(err){}
      });
    }
    bindSort("sortImportance", "importance");
    bindSort("sortNewest", "newest");

    function bindView(id, viewValue){
      var btn = $(id);
      if(!btn) return;
      btn.addEventListener("click", function(e){
        e.preventDefault();
        e.stopPropagation();
        closeSheet();
        var c = $("viewCards"); if(c) c.classList.remove("active");
        var l = $("viewList"); if(l) l.classList.remove("active");
        btn.classList.add("active");
        try{ if(window.NewsAPI) NewsAPI.setView(viewValue); }catch(err){}
      });
    }
    bindView("viewCards", "cards");
    bindView("viewList", "list");

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

    var startY = 0, currentY = 0, dragging = false;
    if(sheet){
      sheet.addEventListener("touchstart", function(e){
        if(e.touches.length !== 1) return;
        startY = e.touches[0].clientY;
        dragging = true;
      }, {passive: true});
      sheet.addEventListener("touchmove", function(e){
        if(!dragging || e.touches.length !== 1) return;
        currentY = e.touches[0].clientY;
        var delta = currentY - startY;
        if(delta > 0){
          if(e.cancelable) e.preventDefault();
          sheet.style.transform = "translateY(" + delta + "px)";
        }
      }, {passive: false});
      sheet.addEventListener("touchend", function(){
        if(!dragging) return;
        dragging = false;
        if(currentY - startY > 100) closeSheet();
        sheet.style.transform = "";
        startY = currentY = 0;
      });
      sheet.addEventListener("touchcancel", function(){
        dragging = false;
        sheet.style.transform = "";
        startY = currentY = 0;
      });
    }

    document.addEventListener("keydown", function(e){
      if(e.key !== "Escape") return;
      var modal = $("wdDetailModal");
      if(modal && modal.classList.contains("show")) return;
      if(document.querySelector(".map-wrap.fullscreen")) return;
      closeSheet();
    });

    var bb = $("breakingClose");
    if(bb){
      bb.addEventListener("click", function(e){
        e.stopPropagation();
        var banner = $("breakingBanner");
        if(banner) banner.classList.remove("show");
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

    var toastTimer;
    window.showToast = function(msg){
      var t = $("toast");
      if(!t) return;
      t.textContent = msg;
      t.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function(){ t.classList.remove("show"); }, 2200);
    };

    if(window.NewsAPI && typeof NewsAPI.init === "function"){
      Promise.resolve(NewsAPI.init()).then(function(){
        if(window.State) console.log("[WAR DESK] Nieuws geladen:", State.items.length, "artikelen");
      }).catch(function(err){
        console.error("[WAR DESK] Nieuws init fout:", err);
      });
    }

    console.log("[WAR DESK] app.js " + APP_VERSION + " geladen");
  });
})();