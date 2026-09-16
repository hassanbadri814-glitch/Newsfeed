/* ============================================================
   WAR DESK v19.0 — State persistentie (v2)
   Onthoudt categorie, sortering en weergave na herladen
   ============================================================ */

(function(){
  "use strict";

  var KEY = "wardesk_ui_state_v1";

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

  function applyToUI(saved){
    if(!saved) return;
    var $ = function(id){ return document.getElementById(id); };
    
    document.querySelectorAll(".sheet-item[data-cat]").forEach(function(b){
      b.classList.toggle("active", b.dataset.cat === (saved.cat || "all"));
    });
    
    if($("sortImportance")){
      $("sortImportance").classList.toggle("active", (saved.sort || "importance") === "importance");
    }
    if($("sortNewest")){
      $("sortNewest").classList.toggle("active", (saved.sort || "importance") === "newest");
    }
    if($("viewCards")){
      $("viewCards").classList.toggle("active", (saved.view || "cards") === "cards");
    }
    if($("viewList")){
      $("viewList").classList.toggle("active", (saved.view || "cards") === "list");
    }
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

  window.addEventListener("DOMContentLoaded", function(){
    var saved = load();
    
    // Herstel state direct
    if(saved){
      restore();
      applyToUI(saved);
    }

    // BELANGRIJK: capture phase — vuurt VOOR stopPropagation
    document.addEventListener("click", function(e){
      // Alleen reageren op UI-klikken
      var target = e.target.closest("[data-cat], #sortImportance, #sortNewest, #viewCards, #viewList");
      if(target){
        setTimeout(save, 200);
      }
    }, true); // ← true = capture phase, omzeilt stopPropagation

    // Extra vangnetten
    window.addEventListener("pagehide", save);
    window.addEventListener("beforeunload", save);
    document.addEventListener("visibilitychange", function(){
      if(document.hidden) save();
    });

    // Wacht tot NewsAPI klaar is, dan re-renderen met herstelde state
    var attempts = 0;
    var waitInterval = setInterval(function(){
      attempts++;
      if(window.NewsAPI && window.State){
        clearInterval(waitInterval);
        restore();
        applyToUI(load());
        try{ if(NewsAPI.render) NewsAPI.render(); }catch(e){}
        console.log("[WAR DESK] State hersteld");
      }
      if(attempts > 100) clearInterval(waitInterval);
    }, 100);
  });

  console.log("[WAR DESK] persist.js v2 geladen");
})();