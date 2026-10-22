/* Future Forge — js/map.js
 *
 * The map: a truthful picture of the model's interior.
 *
 * Every shot the visitor takes is a 1280-number feature vector. This draws
 * those vectors as points in two real dimensions:
 *
 *   before training  — the two main directions of variation among the shots
 *                      (principal components), so the visitor watches their
 *                      examples land in the space the network actually sees;
 *   after training   — x is the model's own decision axis (its logit: the line
 *                      it learned runs straight down the middle, A left, B right),
 *                      y is the biggest remaining variation — differences the
 *                      network noticed but the model does not use.
 *
 * The live camera frame is a bright point moving through the same space.
 * Nothing here is decorative: a point's side of the line IS the prediction.
 *
 * All of it is session memory, cleared on reset. Reduced motion: no glides,
 * no trail, no pulse — positions simply update.
 */
window.FF = window.FF || {};

(function () {
  "use strict";

  const reduced = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- linear algebra (small n, big d) ---------------- */

  function dot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
  function norm(a) { return Math.sqrt(dot(a, a)) || 1; }
  function unit(a) { const n = norm(a), o = new Float32Array(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i] / n; return o; }

  /** Top-k principal directions of a small set of d-vectors, via the n×n Gram matrix. */
  function principalDirections(U, k) {
    const n = U.length;
    if (!n) return [];
    const d = U[0].length;
    const G = new Float64Array(n * n);
    for (let i = 0; i < n; i++) for (let j = i; j < n; j++) { const g = dot(U[i], U[j]); G[i * n + j] = g; G[j * n + i] = g; }
    const dirs = [];
    for (let c = 0; c < Math.min(k, n); c++) {
      let v = new Float64Array(n); for (let i = 0; i < n; i++) v[i] = Math.sin(i * 1.7 + c) + 0.5;
      let lambda = 0;
      for (let it = 0; it < 60; it++) {
        const nv = new Float64Array(n);
        for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < n; j++) s += G[i * n + j] * v[j]; nv[i] = s; }
        lambda = Math.sqrt(nv.reduce((s, x) => s + x * x, 0)) || 1;
        for (let i = 0; i < n; i++) v[i] = nv[i] / lambda;
      }
      if (lambda < 1e-6) break;
      const dir = new Float32Array(d);
      for (let i = 0; i < n; i++) for (let t = 0; t < d; t++) dir[t] += v[i] * U[i][t];
      dirs.push(unit(dir));
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) G[i * n + j] -= lambda * v[i] * v[j];
    }
    return dirs;
  }

  /* ---------------- the map ---------------- */

  const map = {
    el: null, canvas: null, ctx: null, cap: null, left: null, right: null, lineLabel: null,
    names: ["A", "B"],
    points: [],           // {id, label, phase, tx, ty, cx, cy, from, start, dur, ring}
    live: null,           // {tx, ty, cx, cy, trail:[]}
    failure: null,        // {tx, ty, cx, cy, features}
    ghost: null,          // {x, y}
    sys: null,            // coordinate system, see rebuild()
    model: null,
    boundary: 0,          // 0..1 draw-in progress
    boundaryTarget: 0,
    raf: null, mounted: false, lastT: 0,
    dpr: 1, w: 0, h: 0
  };

  function build() {
    if (map.el) return;
    const el = document.createElement("div");
    el.className = "map-wrap";
    el.innerHTML =
      '<canvas class="map" role="img" aria-label="Map of your examples"></canvas>' +
      '<span class="map-end map-end-a" aria-hidden="true"></span>' +
      '<span class="map-end map-end-b" aria-hidden="true"></span>' +
      '<span class="map-line-label" aria-hidden="true" hidden></span>' +
      '<p class="map-caption" aria-live="polite"></p>';
    map.el = el;
    map.canvas = el.querySelector("canvas");
    map.ctx = map.canvas.getContext("2d");
    map.cap = el.querySelector(".map-caption");
    map.left = el.querySelector(".map-end-a");
    map.right = el.querySelector(".map-end-b");
    map.lineLabel = el.querySelector(".map-line-label");
    try { map.lineLabel.textContent = window.FF_CONTENT.lessons.map.lineLabel || "the line it learned"; } catch (e) { map.lineLabel.textContent = "the line it learned"; }
    map.setNames("A", "B");
    window.addEventListener("resize", () => { if (map.mounted) resize(); });
  }

  function resize() {
    const r = map.el.getBoundingClientRect();
    const capH = map.cap.offsetHeight || 0;
    map.dpr = Math.min(2, window.devicePixelRatio || 1);
    map.w = Math.max(200, r.width);
    map.h = Math.max(160, r.height - capH);
    map.canvas.style.width = map.w + "px";
    map.canvas.style.height = map.h + "px";
    map.canvas.width = Math.round(map.w * map.dpr);
    map.canvas.height = Math.round(map.h * map.dpr);
    draw(performance.now());
  }

  map.mount = function (screenEl) {
    build();
    const slot = screenEl.querySelector(".map-slot");
    if (!slot) return;
    slot.appendChild(map.el);
    map.el.hidden = false;
    map.mounted = true;
    requestAnimationFrame(() => { resize(); loop(); });
  };

  map.setNames = function (a, b) {
    map.names = [a || "A", b || "B"];
    if (map.left) { map.left.textContent = "● " + map.names[0]; map.right.textContent = map.names[1] + " ■"; }
  };

  map.caption = function (text) {
    if (!map.cap) return;
    map.cap.textContent = text || "";
    if (map.mounted && map.el.isConnected) resize();
  };

  map.reset = function () {
    map.points = []; map.live = null; map.failure = null; map.ghost = null; map.sys = null; map.model = null;
    map.boundary = 0; map.boundaryTarget = 0;
    if (map.lineLabel) map.lineLabel.hidden = true;
    map.caption("");
    updateAria();
  };

  /* ---------------- coordinate systems ---------------- */

  function pad(v, L) { return Math.max(-1.15, Math.min(1.15, v / L)); }

  /**
   * Rebuild the coordinate system from the current example set (one point per shot)
   * and model (if any). Returns new [x,y] in [-1.15,1.15] for each point.
   */
  function rebuild(examples, model) {
    const feats = examples.map(e => e.features);
    const n = feats.length;
    if (!n) { map.sys = null; return []; }
    if (model && model.kind === "logistic") {
      const U = feats.map(f => model.prepare(f));
      const z = U.map(u => dot(model.w, u) + model.b);
      const wHat = model.wHat;
      const R = U.map(u => { const a = dot(u, wHat); const r = new Float32Array(u.length); for (let i = 0; i < u.length; i++) r[i] = u[i] - a * wHat[i]; return r; });
      const q = principalDirections(R, 1)[0] || null;
      const ys = R.map(r => (q ? dot(r, q) : 0));
      const L = Math.max(4, 1.15 * Math.max(...z.map(Math.abs)));
      const yMax = Math.max(1e-6, ...ys.map(Math.abs));
      map.sys = { mode: "model", model, q, L, yMax };
      return z.map((zi, i) => [pad(zi, L), ys[i] / yMax * 0.85]);
    }
    // Unsupervised: centre on the mean of the shots, top two directions.
    const d = feats[0].length;
    const mu = new Float32Array(d);
    feats.forEach(f => { for (let i = 0; i < d; i++) mu[i] += f[i] / n; });
    const U = feats.map(f => { const c = new Float32Array(d); for (let i = 0; i < d; i++) c[i] = f[i] - mu[i]; return unit(c); });
    const dirs = principalDirections(U, 2);
    const p1 = dirs[0] || null, p2 = dirs[1] || null;
    const xs = U.map(u => (p1 ? dot(u, p1) : 0)), ys = U.map(u => (p2 ? dot(u, p2) : 0));
    const xMax = Math.max(1e-6, ...xs.map(Math.abs)), yMax = Math.max(1e-6, ...ys.map(Math.abs));
    map.sys = { mode: "pca", mu, p1, p2, xMax, yMax };
    return xs.map((x, i) => [x / xMax * 0.85, ys[i] / yMax * 0.85]);
  }

  /** Project any raw feature vector into the current system. */
  function project(features) {
    const s = map.sys;
    if (!s) return null;
    if (s.mode === "model") {
      const u = s.model.prepare(features);
      const z = dot(s.model.w, u) + s.model.b;
      const a = dot(u, s.model.wHat);
      let y = 0;
      if (s.q) { let sum = 0; for (let i = 0; i < u.length; i++) sum += (u[i] - a * s.model.wHat[i]) * s.q[i]; y = sum; }
      return [pad(z, s.L), Math.max(-1.15, Math.min(1.15, y / s.yMax * 0.85))];
    }
    const c = new Float32Array(features.length);
    for (let i = 0; i < c.length; i++) c[i] = features[i] - s.mu[i];
    const u = unit(c);
    const x = s.p1 ? dot(u, s.p1) / s.xMax * 0.85 : 0, y = s.p2 ? dot(u, s.p2) / s.yMax * 0.85 : 0;
    return [Math.max(-1.15, Math.min(1.15, x)), Math.max(-1.15, Math.min(1.15, y))];
  }

  /* ---------------- public state updates ---------------- */

  /**
   * examples: [{features, label, shot, phase}] — one entry per shot is enough.
   * model: trained logistic head or null.
   * opts.animate: glide points to their new places (the "finding patterns" moment).
   */
  map.setExamples = function (examples, model, opts) {
    opts = opts || {};
    build();
    const shots = examples.filter(e => e.thumb || e.mapPoint);
    const list = shots.length ? shots : examples;
    map.model = model && model.kind === "logistic" ? model : null;
    const coords = rebuild(list, map.model);
    const now = performance.now();
    const dur = opts.animate && !reduced() ? (opts.duration || 1400) : 0;
    const seen = new Set();
    list.forEach((e, i) => {
      const id = e.shot != null ? "s" + e.shot : "i" + i;
      seen.add(id);
      let p = map.points.find(q => q.id === id);
      const [tx, ty] = coords[i];
      if (!p) {
        p = { id, label: e.label, phase: e.phase, tx, ty, cx: tx, cy: ty, from: null, start: now, dur: 0, born: now };
        if (opts.enterFrom && !reduced()) { p.cx = opts.enterFrom[0]; p.cy = opts.enterFrom[1]; p.from = [p.cx, p.cy]; p.dur = 520; }
        map.points.push(p);
      } else {
        p.from = [p.cx, p.cy]; p.start = now; p.dur = dur; p.tx = tx; p.ty = ty; p.phase = e.phase; p.label = e.label;
      }
    });
    map.points = map.points.filter(p => seen.has(p.id));
    if (map.failure && map.failure.features) {
      const f = project(map.failure.features);
      if (f) { map.failure.from = [map.failure.cx, map.failure.cy]; map.failure.start = now; map.failure.dur = dur; map.failure.tx = f[0]; map.failure.ty = f[1]; }
    }
    map.boundaryTarget = map.model ? 1 : 0;
    if (!dur) map.boundary = map.boundaryTarget;
    else if (!map.model) map.boundary = 0;
    map.boundaryStart = now + (dur ? dur * 0.7 : 0);
    if (map.lineLabel) map.lineLabel.hidden = !(map.model && map.boundary >= 1);
    updateAria();
  };

  map.setLive = function (features) {
    if (!features || !map.sys) { if (map.live) map.live.tx = null; return; }
    const c = project(features);
    if (!c) return;
    if (!map.live) map.live = { tx: c[0], ty: c[1], cx: c[0], cy: c[1], trail: [] };
    else { map.live.tx = c[0]; map.live.ty = c[1]; }
  };
  map.clearLive = function () { map.live = null; };

  map.markFailure = function (features) {
    const c = project(features);
    map.failure = c ? { features, tx: c[0], ty: c[1], cx: c[0], cy: c[1], start: performance.now(), dur: 0 } : null;
    map.ghost = null;
    updateAria();
  };
  map.clearFailure = function () { map.failure = null; map.ghost = null; };
  /** Remember where the failure point is now, so the retrain can show it moving. */
  map.ghostFailure = function () { if (map.failure) map.ghost = { x: map.failure.cx, y: map.failure.cy }; };

  /**
   * How far the nearest example is from this feature vector, relative to the typical
   * spacing between examples. ratio > 1.8 reads as "the closest thing it had seen was far away".
   */
  map.evidence = function (features, examples) {
    const list = (examples || []).filter(e => e.thumb || e.mapPoint);
    if (list.length < 2) return { ratio: 1, weak: false };
    const un = list.map(e => unit(e.features));
    const u = unit(features);
    const nn = un.map((a, i) => { let best = Infinity; for (let j = 0; j < un.length; j++) if (j !== i) best = Math.min(best, 1 - dot(a, un[j])); return best; }).sort((a, b) => a - b);
    const typical = Math.max(1e-4, nn[Math.floor(nn.length / 2)]);
    let nearest = Infinity; un.forEach(a => { nearest = Math.min(nearest, 1 - dot(u, a)); });
    const ratio = nearest / typical;
    return { ratio, weak: ratio > 1.8 };
  };

  map.snapshotDataURL = function () { try { return map.canvas ? map.canvas.toDataURL("image/png") : null; } catch (e) { return null; } };

  function updateAria() {
    if (!map.canvas) return;
    const nA = map.points.filter(p => p.label === 0).length, nB = map.points.length - nA;
    let t = "Map of your examples as the model sees them: " + nA + " " + map.names[0] + " (circles) and " + nB + " " + map.names[1] + " (squares).";
    if (map.model) t += " The line the model learned runs down the middle; " + map.names[0] + " to the left, " + map.names[1] + " to the right. Points near the line are the ones it is least sure about.";
    else if (map.points.length) t += " Not trained yet: points are placed by how similar the pictures look to the network.";
    if (map.failure) t += " The moment it went wrong is marked with a ring" + (map.failure.tx > 0 ? " on the " + map.names[1] : " on the " + map.names[0]) + " side.";
    map.canvas.setAttribute("aria-label", t);
  }

  /* ---------------- drawing ---------------- */

  const ease = u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  let colors = null;
  function palette() {
    if (colors) return colors;
    colors = { a: css("--class-a") || "#7cc4ff", b: css("--class-b") || "#f5b400", gold: css("--gold") || "#f5b400", ink: css("--ink") || "#f4f7f5", alert: css("--alert") || "#ff9e80", dim: css("--dim") || "#8fb0a3" };
    return colors;
  }

  function px(x, y) {
    const padX = 40, padY = 26;
    return [padX + (x + 1.15) / 2.3 * (map.w - 2 * padX), padY + (1.15 - y) / 2.3 * (map.h - 2 * padY)];
  }

  function step(obj, now) {
    if (obj.from && obj.dur) {
      const u = Math.min(1, (now - obj.start) / obj.dur);
      const e = ease(u);
      obj.cx = obj.from[0] + (obj.tx - obj.from[0]) * e;
      obj.cy = obj.from[1] + (obj.ty - obj.from[1]) * e;
      if (u >= 1) { obj.from = null; obj.dur = 0; }
    } else { obj.cx = obj.tx; obj.cy = obj.ty; }
  }

  function draw(now) {
    const ctx = map.ctx; if (!ctx) return;
    const P = palette();
    ctx.setTransform(map.dpr, 0, 0, map.dpr, 0, 0);
    ctx.clearRect(0, 0, map.w, map.h);
    // grid
    ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 1;
    const g = 36;
    ctx.beginPath();
    for (let x = (map.w / 2) % g; x < map.w; x += g) { ctx.moveTo(x, 0); ctx.lineTo(x, map.h); }
    for (let y = (map.h / 2) % g; y < map.h; y += g) { ctx.moveTo(0, y); ctx.lineTo(map.w, y); }
    ctx.stroke();
    // boundary
    if (map.boundaryTarget && now >= (map.boundaryStart || 0)) {
      if (reduced()) map.boundary = 1; else map.boundary = Math.min(1, map.boundary + 0.03);
      if (map.boundary >= 1 && map.lineLabel && map.lineLabel.hidden && map.model) map.lineLabel.hidden = false;
    }
    if (map.boundary > 0 && map.model) {
      const [bx] = px(0, 0);
      const half = map.h / 2 * map.boundary;
      ctx.save();
      ctx.shadowColor = P.gold; ctx.shadowBlur = 18;
      ctx.strokeStyle = P.gold; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(bx, map.h / 2 - half); ctx.lineTo(bx, map.h / 2 + half); ctx.stroke();
      ctx.restore();
      // faint tint of the two sides
      ctx.fillStyle = "rgba(124,196,255,0.04)"; ctx.fillRect(0, 0, bx, map.h);
      ctx.fillStyle = "rgba(245,180,0,0.04)"; ctx.fillRect(bx, 0, map.w - bx, map.h);
    }
    // ghost of the failure point before retraining
    if (map.ghost && map.failure) {
      const [gx, gy] = px(map.ghost.x, map.ghost.y), [fx, fy] = px(map.failure.cx, map.failure.cy);
      ctx.save(); ctx.setLineDash([5, 6]); ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(gx, gy, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(fx, fy); ctx.stroke();
      ctx.restore();
    }
    // examples
    const r = Math.max(5, Math.min(10, map.w / 90));
    map.points.forEach(p => {
      step(p, now);
      const [x, y] = px(p.cx, p.cy);
      const age = Math.min(1, (now - p.born) / 400);
      ctx.globalAlpha = reduced() ? 1 : 0.35 + 0.65 * age;
      ctx.fillStyle = p.label ? P.b : P.a;
      if (p.label) ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
      else { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
      if (p.phase === "improve") { ctx.strokeStyle = P.ink; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, r + 5, 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = 1;
    });
    // failure ring
    if (map.failure) {
      step(map.failure, now);
      const [x, y] = px(map.failure.cx, map.failure.cy);
      const pulse = reduced() ? 0 : Math.sin(now / 350) * 3;
      ctx.save(); ctx.strokeStyle = P.alert; ctx.lineWidth = 3; ctx.shadowColor = P.alert; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(x, y, r + 10 + pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, Math.PI * 2); ctx.fill();
    }
    // live point with trail
    if (map.live && map.live.tx != null) {
      const L = map.live;
      if (reduced()) { L.cx = L.tx; L.cy = L.ty; L.trail = []; }
      else {
        L.cx += (L.tx - L.cx) * 0.16; L.cy += (L.ty - L.cy) * 0.16;
        L.trail.push([L.cx, L.cy]); if (L.trail.length > 18) L.trail.shift();
        L.trail.forEach(([tx, ty], i) => { const [x, y] = px(tx, ty); ctx.globalAlpha = (i / L.trail.length) * 0.35; ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(x, y, 2 + i * 0.15, 0, Math.PI * 2); ctx.fill(); });
        ctx.globalAlpha = 1;
      }
      const [x, y] = px(L.cx, L.cy);
      ctx.save(); ctx.shadowColor = P.ink; ctx.shadowBlur = 22; ctx.fillStyle = P.ink;
      ctx.beginPath(); ctx.arc(x, y, r * 0.95, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.strokeStyle = "rgba(6,43,33,0.9)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r * 0.95, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function loop() {
    if (map.raf) cancelAnimationFrame(map.raf);
    const tick = now => {
      if (!map.mounted || !map.el.isConnected || map.el.closest("[hidden]")) { map.raf = null; map.mounted = false; return; }
      draw(now);
      map.raf = requestAnimationFrame(tick);
    };
    map.raf = requestAnimationFrame(tick);
  }
  map.wake = function () { if (map.el && map.el.isConnected && !map.raf) { map.mounted = true; resize(); loop(); } };

  window.FF.map = map;
})();
