/* ============================================================
   WAR DESK v1.0 — Reactive State Store (GEEN modules)
   ============================================================ */

(function(){
  "use strict";

  var createStore = function(initialState) {
    var listeners = {};
    
    var state = new Proxy(initialState, {
      set: function(target, key, value) {
        if (target[key] === value) return true;
        target[key] = value;
        
        // Trigger specifieke listeners
        if (listeners[key]) {
          listeners[key].forEach(function(fn) { 
            try { fn(value); } catch(e) { console.error("[Store] listener error:", e); }
          });
        }
        // Trigger algemene listeners
        if (listeners['*']) {
          listeners['*'].forEach(function(fn) { 
            try { fn(key, value); } catch(e) { console.error("[Store] listener error:", e); }
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

  // Maak de store aan
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

  // DE BRUG: maak beschikbaar voor oude scripts
  window.appStore = appStore;
  window.State = appStore.state; // Backward compatibility!

  console.log("[WAR DESK] store.js geladen");
})();