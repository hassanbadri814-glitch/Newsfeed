/* ============================================================
   WAR DESK v1.1 — Reactive State Store
   - FIX v1.1: wdLog in plaats van console.log
   ============================================================ */

(function(){
  "use strict";

  var createStore = function(initialState) {
    var listeners = {};
    
    var state = new Proxy(initialState, {
      set: function(target, key, value) {
        if (target[key] === value) return true;
        target[key] = value;
        
        if (listeners[key]) {
          listeners[key].forEach(function(fn) { 
            try { fn(value); } catch(e) { wdLog.error("[Store] listener error:", e); }
          });
        }
        if (listeners['*']) {
          listeners['*'].forEach(function(fn) { 
            try { fn(key, value); } catch(e) { wdLog.error("[Store] listener error:", e); }
          });
        }
        return true;
      }
    });

    return {
      state: state,
      subscribe: function(key, fn) {
        if (!listeners[key]) listeners[key] = [];
        listeners[key].push(fn);
        return function() {
          var idx = listeners[key].indexOf(fn);
          if (idx >= 0) listeners[key].splice(idx, 1);
        };
      }
    };
  };

  var appStore = createStore({
    items: [],
    currentCat: "all",
    currentSort: "importance",
    currentSearch: "",
    loadedSources: 0,
    totalSources: 0,
    failedSources: [],
    disabled: {},
    health: {},
    readMap: {},
    favorites: {},
    notificationsEnabled: false,
    lastActivity: Date.now(),
    isScrolling: false,
    scrollTimer: null,
    refreshTimer: null,
    viewMode: "cards",
    breakingShownAt: 0,
    lastBreakingItem: null,
    loadSession: 0,
    db: null,
    _lastRenderHash: "",
    translateEnabled: false,
    translations: {},
    translationPending: {}
  });

  window.appStore = appStore;
  window.State = appStore.state;

  wdLog.info("[WAR DESK] store.js v1.1 geladen");
})();