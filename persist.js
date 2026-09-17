/* ============================================================
   WAR DESK v2.7 — State persistentie (v3)
   Onthoudt categorie, sortering, weergave EN actieve tab
   ============================================================ */

(function(){
  "use strict";

  var KEY = "wardesk_ui_state_v1";
  var VIEW_KEY = "wardesk_active_view_v1";

  /* ===== STATE OPSLAAN ===== */
  function save(){
    try{
      if(!window.State) return;
      localStorage.setItem(KEY, JSON.stringify({
        cat: State.currentCat,
        sort: State.currentSort,
        view: State.viewMode
      }));
    }catch(e){}
  }

  function load(){
    try{
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    }catch(e){ return null; }
  }

  /* ===== VIEW (actieve tab) OPSLAAN ===== */
  function saveView(viewName){
    try{ localStorage.setItem(VIEW_KEY, viewName); }catch(e){}
  }

  function loadView(){
    try{ return localStorage.getItem(VIEW_KEY) || "news"; }catch(e){ return "news"; }
  }

  /* ===== UI HERSTELLEN ===== */
  function applyToUI(saved){
    if(!saved) return;
    var $ = function(id){ return document.getElementById(id); };
    
    document.querySelectorAll(".sheet-item[data-cat]").forEach(function(b){
      b.classList.toggle("active", b.dataset.cat === (saved.cat || "all"));
    });
    
    if($("sortImportance")) $("sortImportance").classList.toggle("active", (saved.sort || "importance") === "importance");
    if($("sortNewest")) $("sortNewest").classList.toggle("active", (saved.sort || "importance") === "newest");
    if($("viewCards")) $("viewCards").classList.toggle("active", (saved.view || "cards") === "cards");
    if($("viewList")) $("viewList").classList.toggle("active", (saved.view || "cards") === "list");
  }

  function restore(){
    var saved = load();
    if(!saved) return false;
    if(window.State){
      State.currentCat = saved.cat || "all";
      State.currentSort = saved.sort || "importance";
      State.viewMode = saved.view || "cards";
      return true;
    }
    return false;
  }

  /* ===== ACTIEVE TAB HERSTELLEN ===== */
  function restoreActiveView(){
    var savedView = loadView();
    if(!savedView || savedView === "news") return;
    var tab = document.querySelector('.bottom-tabs .tab[data-view="' + savedView + '"]');
    if(!tab) return;
    tab.click();
  }

  /* ===== INIT ===== */
  window.addEventListener("DOMContentLoaded", function(){
    var saved = load();
    if(saved){ restore(); applyToUI(saved); }

    /* State opslaan bij UI-klikken (capture phase → omzeilt stopPropagation) */
    document.addEventListener("click", function(e){
      var target = e.target.closest("[data-cat], #sortImportance, #sortNewest, #viewCards, #viewList");
      if(target){ setTimeout(save, 200); }
    }, true);

    /* Actieve tab opslaan bij tab-klikken */
    document.querySelectorAll(".bottom-tabs .tab").forEach(function(tab){
      tab.addEventListener("click", function(){
        if(tab.dataset.view) saveView(tab.dataset.view);
      });
    });

    /* Vangnetten */
    window.addEventListener("pagehide", save);
    window.addEventListener("beforeunload", save);
    document.addEventListener("visibilitychange", function(){
      if(document.hidden) save();
    });

    /* Wacht tot NewsAPI klaar is, dan state + view herstellen */
    var attempts = 0;
    var waitInterval = setInterval(function(){
      attempts++;
      if(window.NewsAPI && window.State){
        clearInterval(waitInterval);
        restore();
        applyToUI(load());
        try{ if(NewsAPI.render) NewsAPI.render(); }catch(e){}
        /* Wacht 200ms zodat app.js's tab-listeners zeker gebonden zijn */
        setTimeout(restoreActiveView, 200);
        console.log("[WAR DESK] State + view hersteld");
      }
      if(attempts > 100) clearInterval(waitInterval);
    }, 100);
  });

  console.log("[WAR DESK] persist.js v3 geladen — view persistence");
})();