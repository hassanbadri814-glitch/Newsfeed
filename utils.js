/* ============================================================
   WAR DESK v1.0 — Gedeelde Utilities
   - Centrale escapeHtml, getProxies, timeAgo
   - Laadt na config.js, voor de andere modules
   - Geen side-effects, geen DOM-manipulatie
   ============================================================ */

(function(){
  "use strict";

  var DEBUG = false;
  try{
    DEBUG = (typeof window.WD_DEBUG !== "undefined" && window.WD_DEBUG) ||
            (localStorage.getItem("wardesk_debug") === "1") ||
            /[?&]debug=1/.test(location.search);
  }catch(e){}

  function escapeHtml(s){
    return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }

  function getProxies(){
    if(window.CONFIG && CONFIG.proxies && CONFIG.proxies.length){
      return CONFIG.proxies.slice();
    }
    return ["https://newsfeed2.hassanbadri814.workers.dev/?url="];
  }

  function timeAgo(d){
    var t = new Date(d).getTime();
    if(isNaN(t)) return "";
    var diff = (Date.now() - t) / 1000;
    if(diff < 60) return "nu";
    if(diff < 3600) return Math.floor(diff / 60) + " min";
    if(diff < 86400) return Math.floor(diff / 3600) + " u";
    return Math.floor(diff / 86400) + " d";
  }

  window.WD = window.WD || {};
  window.WD.escapeHtml = escapeHtml;
  window.WD.getProxies = getProxies;
  window.WD.timeAgo = timeAgo;

  if(DEBUG){
    try{ console.log("[WAR DESK] utils.js v1.0 geladen"); }catch(e){}
  }
})();