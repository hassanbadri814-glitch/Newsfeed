/* ============================================================
   WAR DESK v3.1 — State persistentie
   - VALID_CATS uitgebreid met maroc + vs
   ============================================================ */

(function(){
  "use strict";

  var KEY = "wardesk_ui_state_v1";
  var VIEW_KEY = "wardesk_active_view_v1";
  var VALID_CATS = ["all","war","mideast","europe","nl","maroc","vs","sport","favorites"];
  var VALID_SORTS = ["importance","newest"];
  var VALID_VIEWS = ["cards","list"];

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

  function saveView(viewName){
    try{ localStorage.setItem(VIEW_KEY, viewName); }catch(e){}
  }

  function loadView(){
    try{ return localStorage.getItem(VIEW_KEY) || "news"; }catch(e){ return "news"; }
  }

  function applyToUI(saved){
    if(!saved) return;
    var $ = function(id){ return document.getElementById(id); };

    document.querySelectorAll(".sheet-item[data-cat]").forEach(function(b){
      b.classList.toggle("active", b.dataset.cat === (saved.cat || "all"));
    });

    var imp = $("sortImportance"), nn = $("sortNewest");
    if(imp) imp.classList.toggle("active", (saved.sort || "importance") === "importance");
    if(nn) nn.classList.toggle("active", (saved.sort || "importance") === "newest");
    var vc = $("viewCards"), vl = $("viewList");
    if(vc) vc.classList.toggle("active", (saved.view || "cards") === "cards");
    if(vl) vl.classList.toggle("active", (saved.view || "cards") === "list");
  }

  function restore(){
    var saved = load();
    if(!saved || !window.State) return false;
    State.currentCat = VALID_CATS.indexOf(saved.cat) >= 0 ? saved.cat : "all";
    State.currentSort = VALID_SORTS.indexOf(saved.sort) >= 0 ? saved.sort : "importance";
    State.viewMode = VALID_VIEWS.indexOf(saved.view) >= 0 ? saved.view : "cards";
    return true;
  }

  function restoreActiveView(){
    var savedView = loadView();
    if(!savedView || savedView === "news") return;
    var tab = document.querySelector('.bottom-tabs .tab[data-view="' + savedView + '"]');
    if(!tab) return;
    tab.click();
  }

  function initPersist(){
    var saved = load();
    if(saved){ restore(); applyToUI(saved); }

    document.addEventListener("click", function(e){
      var target = e.target.closest("[data-cat], #sortImportance, #sortNewest, #viewCards, #viewList");
      if(target){ setTimeout(save, 200); }
    }, true);

    document.querySelectorAll(".bottom-tabs .tab").forEach(function(tab){
      tab.addEventListener("click", function(){
        if(tab.dataset.view) saveView(tab.dataset.view);
      });
    });

    window.addEventListener("pagehide", save);
    window.addEventListener("beforeunload", save);
    document.addEventListener("visibilitychange", function(){
      if(document.hidden) save();
    });

    var attempts = 0;
    var waitInterval = setInterval(function(){
      attempts++;
      var ready = window.NewsAPI && window.State;
      var hasItems = ready && State.items && State.items.length > 0;
      var timedOut = attempts > 50;
      if((ready && hasItems) || (ready && timedOut)){
        clearInterval(waitInterval);
        restore();
        applyToUI(load());
        try{ if(NewsAPI.render) NewsAPI.render(); }catch(e){}
        setTimeout(restoreActiveView, 200);
        console.log("[WAR DESK] State + view hersteld");
      }
      if(attempts > 200) clearInterval(waitInterval);
    }, 100);
  }

  if(document.readyState !== "loading") initPersist();
  else document.addEventListener("DOMContentLoaded", initPersist);

  console.log("[WAR DESK] persist.js v3.1 geladen");
})();