/* ============================================================
   WAR DESK v19.0 — State persistentie
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

  window.addEventListener("DOMContentLoaded", function(){
    var saved = load();
    if(!saved) return;

    // Wacht tot NewsAPI beschikbaar is
    var attempts = 0;
    var waitInterval = setInterval(function(){
      attempts++;
      if(window.NewsAPI && window.State){
        clearInterval(waitInterval);

        // Herstel state
        if(saved.cat) State.currentCat = saved.cat;
        if(saved.sort) State.currentSort = saved.sort;
        if(saved.view) State.viewMode = saved.view;

        // Zet de juiste knoppen actief
        var $ = function(id){ return document.getElementById(id); };

        // Categorie knop
        document.querySelectorAll(".sheet-item[data-cat]").forEach(function(b){
          b.classList.toggle("active", b.dataset.cat === saved.cat);
        });

        // Sortering
        if($("sortImportance") && $("sortNewest")){
          $("sortImportance").classList.toggle("active", saved.sort === "importance");
          $("sortNewest").classList.toggle("active", saved.sort === "newest");
        }

        // Weergave
        if($("viewCards") && $("viewList")){
          $("viewCards").classList.toggle("active", saved.view === "cards");
          $("viewList").classList.toggle("active", saved.view === "list");
        }

        // Re-render met herstelde state
        try{
          if(NewsAPI.render) NewsAPI.render();
        }catch(e){}

        console.log("[WAR DESK] State hersteld:", saved);
      }
      // Na 10 seconden opgeven
      if(attempts > 100) clearInterval(waitInterval);
    }, 100);

    // Bij elke wijziging opslaan
    document.addEventListener("click", function(e){
      var t = e.target.closest("[data-cat]");
      if(t && t.classList.contains("sheet-item")){
        setTimeout(save, 100);
      }
      if(e.target.id === "sortImportance" || e.target.id === "sortNewest" ||
         e.target.id === "viewCards" || e.target.id === "viewList"){
        setTimeout(save, 100);
      }
    });
  });

  console.log("[WAR DESK] persist.js geladen");
})();