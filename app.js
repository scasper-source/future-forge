/* Future Forge — app.js
 *
 * The spine: session state, screen routing, the shared meter, the training
 * moment, the closing sequence, reset, and the staff panel.
 * The three labs live in js/lab-vision.js, js/lab-data.js, js/lab-series.js
 * and register their screens here.
 *
 * Session state is a single object, created on Start and destroyed on Reset.
 * Nothing about a visitor is written anywhere. (The optional day tally in
 * js/counter.js stores counts only.)
 */
window.FF = window.FF || {};

(function () {
  "use strict";

  const $ = id => document.getElementById(id);
  const C = window.FF_CONTENT;
  const L = C.lessons;
  const cfg = window.FF_CONFIG || {};
  const reducedMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------ */
  /* State                                                               */
  /* ------------------------------------------------------------------ */

  function freshState(keep) {
    keep = keep || {};
    return {
      seed: Math.floor(Math.random() * 1e9),
      startedAt: Date.now(),
      domain: keep.domain || null,          // domain id
      mode: keep.mode || null,              // "vision" | "data" | "series"
      kit: null,                            // "free" or a series id (vision only)
      vision: { classes: ["A", "B"], examples: [], model: null, snapshot: null, failurePrediction: null, improveAdded: 0 },
      data: { points: [], model: null, test: null, failurePoint: null, failureEvidence: null, improveAdded: 0 },
      series: null,
      testsAttempted: 0,
      failureFound: false,
      failureSkipped: false,
      reason: [],
      improvementMade: false,
      improvedBetter: null,
      idea: "",
      card: null,
      completed: false,
      counted: false
    };
  }

  const app = {
    state: freshState(),
    screens: {},
    history: [],
    current: null,
    content: C,
    cfg
  };

  app.domain = function () {
    return C.domains.find(d => d.id === app.state.domain) || null;
  };

  app.lessonCode = function () {
    const s = app.state;
    if (s.mode === "series" && s.series) return s.series.sorters === 2 ? "labels_inherited_from_sorter" : "labels_are_decisions";
    if (!s.failureFound) return "no_failure_found";
    if (s.improvedBetter === true) return "model_improved_after_example";
    if (s.mode === "data" && s.data.failureEvidence === "weak") return "model_uncertain_sparse_data";
    return "model_failed_under_new_conditions";
  };

  /* ------------------------------------------------------------------ */
  /* Routing                                                             */
  /* ------------------------------------------------------------------ */

  app.registerScreen = function (id, handlers) { app.screens[id] = handlers || {}; };

  app.show = function (id, opts) {
    opts = opts || {};
    const target = $(id);
    if (!target) { console.error("No screen", id); return; }
    const prevId = app.current;
    if (prevId && app.screens[prevId] && app.screens[prevId].onLeave) {
      try { app.screens[prevId].onLeave(id); } catch (e) { console.error(e); }
    }
    document.querySelectorAll("main > .screen").forEach(s => { s.hidden = (s.id !== id); });
    target.classList.remove("entering"); void target.offsetWidth; target.classList.add("entering");
    if (!opts.noPush && prevId && prevId !== id) app.history.push(prevId);
    app.current = id;
    setStep(target.getAttribute("data-step") || "");
    $("btn-reset").hidden = (id === "screen-hook");
    hideResetConfirm();
    if (app.screens[id] && app.screens[id].onEnter) {
      try { app.screens[id].onEnter(app.state, opts); } catch (e) { console.error(e); }
    }
    window.scrollTo({ top: 0, behavior: "auto" });
    if (app.onShow) app.onShow();
    const h = target.querySelector("h1");
    if (h && !opts.noFocus) setTimeout(() => { try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }, 30);
  };

  app.back = function () {
    const prev = app.history.pop();
    if (prev) app.show(prev, { noPush: true });
  };

  function setStep(step) {
    const order = ["choose", "teach", "test", "break", "improve", "build"];
    const idx = order.indexOf(step);
    document.querySelectorAll("#steps li").forEach(li => {
      const i = order.indexOf(li.getAttribute("data-step"));
      li.classList.toggle("done", idx >= 0 && i < idx);
      if (i === idx) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
  }

  /* ------------------------------------------------------------------ */
  /* Small shared UI                                                     */
  /* ------------------------------------------------------------------ */

  app.announce = function (text) {
    const live = $("live");
    live.textContent = "";
    setTimeout(() => { live.textContent = text; }, 40);
  };

  let toastTimer = null;
  app.toast = function (text, ms) {
    const t = $("toast");
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms || 2600);
  };

  /** Move a shared element (camera, meter, chart) into a slot inside a screen. */
  app.mountInto = function (el, screenEl, slotClass) {
    const slot = screenEl.querySelector("." + slotClass);
    if (!slot) return;
    slot.appendChild(el);
    el.hidden = false;
  };

  /**
   * The training moment: a short, honest pause while the head is fitted.
   * Resolves after the animation (or immediately-ish under reduced motion).
   */
  app.trainingMoment = function (opts) {
    opts = opts || {};
    const ov = $("overlay"), bar = $("overlay-progress");
    $("overlay-title").textContent = opts.title || "Learning from your examples…";
    $("overlay-sub").textContent = opts.sub || "";
    ov.hidden = false;
    bar.classList.remove("done");
    const ms = reducedMotion() ? 350 : (opts.ms || 850);
    requestAnimationFrame(() => bar.classList.add("done"));
    return new Promise(resolve => setTimeout(() => {
      $("overlay-title").textContent = opts.doneTitle || "Trained.";
      app.announce((opts.doneTitle || "Trained.") + " " + (opts.sub || ""));
      setTimeout(() => { ov.hidden = true; resolve(); }, reducedMotion() ? 150 : 450);
    }, ms));
  };

  /* ---------- the meter ---------- */
  const meter = {
    el: null, names: ["A", "B"], lastSr: 0, lastBucket: "",
    mount(screenEl, opts) {
      app.mountInto($("meter"), screenEl, "meter-slot");
      $("meter").classList.toggle("no-bar", !!(opts && opts.bar === false));
    },
    setNames(a, b) {
      meter.names = [a || "A", b || "B"];
      $("meter-end-a").textContent = "● " + meter.names[0];
      $("meter-end-b").textContent = meter.names[1] + " ■";
    },
    idle(note) {
      const m = $("meter");
      m.classList.add("idle");
      $("meter-say").className = "meter-say";
      $("meter-mark").textContent = "";
      $("meter-label").textContent = "—";
      $("meter-pct").textContent = "";
      $("meter-note").textContent = note || "";
      $("meter-needle").style.left = "50%";
      $("meter-mask-l").style.right = "50%"; $("meter-mask-r").style.left = "50%";
    },
    /** p = probability of class B (0..1). */
    set(p, note) {
      const m = $("meter");
      m.classList.remove("idle");
      p = Math.min(1, Math.max(0, p));
      const label = p >= 0.5 ? 1 : 0;
      const conf = Math.max(p, 1 - p);
      const pct = Math.round(conf * 100);
      const unsure = conf < 0.62;
      const say = $("meter-say");
      say.className = "meter-say " + (unsure ? "unsure" : (label ? "b" : "a"));
      $("meter-mark").textContent = unsure ? "?" : (label ? "■" : "●");
      $("meter-label").textContent = unsure ? "UNSURE" : meter.names[label];
      $("meter-pct").textContent = unsure ? "" : pct + "%";
      $("meter-note").textContent = note !== undefined ? note : (unsure ? ("leaning " + meter.names[label] + " " + pct + "%") : "");
      const pos = p * 100;
      $("meter-needle").style.left = pos + "%";
      const start = Math.min(pos, 50), end = Math.max(pos, 50);
      $("meter-mask-l").style.right = (100 - start) + "%";
      $("meter-mask-r").style.left = end + "%";
      // Screen-reader summary, throttled and only when the reading changes bucket.
      const bucket = (unsure ? "unsure" : meter.names[label]) + ":" + Math.round(conf * 10);
      const now = Date.now();
      if (bucket !== meter.lastBucket && now - meter.lastSr > 2500) {
        meter.lastBucket = bucket; meter.lastSr = now;
        $("meter-sr").textContent = unsure ? ("Model is unsure, leaning " + meter.names[label] + " " + pct + " percent") : ("Model says " + meter.names[label] + ", " + pct + " percent");
      }
      return { label, conf, pct, unsure };
    },
    text(p) {
      const label = p >= 0.5 ? 1 : 0, conf = Math.max(p, 1 - p), pct = Math.round(conf * 100);
      return conf < 0.62 ? ("unsure, leaning " + meter.names[label] + " " + pct + "%") : (meter.names[label] + " " + pct + "%");
    }
  };
  app.meter = meter;

  /* ------------------------------------------------------------------ */
  /* Session lifecycle                                                   */
  /* ------------------------------------------------------------------ */

  app.newSession = function (keep) {
    app.state = freshState(keep);
    app.history = [];
    FF.counter.event("session_started");
  };

  /** Destroy the session. Camera off. Back to the hook. */
  app.reset = function () {
    try { FF.vision.stopCamera(); } catch (e) {}
    app.state = freshState();
    app.history = [];
    // Drop any leftover thumbnails / snapshots from the DOM.
    ["thumbs-a", "thumbs-b", "understand-snapshot", "improve-added", "challenge-card", "recap"].forEach(id => { const el = $(id); if (el) el.innerHTML = ""; });
    try { FF.map.reset(); } catch (e) {}
    const bd = $("connect-backdrop"); if (bd) { bd.hidden = true; bd.removeAttribute("src"); }
    $("idea-input").value = "";
    $("cam-off").hidden = false;
    hideResetConfirm();
    app.show("screen-hook", { noPush: true });
    app.announce("Reset. Ready for the next visitor.");
  };

  app.completeSession = function () {
    const s = app.state;
    if (s.completed) return;
    s.completed = true;
    FF.counter.event("completed");
    if (!s.counted) { s.counted = true; FF.counter.addFuture(s.domain); }
  };

  function showResetConfirm() { $("reset-confirm").hidden = false; $("btn-reset").hidden = true; $("btn-reset-yes").focus(); }
  function hideResetConfirm() { $("reset-confirm").hidden = true; if (app.current !== "screen-hook") $("btn-reset").hidden = false; }

  /* ------------------------------------------------------------------ */
  /* Screens owned by app.js                                             */
  /* ------------------------------------------------------------------ */

  // HOOK
  let attractTimer = null;
  const attract = attractField($("attract-canvas"));
  app.registerScreen("screen-hook", {
    onEnter() {
      attract.start();
      const t = FF.counter.get();
      const el = $("hook-tally");
      if (FF.counter.enabled() && t.total > 0) {
        el.hidden = false;
        el.textContent = "Today at this station: " + t.total + " future" + (t.total === 1 ? "" : "s") + " built.";
      } else el.hidden = true;
      clearInterval(attractTimer);
      const spans = $("attract").querySelectorAll("span");
      let i = 0;
      spans.forEach(s => s.classList.remove("on"));
      if (!reducedMotion()) {
        attractTimer = setInterval(() => {
          spans.forEach(s => s.classList.remove("on"));
          spans[i % spans.length].classList.add("on");
          i++;
        }, 900);
      }
    },
    onLeave() { clearInterval(attractTimer); attract.stop(); }
  });

  /**
   * The attract field: a loose cloud of points that, every so often, sorts
   * itself into two groups with a line between them, holds, and lets go.
   * Procedural (no data) — the exhibit's own question, animated.
   */
  function attractField(canvas) {
    if (!canvas) return { start() {}, stop() {} };
    const ctx = canvas.getContext("2d");
    const N = 96, pts = [];
    for (let i = 0; i < N; i++) pts.push({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, lab: i % 2, ph: Math.random() * Math.PI * 2, sp: 0.4 + Math.random() * 0.6, cx: 0, cy: 0, gx: 0, gy: 0 });
    pts.forEach(p => { p.gx = (p.lab ? 0.55 : -0.55) + (Math.random() - 0.5) * 0.5; p.gy = (Math.random() - 0.5) * 1.3; p.cx = p.x; p.cy = p.y; });
    let raf = null, t0 = 0;
    const PERIOD = 14000, SORT_AT = 6000, HOLD = 4200;
    function size() {
      const r = canvas.parentElement.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
      canvas.style.width = r.width + "px"; canvas.style.height = r.height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return [r.width, r.height];
    }
    function frame(now) {
      const [W, H] = [canvas.clientWidth, canvas.clientHeight];
      const t = (now - t0) % PERIOD;
      let sorted = 0; // 0..1 how far into the sorted state
      if (t > SORT_AT && t < SORT_AT + 1600) sorted = (t - SORT_AT) / 1600;
      else if (t >= SORT_AT + 1600 && t < SORT_AT + 1600 + HOLD) sorted = 1;
      else if (t >= SORT_AT + 1600 + HOLD && t < SORT_AT + 1600 + HOLD + 1600) sorted = 1 - (t - SORT_AT - 1600 - HOLD) / 1600;
      const e = sorted < 0.5 ? 4 * sorted * sorted * sorted : 1 - Math.pow(-2 * sorted + 2, 3) / 2;
      ctx.clearRect(0, 0, W, H);
      const cx0 = W / 2, cy0 = H / 2, sx = W * 0.42, sy = H * 0.42;
      if (e > 0.02) {
        ctx.save(); ctx.globalAlpha = 0.55 * e; ctx.strokeStyle = "#f5b400"; ctx.lineWidth = 2; ctx.shadowColor = "#f5b400"; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.moveTo(cx0, cy0 - sy * e); ctx.lineTo(cx0, cy0 + sy * e); ctx.stroke(); ctx.restore();
      }
      pts.forEach(p => {
        const wx = p.x + Math.sin(now / 3000 * p.sp + p.ph) * 0.08, wy = p.y + Math.cos(now / 3400 * p.sp + p.ph) * 0.08;
        const tx = wx + (p.gx - wx) * e, ty = wy + (p.gy - wy) * e;
        p.cx += (tx - p.cx) * 0.06; p.cy += (ty - p.cy) * 0.06;
        const X = cx0 + p.cx * sx, Y = cy0 + p.cy * sy;
        ctx.globalAlpha = 0.22 + 0.36 * e;
        ctx.fillStyle = p.lab ? "#f5b400" : "#7cc4ff";
        if (p.lab) ctx.fillRect(X - 4, Y - 4, 8, 8); else { ctx.beginPath(); ctx.arc(X, Y, 4.5, 0, Math.PI * 2); ctx.fill(); }
      });
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }
    return {
      start() {
        size();
        if (reducedMotion()) { t0 = performance.now(); frame(performance.now()); cancelAnimationFrame(raf); raf = null; return; }
        if (raf) return;
        t0 = performance.now();
        raf = requestAnimationFrame(frame);
        window.addEventListener("resize", size);
      },
      stop() { if (raf) cancelAnimationFrame(raf); raf = null; window.removeEventListener("resize", size); }
    };
  }

  $("btn-start").addEventListener("click", () => {
    app.newSession();
    app.show("screen-domain");
    // Warm the vision engine in the background so the camera lab is instant.
    setTimeout(() => { try { FF.vision.loadModel(); } catch (e) {} }, 300);
  });

  // DOMAIN
  const grid = $("domain-grid");
  C.domains.forEach(d => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "choice";
    b.innerHTML = '<span class="choice-title"></span><span class="choice-sub"></span>';
    b.querySelector(".choice-title").textContent = d.name;
    b.querySelector(".choice-sub").textContent = d.short;
    b.addEventListener("click", () => {
      app.state.domain = d.id;
      FF.counter.event("domain_" + d.id);
      app.show("screen-mode");
    });
    grid.appendChild(b);
  });
  app.registerScreen("screen-domain", {
    onEnter() {
      grid.querySelectorAll("button").forEach((b, i) => b.setAttribute("aria-pressed", C.domains[i].id === app.state.domain ? "true" : "false"));
    }
  });

  // MODE
  app.registerScreen("screen-mode", {
    onEnter() {
      const note = $("mode-vision-note");
      if (!FF.vision.hasCameraAPI()) {
        note.textContent = "This browser can't use a camera here (it needs https or localhost). You can still try — or use the Data Lab.";
      } else note.textContent = L.camera.privacy;
    }
  });
  $("btn-mode-vision").addEventListener("click", () => {
    app.state.mode = "vision";
    FF.counter.event("vision_path_started");
    app.show("screen-vision-setup");
  });
  $("btn-mode-data").addEventListener("click", () => {
    app.state.mode = "data";
    FF.counter.event("data_path_started");
    app.show("screen-data-teach");
  });

  // UNDERSTAND (shared by vision and data)
  app.registerScreen("screen-understand", {
    onEnter(s) {
      $("understand-praise").textContent = L.failure.praise;
      $("h-understand").textContent = L.failure.question;
      const snap = $("understand-snapshot");
      snap.innerHTML = "";
      if (s.mode === "vision" && s.vision.snapshot) {
        const c = document.createElement("canvas");
        c.width = s.vision.snapshot.width; c.height = s.vision.snapshot.height;
        c.getContext("2d").drawImage(s.vision.snapshot, 0, 0);
        c.setAttribute("role", "img");
        c.setAttribute("aria-label", "The moment it went wrong: the camera frame you showed it");
        snap.appendChild(c);
      }
      const said = document.createElement("p");
      said.className = "said";
      if (s.mode === "vision") {
        meter.setNames(s.vision.classes[0], s.vision.classes[1]);
        said.textContent = "It said: " + meter.text(s.vision.failurePrediction == null ? 0.5 : s.vision.failurePrediction);
      } else if (s.mode === "data" && s.data.failurePoint) {
        const d = app.domain().sensor;
        const fp = s.data.failurePoint;
        said.textContent = "At " + d.x.label.toLowerCase() + " " + fp.x + " " + d.x.unit + ", " + d.y.label.toLowerCase() + " " + fp.y + " " + d.y.unit + ", it said: " + fp.said + (fp.evidence === "weak" ? " — with no similar readings nearby." : ".");
      }
      snap.appendChild(said);
      const ev = $("understand-evidence");
      if (s.mode === "vision") {
        if (app.visionUnderstand) app.visionUnderstand();
        const weak = s.vision.failureEvidence && s.vision.failureEvidence.weak;
        ev.hidden = !weak;
        ev.textContent = weak ? L.evidence.weakVision : "";
      } else {
        ev.hidden = true;
        const m = document.querySelector("#screen-understand .map-slot"); if (m) m.innerHTML = "";
      }
      const chips = $("reason-chips");
      chips.innerHTML = "";
      s.reason = [];
      $("reason-reflection").hidden = true;
      const reasons = s.mode === "data" ? L.reasons.data : L.reasons.vision;
      reasons.forEach(r => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "chip"; b.textContent = r.label; b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", () => {
          const on = b.getAttribute("aria-pressed") !== "true";
          b.setAttribute("aria-pressed", on ? "true" : "false");
          if (on) s.reason.push(r.id); else s.reason = s.reason.filter(x => x !== r.id);
          const ref = $("reason-reflection");
          if (on) { ref.hidden = false; ref.textContent = r.reflection; } else if (!s.reason.length) ref.hidden = true;
        });
        chips.appendChild(b);
      });
    }
  });
  $("btn-to-improve").addEventListener("click", () => {
    app.show(app.state.mode === "data" ? "screen-data-improve" : "screen-vision-improve");
  });

  // LESSON
  app.registerScreen("screen-lesson", {
    onEnter(s) {
      const list = s.mode === "series" ? L.conceptsSeries : L.concepts;
      const wrap = $("concepts");
      wrap.innerHTML = "";
      list.forEach(c => {
        const d = document.createElement("div");
        d.className = "concept";
        d.innerHTML = '<div class="key"></div><div class="text"></div>';
        d.querySelector(".key").textContent = c.key;
        d.querySelector(".text").textContent = c.text;
        wrap.appendChild(d);
      });
      $("lesson-close").textContent = L.lessonClose;
      $("lesson-scale").textContent = L.scale || "";
    }
  });
  $("btn-to-connect").addEventListener("click", () => app.show("screen-connect"));

  // CONNECT
  app.registerScreen("screen-connect", {
    onEnter(s) {
      app.completeSession();
      $("closing-lead").textContent = L.closing.lead;
      const lines = $("closing-lines");
      lines.innerHTML = "";
      L.closing.lines.forEach(t => { const d = document.createElement("div"); d.textContent = t; lines.appendChild(d); });
      $("closing-loop").textContent = L.closing.loop;
      $("h-connect").textContent = L.closing.belong;
      $("closing-trust").textContent = L.closing.trustQuestion;
      renderRecap(s);
      renderBackdrop(s);
      const dom = app.domain();
      $("idea-label").textContent = L.idea.prompt.replace("{domain}", dom ? dom.keyword : "your field");
      $("idea-privacy").textContent = L.idea.privacy;
      $("idea-box").hidden = !!s.card;
      $("challenge-card").hidden = !s.card;
      $("connect-actions").hidden = !s.card;
      if (s.card) renderCard(s.card);
    }
  });

  /** The lab record: what this visitor actually did, in one strip. Session memory only. */
  function renderRecap(s) {
    const R = L.recap, el = $("recap");
    if (!el) return;
    const items = [];
    const dom = app.domain();
    if (dom) items.push(dom.name);
    items.push(s.mode === "data" ? R.data : s.mode === "series" ? R.series : R.vision);
    if (s.mode === "vision") {
      const shots = new Set(s.vision.examples.filter(e => e.phase !== "improve").map(e => e.shot)).size;
      if (shots) items.push(R.examples.replace("{n}", shots));
    } else if (s.mode === "data") {
      const n = s.data.points.filter(p => p.phase !== "improve").length;
      if (n) items.push(R.readings.replace("{n}", n));
    } else if (s.mode === "series" && s.series) {
      const ss = s.series;
      if (ss.sorters === 2) {
        const A = ss.labels.A, B = ss.labels.B;
        let d = 0; for (const c in A) if ((A[c] === 0 || A[c] === 1) && (B[c] === 0 || B[c] === 1) && A[c] !== B[c]) d++;
        items.push(R.sorters.replace("{d}", d));
      } else items.push(R.solo);
    }
    if (s.mode !== "series") {
      if (s.failureFound) {
        const reasons = (s.mode === "data" ? L.reasons.data : L.reasons.vision).filter(r => s.reason.includes(r.id)).map(r => r.label);
        items.push(R.broke.replace("{how}", reasons.length ? reasons.join(", ") : "found the failure"));
      } else if (s.failureSkipped) items.push(R.couldntBreak);
      if (s.improvementMade) {
        const n = s.mode === "data" ? s.data.improveAdded : s.vision.improveAdded;
        items.push(s.improvedBetter === false ? R.stillFooled.replace("{n}", n) : (n === 1 ? R.improved : R.improvedPlural).replace("{n}", n));
      }
    }
    if (s.failureFound) items.push(R.judged);
    el.innerHTML = "";
    const lead = document.createElement("span"); lead.className = "recap-lead"; lead.textContent = R.lead;
    el.appendChild(lead);
    const list = document.createElement("ul"); list.setAttribute("aria-label", R.lead);
    items.forEach(t => { const li = document.createElement("li"); li.textContent = t; list.appendChild(li); });
    el.appendChild(list);
    el.hidden = !items.length;
  }

  /** The visitor's own constellation (or scatter), faint, behind the belong line. */
  function renderBackdrop(s) {
    const img = $("connect-backdrop");
    if (!img) return;
    let url = null;
    try {
      if (s.mode === "vision" && FF.map && FF.map.snapshotDataURL) url = FF.map.snapshotDataURL();
      else if (s.mode === "data") {
        const svg = document.getElementById("chart");
        if (svg) {
          const clone = svg.cloneNode(true);
          clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
          const st = document.createElementNS("http://www.w3.org/2000/svg", "style");
          st.textContent = ".pt-a{fill:#7cc4ff}.pt-b{fill:#f5b400}.region-a{fill:#7cc4ff;opacity:.13}.region-b{fill:#f5b400;opacity:.13}.test{fill:#fff}.test-ring{fill:none;stroke:#fff;stroke-width:3}text{fill:#f4f7f5;font-family:sans-serif}.axis line{stroke:rgba(255,255,255,.35)}.grid line{stroke:rgba(255,255,255,.08)}.label{fill:#c3d6cd;font-size:18px}";
          clone.insertBefore(st, clone.firstChild);
          clone.removeAttribute("class"); clone.setAttribute("width", "1200"); clone.setAttribute("height", "825");
          url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(clone));
        }
      } else if (s.mode === "series") {
        const svg = document.querySelector("#series-chart-wrap svg");
        if (svg) {
          const clone = svg.cloneNode(true);
          clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
          const st = document.createElementNS("http://www.w3.org/2000/svg", "style");
          st.textContent = ".conf-line{fill:none;stroke:#fff;stroke-width:4}.conf-dot{stroke:#062b21;stroke-width:2}.band{fill:#ff9e80;opacity:.22}.unsure-zone{fill:#fff;opacity:.07}.miss{fill:none;stroke:#ff9e80;stroke-width:4}text{fill:#f4f7f5;font-family:sans-serif}.label{fill:#c3d6cd}.axis line{stroke:rgba(255,255,255,.35)}";
          clone.insertBefore(st, clone.firstChild);
          clone.removeAttribute("class"); clone.setAttribute("width", "1200"); clone.setAttribute("height", "650");
          url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(clone));
        }
      }
    } catch (e) { url = null; }
    if (url) { img.src = url; img.hidden = false; } else { img.hidden = true; img.removeAttribute("src"); }
  }

  function renderCard(card) {
    const CC = C.challengeCards;
    const el = $("challenge-card");
    el.innerHTML = "";
    const title = document.createElement("div"); title.className = "card-title"; title.textContent = CC.title;
    const q = document.createElement("div"); q.className = "card-q"; q.textContent = card.question;
    el.appendChild(title); el.appendChild(q);
    if (card.build) { const p = document.createElement("p"); p.className = "card-line"; p.innerHTML = "<b>Build question:</b> "; p.appendChild(document.createTextNode(card.build)); el.appendChild(p); }
    if (card.responsibility) { const p = document.createElement("p"); p.className = "card-line"; p.innerHTML = "<b>Responsibility question:</b> "; p.appendChild(document.createTextNode(card.responsibility)); el.appendChild(p); }
    const next = document.createElement("p"); next.className = "card-line"; next.innerHTML = "<b>" + CC.nextLead + "</b> ";
    next.appendChild(document.createTextNode((card.next || []).join(" ")));
    el.appendChild(next);
    const close = document.createElement("p"); close.className = "card-close"; close.textContent = CC.close; el.appendChild(close);
    el.hidden = false;
  }

  async function makeChallenge(useIdea) {
    const s = app.state;
    s.idea = useIdea ? $("idea-input").value : "";
    const btn = $("btn-make-challenge"), skip = $("btn-skip-idea");
    btn.disabled = true; skip.disabled = true;
    btn.textContent = "Writing your challenge…";
    try {
      s.card = await FF.challenge.makeCard(app.domain(), s.idea, app.lessonCode(), s.seed);
    } catch (e) {
      s.card = FF.challenge.localCard(app.domain(), s.idea, app.lessonCode(), s.seed);
    }
    btn.disabled = false; skip.disabled = false; btn.textContent = "Make my challenge";
    $("idea-box").hidden = true;
    renderCard(s.card);
    $("connect-actions").hidden = false;
    app.announce("Your Future Forge challenge: " + s.card.question);
    $("btn-to-finish").focus();
  }
  $("btn-make-challenge").addEventListener("click", () => makeChallenge(true));
  $("btn-skip-idea").addEventListener("click", () => makeChallenge(false));
  $("idea-input").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); makeChallenge(true); } });
  $("btn-to-finish").addEventListener("click", () => app.show("screen-finish"));

  // FINISH
  app.registerScreen("screen-finish", {
    onEnter(s) {
      $("h-finish").textContent = L.closing.institution;
      const t = FF.counter.get();
      const tally = $("tally");
      if (FF.counter.enabled() && t.total > 0) {
        tally.hidden = false;
        renderFuturesField($("futures-field"), t);
        const text = $("tally-text");
        text.innerHTML = "";
        const total = document.createElement("p"); total.className = "tally-total";
        total.innerHTML = L.closing.counterLead + " <span class=\"n\"></span> " + (t.total === 1 ? L.closing.counterUnit.replace(/s$/, "") : L.closing.counterUnit) + ".";
        total.querySelector(".n").textContent = String(t.total);
        text.appendChild(total);
        const legend = document.createElement("p"); legend.className = "tally-legend";
        C.domains.forEach((d, i) => {
          const sp = document.createElement("span");
          const sw = document.createElement("i"); sw.className = "sw"; sw.style.background = DOMAIN_COLORS[i % DOMAIN_COLORS.length]; sw.setAttribute("aria-hidden", "true");
          sp.appendChild(sw); sp.appendChild(document.createTextNode(d.name + " " + (t.byDomain[d.id] || 0)));
          legend.appendChild(sp);
        });
        text.appendChild(legend);
        $("tally-close").hidden = false;
        $("tally-close").textContent = L.closing.counterClose;
      } else { tally.hidden = true; $("tally-close").hidden = true; }
      const other = s.mode === "data" ? "vision" : "data";
      $("replay-switch-title").textContent = other === "data" ? "Try the Data Lab" : "Try the Vision Lab";
      $("replay-switch-sub").textContent = other === "data" ? "Same idea, with sensor readings instead of a camera." : "Same idea, with real objects under the camera.";
    }
  });

  const DOMAIN_COLORS = ["#7cc4ff", "#f5b400", "#5ee0a1", "#ff9e80", "#c9b8ff", "#f4f7f5"];

  /**
   * Today's futures as a sunflower field: one seed per completed session,
   * coloured by the future it was built in. Counts only — nothing else exists.
   */
  function renderFuturesField(canvas, t) {
    if (!canvas) return;
    const total = Math.min(2500, t.total || 0);
    const r = canvas.parentElement.getBoundingClientRect();
    const W = Math.max(240, Math.min(r.width, 720));
    const H = Math.round(Math.min(W * 0.62, Math.max(110, 34 * Math.sqrt(total) + 60)));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    // Interleave the domains so the field reads as a mix, not bands.
    const remaining = C.domains.map((d, i) => ({ i, n: t.byDomain[d.id] || 0 }));
    const seq = [];
    while (seq.length < total) {
      let best = null;
      remaining.forEach(x => { if (x.n > 0 && (!best || x.n > best.n)) best = x; });
      if (!best) break;
      seq.push(best.i); best.n -= 1;
    }
    const cx = W / 2, cy = H / 2;
    const scale = Math.min(W, H) / 2 / Math.sqrt(Math.max(total, 12)) * 0.92;
    const dot = Math.max(3, Math.min(9, scale * 0.42));
    seq.forEach((di, i) => {
      const rad = scale * Math.sqrt(i + 0.5), ang = i * 2.399963;
      const x = cx + rad * Math.cos(ang), y = cy + rad * Math.sin(ang);
      ctx.fillStyle = DOMAIN_COLORS[di % DOMAIN_COLORS.length];
      ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(x, y, dot, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    canvas.setAttribute("aria-label", "Today's futures at this station: " + t.total + " in total. " + C.domains.map(d => d.name + " " + (t.byDomain[d.id] || 0)).join(", ") + ".");
  }

  function replay(keep, screen) {
    FF.counter.event("repeat_started");
    app.newSession(keep);
    app.show(screen, { noPush: true });
  }
  $("btn-replay-same").addEventListener("click", () => {
    const s = app.state;
    const mode = s.mode === "series" ? "vision" : s.mode;
    replay({ domain: s.domain, mode }, mode === "data" ? "screen-data-teach" : "screen-vision-setup");
  });
  $("btn-replay-switch").addEventListener("click", () => {
    const s = app.state;
    const mode = s.mode === "data" ? "vision" : "data";
    replay({ domain: s.domain, mode }, mode === "data" ? "screen-data-teach" : "screen-vision-setup");
  });
  $("btn-replay-domain").addEventListener("click", () => replay({}, "screen-domain"));
  $("btn-finish-reset").addEventListener("click", () => app.reset());

  /* ------------------------------------------------------------------ */
  /* Reset, back, keyboard                                               */
  /* ------------------------------------------------------------------ */

  $("btn-reset").addEventListener("click", showResetConfirm);
  $("btn-reset-yes").addEventListener("click", () => app.reset());
  $("btn-reset-no").addEventListener("click", () => { hideResetConfirm(); $("btn-reset").focus(); });
  document.querySelectorAll("[data-back]").forEach(b => b.addEventListener("click", () => app.back()));

  document.addEventListener("keydown", e => {
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Escape" && !$("reset-confirm").hidden) { hideResetConfirm(); return; }
    const h = app.screens[app.current];
    if (h && h.onKey) h.onKey(e, app.state);
  });

  /* ------------------------------------------------------------------ */
  /* Staff panel                                                         */
  /* ------------------------------------------------------------------ */

  const dlg = $("staff-dialog");
  async function openStaff() {
    const sel = $("staff-camera");
    const cams = await FF.vision.listCameras();
    const saved = app.stationCamera();
    sel.innerHTML = '<option value="">Default camera</option>';
    cams.forEach((c, i) => {
      const o = document.createElement("option");
      o.value = c.deviceId; o.textContent = c.label || ("Camera " + (i + 1));
      if (c.deviceId === saved) o.selected = true;
      sel.appendChild(o);
    });
    const t = FF.counter.get();
    $("staff-tally-text").textContent = FF.counter.enabled()
      ? (t.total + " futures today · started " + (t.events.session_started || 0) + " · completed " + (t.events.completed || 0) + " · failures found " + (t.events.failure_discovered || 0) + " · improved " + (t.events.improvement_completed || 0) + " · replays " + (t.events.repeat_started || 0))
      : "Tally disabled in config.js.";
    const ep = cfg.challengeEndpoint || {};
    $("staff-status").textContent = "Version " + (cfg.version || "?") + " · Vision engine: " + FF.vision.engineName + " (" + FF.vision.status + ") · Challenge service: " + (ep.enabled ? "on" : "off (local generator)") + " · Served from " + location.protocol.replace(":", "") + (navigator.serviceWorker && navigator.serviceWorker.controller ? " · offline cache active" : "");
    $("staff-hints").checked = !document.body.classList.contains("no-hints");
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
  }
  $("btn-staff").addEventListener("click", openStaff);
  $("btn-staff-close").addEventListener("click", () => dlg.close ? dlg.close() : dlg.removeAttribute("open"));
  $("staff-camera").addEventListener("change", e => {
    try { if (e.target.value) localStorage.setItem("ff.station.camera", e.target.value); else localStorage.removeItem("ff.station.camera"); } catch (err) {}
  });
  $("btn-staff-clear-tally").addEventListener("click", () => { FF.counter.clear(); $("staff-tally-text").textContent = "Cleared."; });
  $("staff-hints").addEventListener("change", e => {
    document.body.classList.toggle("no-hints", !e.target.checked);
    try { localStorage.setItem("ff.station.hints", e.target.checked ? "1" : "0"); } catch (err) {}
  });
  app.stationCamera = function () { try { return localStorage.getItem("ff.station.camera") || null; } catch (e) { return null; } };

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */

  try {
    const hints = localStorage.getItem("ff.station.hints");
    if (hints === "0" || cfg.showKeyboardHints === false) document.body.classList.add("no-hints");
  } catch (e) {}

  $("footer-version").textContent = cfg.version ? "Future Forge " + String(cfg.version).replace(/^v/i, "") : "";
  $("privacy-line-1").textContent = L.camera.privacy;
  $("cam-aim").textContent = L.camera.aim;

  // Abandoned-session guard (booth convenience, privacy-positive: an abandoned
  // camera session is cleared). Any touch, click or key restarts the clock.
  const idleMin = Number(cfg.idleResetMinutes || 0);
  if (idleMin > 0) {
    let warnTimer = null, resetTimer = null;
    const arm = () => {
      clearTimeout(warnTimer); clearTimeout(resetTimer);
      if (resetTimer) $("toast").hidden = true;
      resetTimer = null;
      if (app.current === "screen-hook") return;
      warnTimer = setTimeout(() => {
        app.toast("Still building? Touch anything to keep going.", 60000);
        resetTimer = setTimeout(() => { resetTimer = null; app.reset(); }, 60000);
      }, idleMin * 60000);
    };
    ["pointerdown", "keydown", "touchstart"].forEach(ev => document.addEventListener(ev, arm, { passive: true }));
    app.onShow = arm;
  }

  if (cfg.offlineCache !== false && "serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
  } else if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    // Cache switched off: drop any copy an earlier visit left behind.
    navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
  }

  app.show("screen-hook", { noPush: true, noFocus: true });
  window.FF.app = app;
})();
