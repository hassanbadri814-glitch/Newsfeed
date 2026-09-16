/* ============================================================
   WAR DESK v19.0 — App orchestration
   ============================================================ */

(function(){
  "use strict";

  var $ = function(id){ return document.getElementById(id); };

  /* ===== INIT ===== */
  window.addEventListener("DOMContentLoaded", function(){

    /* Thema init */
    if (document.documentElement.classList.contains("light")) {
      document.body.classList.add("light");
    }

    /* Klok */
    function tick(){
      var el = $("clock");
      if (el) el.textContent = new Date().toLocaleTimeString("nl-NL", {
        hour: "2-digit", minute: "2-digit", second: "2-digit"
      });
    }
    tick();
    setInterval(tick, 1000);

    /* Thema knop */
    $("btnTheme").addEventListener("click", function(){
      var isLight = document.documentElement.classList.toggle("light");
      document.body.classList.toggle("light", isLight);
      try { localStorage.setItem("wardesk_theme", isLight ? "light" : "dark"); } catch(e){}
    });

    /* ===== VIEWS ===== */
    var tabs = document.querySelectorAll(".bottom-tabs .tab");
    var views = {
      news: $("viewNews"),
      iptv: $("viewIptv"),
      map:  $("viewMap")
    };

    function showView(name){
      Object.keys(views).forEach(function(k){
        if (views[k]) views[k].hidden = (k !== name);
      });
      tabs.forEach(function(t){
        t.classList.toggle("active", t.dataset.view === name);
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    tabs.forEach(function(tab){
      tab.addEventListener("click", function(){
        showView(tab.dataset.view);
      });
    });

    /* ===== MENU (bottom sheet) ===== */
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

    /* Categorie knoppen */
    document.querySelectorAll(".sheet-item[data-cat]").forEach(function(btn){
      btn.addEventListener("click", function(){
        document.querySelectorAll(".sheet-item[data-cat]").forEach(function(b){
          b.classList.remove("active");
        });
        btn.classList.add("active");
        NewsAPI.setCat(btn.dataset.cat);
        closeSheet();
      });
    });

    /* Weergave knoppen */
    $("viewCards").addEventListener("click", function(){
      NewsAPI.setView("cards");
      $("viewCards").classList.add("active");
      $("viewList").classList.remove("active");
      closeSheet();
    });
    $("viewList").addEventListener("click", function(){
      NewsAPI.setView("list");
      $("viewList").classList.add("active");
      $("viewCards").classList.remove("active");
      closeSheet();
    });
    $("viewCards").classList.add("active");

    /* Sortering knoppen */
    var sortImp = $("sortImportance");
    var sortNew = $("sortNewest");
    if (sortImp) {
      sortImp.addEventListener("click", function(){
        NewsAPI.setSort("importance");
        sortImp.classList.add("active");
        sortNew.classList.remove("active");
        closeSheet();
      });
    }
    if (sortNew) {
      sortNew.addEventListener("click", function(){
        NewsAPI.setSort("newest");
        sortNew.classList.add("active");
        sortImp.classList.remove("active");
        closeSheet();
      });
    }
    if (sortImp) sortImp.classList.add("active");

    /* Zoeken */
    var searchInput = $("searchInput");
    if (searchInput) {
      var searchTimer;
      searchInput.addEventListener("input", function(){
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function(){
          NewsAPI.setSearch(searchInput.value);
        }, 250);
      });
    }

    /* ===== SWIPE om sheet te sluiten ===== */
    var startY = 0, currentY = 0, dragging = false;
    sheet.addEventListener("touchstart", function(e){
      startY = e.touches[0].clientY;
      dragging = true;
    }, {passive: true});
    sheet.addEventListener("touchmove", function(e){
      if (!dragging) return;
      currentY = e.touches[0].clientY;
      var delta = currentY - startY;
      if (delta > 0) sheet.style.transform = "translateY(" + delta + "px)";
    }, {passive: true});
    sheet.addEventListener("touchend", function(){
      dragging = false;
      if (currentY - startY > 100) closeSheet();
      sheet.style.transform = "";
      startY = currentY = 0;
    });

    /* ===== Breaking banner close ===== */
    var bb = $("breakingClose");
    if (bb) {
      bb.addEventListener("click", function(e){
        e.stopPropagation();
        $("breakingBanner").classList.remove("show");
      });
    }
    var banner = $("breakingBanner");
    if (banner) {
      banner.addEventListener("click", function(e){
        if (e.target.closest(".breaking-close")) return;
        var item = NewsAPI.state.lastBreakingItem;
        if (item && item.link) {
          window.open(item.link, "_blank", "noopener");
          banner.classList.remove("show");
        }
      });
    }

    /* ===== TOAST ===== */
    var toastTimer;
    window.showToast = function(msg){
      var t = $("toast");
      t.textContent = msg;
      t.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function(){ t.classList.remove("show"); }, 2200);
    };

    /* ===== News init ===== */
    if (window.NewsAPI) {
      NewsAPI.init().then(function(){
        console.log("[WAR DESK] Nieuws geladen:", NewsAPI.state.items.length, "artikelen");
      }).catch(function(err){
        console.error("[WAR DESK] Nieuws init fout:", err);
      });
    }

    console.log("[WAR DESK] App init voltooid");
  });
})();