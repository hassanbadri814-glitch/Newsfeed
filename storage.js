/* ============================================================
   WAR DESK v1.1 — Centrale Storage Module
   - Alle localStorage en sessionStorage keys op één plek
   - Wrapper functies met error handling
   - Bestaande keys blijven gelijk → geen dataverlies
   - FIX v1.1: eigen debug check (draait vóór config.js)
   ============================================================ */

window.WDStorage = (function(){
  "use strict";

  var KEYS = {
    theme:               "wardesk_theme",
    font_size:           "wardesk_font_size",
    accent_color:        "wardesk_accent_color",
    oled_mode:           "wardesk_oled_mode",
    theme_manual_until:  "wardesk_theme_manual_until",
    translate:           "wardesk_translate",
    notifications:       "wardesk_notifications",
    ui_state:            "wardesk_ui_state_v1",
    active_view:         "wardesk_active_view_v1",
    active_tab:          "wardesk_active_tab",
    iptv_volume:         "wardesk_iptv_volume",
    iptv_mute:           "wardesk_iptv_mute",
    iptv_view:           "wardesk_iptv_view",
    iptv_working:        "wardesk_iptv_working",
    tags_version:        "wardesk_tags_version",
    map_filter:          "wardesk_map_filter",
    debug:               "wardesk_debug"
  };

  function get(key, fallback){
    try{
      var v = localStorage.getItem(KEYS[key] || key);
      return v === null ? (fallback !== undefined ? fallback : null) : v;
    }catch(e){ return fallback !== undefined ? fallback : null; }
  }
  function set(key, value){
    try{ localStorage.setItem(KEYS[key] || key, String(value)); return true; }
    catch(e){ return false; }
  }
  function remove(key){
    try{ localStorage.removeItem(KEYS[key] || key); return true; }
    catch(e){ return false; }
  }
  function getJSON(key, fallback){
    try{
      var v = localStorage.getItem(KEYS[key] || key);
      if(v === null) return fallback !== undefined ? fallback : null;
      return JSON.parse(v);
    }catch(e){ return fallback !== undefined ? fallback : null; }
  }
  function setJSON(key, value){
    try{ localStorage.setItem(KEYS[key] || key, JSON.stringify(value)); return true; }
    catch(e){ return false; }
  }
  function sget(key, fallback){
    try{
      var v = sessionStorage.getItem(KEYS[key] || key);
      return v === null ? (fallback !== undefined ? fallback : null) : v;
    }catch(e){ return fallback !== undefined ? fallback : null; }
  }
  function sset(key, value){
    try{ sessionStorage.setItem(KEYS[key] || key, String(value)); return true; }
    catch(e){ return false; }
  }
  function sremove(key){
    try{ sessionStorage.removeItem(KEYS[key] || key); return true; }
    catch(e){ return false; }
  }

  function clearAll(){
    try{
      Object.keys(KEYS).forEach(function(k){
        try{ localStorage.removeItem(KEYS[k]); }catch(e){}
        try{ sessionStorage.removeItem(KEYS[k]); }catch(e){}
      });
      return true;
    }catch(e){ return false; }
  }

  function dump(){
    var out = {};
    Object.keys(KEYS).forEach(function(k){
      try{
        var v = localStorage.getItem(KEYS[k]);
        if(v !== null) out[k] = v;
      }catch(e){}
    });
    return out;
  }

  return {
    KEYS: KEYS,
    get: get,
    set: set,
    remove: remove,
    getJSON: getJSON,
    setJSON: setJSON,
    session: {
      get: sget,
      set: sset,
      remove: sremove
    },
    clearAll: clearAll,
    dump: dump
  };
})();

// FIX v1.1: eigen debug check — draait vóór config.js
(function(){
  var DEBUG = false;
  try{
    DEBUG = (localStorage.getItem("wardesk_debug") === "1") || /[?&]debug=1/.test(location.search);
  }catch(e){}
  if(DEBUG){
    try{ console.log("[WAR DESK] storage.js v1.1 geladen — " + Object.keys(window.WDStorage.KEYS).length + " keys"); }catch(e){}
  }
})();