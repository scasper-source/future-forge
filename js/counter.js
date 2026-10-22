/* Future Forge — js/counter.js
 *
 * The anonymous "futures built today" tally. Local to this browser, per day.
 *
 * What is stored (localStorage key "ff.tally.v1"), and nothing else:
 *   { day: "2026-10-24", total: 12, byDomain: { environment: 4, ... }, events: { session_started: 15, ... } }
 *
 * No identifiers, no timestamps per visit, no per-session records. A new day
 * starts a new tally. The visitor's Reset clears their session, not this
 * tally; the staff panel can clear the tally. FF_CONFIG.counter = false
 * disables it entirely.
 */
window.FF = window.FF || {};

(function () {
  "use strict";
  const KEY = "ff.tally.v1";

  function today() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function enabled() { return !!(window.FF_CONFIG && window.FF_CONFIG.counter); }

  function read() {
    const blank = { day: today(), total: 0, byDomain: {}, events: {} };
    if (!enabled()) return blank;
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank;
      const t = JSON.parse(raw);
      if (!t || t.day !== today()) return blank;
      t.byDomain = t.byDomain || {}; t.events = t.events || {};
      return t;
    } catch (e) { return blank; }
  }

  function write(t) {
    if (!enabled()) return;
    try { localStorage.setItem(KEY, JSON.stringify(t)); } catch (e) { /* storage unavailable: fine */ }
  }

  const counter = {
    enabled,
    get: read,
    /** One more future built (a session reached the closing screen). */
    addFuture(domainId) {
      const t = read();
      t.total += 1;
      if (domainId) t.byDomain[domainId] = (t.byDomain[domainId] || 0) + 1;
      write(t);
      return t;
    },
    /** Coarse event counters from the spec (session_started, vision_path_started, ...). */
    event(name) {
      const t = read();
      t.events[name] = (t.events[name] || 0) + 1;
      write(t);
    },
    clear() { try { localStorage.removeItem(KEY); } catch (e) {} }
  };

  window.FF.counter = counter;
})();
