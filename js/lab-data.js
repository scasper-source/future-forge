/* Future Forge — js/lab-data.js
 *
 * Accessible Data Lab: two sensor readings, two labels, a nearest-neighbour
 * model. Everything works with buttons, steppers and number fields; the
 * chart is an SVG with a text equivalent and a table view.
 * Screens: data-teach → data-test → data-break → (understand) → data-improve → lesson
 */
(function () {
  "use strict";

  const $ = id => document.getElementById(id);
  const app = FF.app, meter = app.meter;
  const L = FF_CONTENT.lessons;
  const SVGNS = "http://www.w3.org/2000/svg";

  const reduced = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let trail = [];   // recent test-reading positions, for the fading trail
  const scenario = () => app.domain().sensor;
  const D = () => app.state.data;
  const classNames = () => scenario().classes.map(c => c.name);

  function fmt(v, axis) {
    const dec = axis.step < 1 ? Math.max(1, Math.ceil(-Math.log10(axis.step))) : 0;
    return Number(v).toFixed(dec);
  }
  function clamp(v, axis) { return Math.min(axis.max, Math.max(axis.min, v)); }
  function ranges() { const s = scenario(); return { x: { min: s.x.min, max: s.x.max }, y: { min: s.y.min, max: s.y.max } }; }

  /* ---------------- chart (one SVG, moved between screens) ---------------- */

  const chart = document.createElementNS(SVGNS, "svg");
  chart.setAttribute("viewBox", "0 0 640 440");
  chart.setAttribute("class", "chart");
  chart.setAttribute("role", "img");
  chart.id = "chart";
  const M = { l: 78, r: 20, t: 20, b: 64 }, W = 640, H = 440;
  const sx = v => M.l + (v - scenario().x.min) / (scenario().x.max - scenario().x.min) * (W - M.l - M.r);
  const sy = v => H - M.b - (v - scenario().y.min) / (scenario().y.max - scenario().y.min) * (H - M.t - M.b);

  function el(name, attrs, text) {
    const e = document.createElementNS(SVGNS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function renderChart(opts) {
    opts = opts || {};
    const s = scenario(), d = D();
    chart.innerHTML = "";
    const names = classNames();
    // Regions the model would assign (only when trained)
    if (d.model && opts.regions !== false) {
      const N = 30, cw = (W - M.l - M.r) / N, ch = (H - M.t - M.b) / N;
      const grow = opts.grow && !reduced();
      const g = el("g", { class: "regions" + (grow ? " grow" : "") });
      const nz = p => [(p.x - s.x.min) / (s.x.max - s.x.min), (p.y - s.y.min) / (s.y.max - s.y.min)];
      const P = d.points.map(nz);
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const x = s.x.min + (i + 0.5) / N * (s.x.max - s.x.min);
        const y = s.y.min + (j + 0.5) / N * (s.y.max - s.y.min);
        const r = d.model.predict(x, y);
        const rect = el("rect", { x: M.l + i * cw, y: H - M.b - (j + 1) * ch, width: cw + 0.5, height: ch + 0.5, class: r.label ? "region-b" : "region-a" });
        if (grow) {
          // The model's reach spreads outward from the readings it was given.
          let best = Infinity; const q = [(i + 0.5) / N, (j + 0.5) / N];
          for (const p of P) best = Math.min(best, Math.hypot(q[0] - p[0], q[1] - p[1]));
          rect.style.setProperty("--d", Math.round(Math.min(1, best / 0.9) * 1100) + "ms");
        }
        g.appendChild(rect);
      }
      chart.appendChild(g);
    }
    // Grid + axes
    const grid = el("g", { class: "grid" });
    for (let i = 0; i <= 5; i++) {
      const x = M.l + i / 5 * (W - M.l - M.r), y = M.t + i / 5 * (H - M.t - M.b);
      grid.appendChild(el("line", { x1: x, x2: x, y1: M.t, y2: H - M.b }));
      grid.appendChild(el("line", { x1: M.l, x2: W - M.r, y1: y, y2: y }));
    }
    chart.appendChild(grid);
    const axis = el("g", { class: "axis" });
    axis.appendChild(el("line", { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b }));
    axis.appendChild(el("line", { x1: M.l, x2: M.l, y1: M.t, y2: H - M.b }));
    for (let i = 0; i <= 5; i++) {
      const xv = s.x.min + i / 5 * (s.x.max - s.x.min), yv = s.y.min + i / 5 * (s.y.max - s.y.min);
      axis.appendChild(el("text", { x: sx(xv), y: H - M.b + 22, "text-anchor": "middle", class: "label" }, fmt(xv, s.x)));
      axis.appendChild(el("text", { x: M.l - 8, y: sy(yv) + 5, "text-anchor": "end", class: "label" }, fmt(yv, s.y)));
    }
    axis.appendChild(el("text", { x: M.l + (W - M.l - M.r) / 2, y: H - 14, "text-anchor": "middle", class: "label big" }, s.x.label + " (" + s.x.unit + ")"));
    const yl = el("text", { x: 18, y: M.t + (H - M.t - M.b) / 2, "text-anchor": "middle", class: "label big", transform: "rotate(-90 18 " + (M.t + (H - M.t - M.b) / 2) + ")" }, s.y.label + " (" + s.y.unit + ")");
    axis.appendChild(yl);
    chart.appendChild(axis);
    // Points
    const pts = el("g", { class: "points" });
    d.points.forEach(p => {
      const x = sx(p.x), y = sy(p.y);
      const stroke = p.phase === "improve" ? { stroke: "#fff", "stroke-width": 3 } : {};
      if (p.c) pts.appendChild(el("rect", Object.assign({ x: x - 8, y: y - 8, width: 16, height: 16, class: "pt-b" }, stroke)));
      else pts.appendChild(el("circle", Object.assign({ cx: x, cy: y, r: 9, class: "pt-a" }, stroke)));
    });
    chart.appendChild(pts);
    // Test reading, with a fading trail of where it has been
    if (opts.test) {
      const x = sx(opts.test.x), y = sy(opts.test.y);
      if (!reduced()) {
        const last = trail[trail.length - 1];
        if (!last || Math.hypot(last[0] - x, last[1] - y) > 3) { trail.push([x, y]); if (trail.length > 14) trail.shift(); }
        trail.forEach(([tx, ty], i) => chart.appendChild(el("circle", { cx: tx, cy: ty, r: 3 + i * 0.4, fill: "#fff", opacity: (0.05 + 0.3 * i / trail.length).toFixed(2) })));
      }
      chart.appendChild(el("circle", { cx: x, cy: y, r: 20, class: "test-ring" }));
      chart.appendChild(el("polygon", { points: [x, y - 13, x + 13, y, x, y + 13, x - 13, y].join(","), class: "test" }));
    }
    // Text equivalent
    const nA = d.points.filter(p => !p.c).length, nB = d.points.length - nA;
    let label = "Chart of " + d.points.length + " readings: " + nA + " " + names[0] + " (circles) and " + nB + " " + names[1] + " (squares). " +
      s.x.label + " on the horizontal axis from " + fmt(s.x.min, s.x) + " to " + fmt(s.x.max, s.x) + " " + s.x.unit + "; " +
      s.y.label + " on the vertical axis from " + fmt(s.y.min, s.y) + " to " + fmt(s.y.max, s.y) + " " + s.y.unit + ".";
    if (d.model) label += " Shaded areas show which label the model would give at each spot.";
    if (opts.test) label += " Test reading marked at " + fmt(opts.test.x, s.x) + " " + s.x.unit + ", " + fmt(opts.test.y, s.y) + " " + s.y.unit + ".";
    chart.setAttribute("aria-label", label);
  }

  function renderTable(wrapId) {
    const s = scenario(), d = D(), names = classNames();
    const wrap = $(wrapId);
    wrap.innerHTML = "";
    if (!d.points.length) { wrap.textContent = "No readings yet."; return; }
    const t = document.createElement("table");
    t.className = "readings-table";
    t.innerHTML = "<caption>All readings</caption><thead><tr><th scope=\"col\">#</th><th scope=\"col\"></th><th scope=\"col\"></th><th scope=\"col\">Label</th></tr></thead><tbody></tbody>";
    const ths = t.querySelectorAll("thead th");
    ths[1].textContent = s.x.label + " (" + s.x.unit + ")"; ths[2].textContent = s.y.label + " (" + s.y.unit + ")";
    const tb = t.querySelector("tbody");
    d.points.forEach((p, i) => {
      const tr = document.createElement("tr");
      [String(i + 1), fmt(p.x, s.x), fmt(p.y, s.y), names[p.c] + (p.phase === "improve" ? " (added after the failure)" : "")].forEach(v => { const td = document.createElement("td"); td.textContent = v; tr.appendChild(td); });
      tb.appendChild(tr);
    });
    wrap.appendChild(t);
  }

  /* ---------------- numeric fields (range + number + steppers) ---------------- */

  function buildField(containerId, axisKey, onChange) {
    const c = $(containerId);
    const s = scenario(), axis = s[axisKey];
    const id = containerId + "-" + axisKey;
    c.innerHTML = "";
    const label = document.createElement("label"); label.setAttribute("for", id + "-num"); label.textContent = axis.label;
    const row = document.createElement("div"); row.className = "field-row";
    const range = document.createElement("input"); range.type = "range"; range.min = axis.min; range.max = axis.max; range.step = axis.step; range.id = id + "-range";
    range.setAttribute("aria-label", axis.label + " slider (" + axis.unit + ")");
    const right = document.createElement("div"); right.className = "row"; right.style.gap = "6px";
    const num = document.createElement("input"); num.type = "number"; num.min = axis.min; num.max = axis.max; num.step = axis.step; num.id = id + "-num"; num.inputMode = "decimal";
    const unit = document.createElement("span"); unit.className = "unit"; unit.textContent = axis.unit;
    const steppers = document.createElement("div"); steppers.className = "steppers";
    const bigStep = (axis.max - axis.min) / 20;
    const mk = (txt, delta, aria) => { const b = document.createElement("button"); b.type = "button"; b.className = "stepper"; b.textContent = txt; b.setAttribute("aria-label", aria); b.addEventListener("click", () => set(get() + delta, true)); return b; };
    steppers.appendChild(mk("−", -bigStep, axis.label + " down"));
    steppers.appendChild(mk("+", bigStep, axis.label + " up"));
    right.appendChild(num); right.appendChild(unit); right.appendChild(steppers);
    row.appendChild(range); row.appendChild(right);
    c.appendChild(label); c.appendChild(row);
    let value = (axis.min + axis.max) / 2;
    function get() { return value; }
    function set(v, fire) {
      if (!Number.isFinite(v)) v = value;
      v = clamp(Math.round(v / axis.step) * axis.step, axis);
      value = Number(fmt(v, axis));
      range.value = value; num.value = fmt(value, axis);
      if (fire !== false && onChange) onChange(value);
    }
    range.addEventListener("input", () => set(parseFloat(range.value)));
    num.addEventListener("input", () => { const v = parseFloat(num.value); if (Number.isFinite(v)) { value = clamp(v, axis); range.value = value; if (onChange) onChange(value); } });
    num.addEventListener("change", () => set(parseFloat(num.value)));
    set(value, false);
    return { get, set, axis };
  }

  /* ---------------- TEACH ---------------- */

  let teachX, teachY, teachClass = 0;

  function refreshTeach() {
    const d = D(), names = classNames();
    renderChart({ regions: false });
    renderTable("data-table-wrap");
    const nA = d.points.filter(p => !p.c).length, nB = d.points.length - nA;
    $("data-count").textContent = d.points.length ? (d.points.length + " readings: " + nA + " " + names[0] + ", " + nB + " " + names[1] + ".") : "No readings yet.";
    const ok = nA >= 2 && nB >= 2;
    $("btn-data-train").disabled = !ok;
    const note = $("data-train-note");
    if (!d.points.length) note.textContent = "";
    else if (!nA || !nB) note.textContent = "Add readings with both labels. A model can only learn a difference it has been shown.";
    else if (!ok) note.textContent = "At least two of each label to train.";
    else note.textContent = "";
  }

  app.registerScreen("screen-data-teach", {
    onEnter(s) {
      const sc = scenario();
      $("data-intro").textContent = sc.title + ". " + sc.intro + " " + L.teach.data;
      const names = classNames();
      $("seg-class-0").textContent = "● " + names[0];
      $("seg-class-1").textContent = names[1] + " ■";
      setTeachClass(0);
      teachX = buildField("field-teach-x", "x");
      teachY = buildField("field-teach-y", "y");
      app.mountInto(chart, $("screen-data-teach"), "chart-slot");
      $("data-table-wrap").hidden = true; $("btn-data-table-toggle").setAttribute("aria-expanded", "false"); $("btn-data-table-toggle").textContent = "Show as table";
      meter.setNames(names[0], names[1]);
      refreshTeach();
    },
    onKey(e) { if (e.key === "Enter" && !$("btn-data-train").disabled) { e.preventDefault(); trainAndGo(); } }
  });

  function setTeachClass(c) {
    teachClass = c;
    $("seg-class-0").setAttribute("aria-pressed", c === 0 ? "true" : "false");
    $("seg-class-1").setAttribute("aria-pressed", c === 1 ? "true" : "false");
  }
  $("seg-class-0").addEventListener("click", () => setTeachClass(0));
  $("seg-class-1").addEventListener("click", () => setTeachClass(1));

  $("btn-data-starter").addEventListener("click", () => {
    const d = D();
    const have = new Set(d.points.map(p => p.x + "," + p.y));
    let added = 0;
    scenario().starter.forEach(([x, y, c]) => { if (!have.has(x + "," + y)) { d.points.push({ x, y, c, phase: "starter" }); added++; } });
    refreshTeach();
    app.announce(added ? ("Loaded " + added + " starter readings.") : "Starter readings are already loaded.");
    $("btn-data-train").disabled ? $("btn-data-add").focus() : $("btn-data-train").focus();
  });
  $("btn-data-add").addEventListener("click", () => {
    const d = D();
    d.points.push({ x: teachX.get(), y: teachY.get(), c: teachClass, phase: "teach" });
    refreshTeach();
    const s = scenario();
    app.announce("Added " + classNames()[teachClass] + " reading at " + fmt(teachX.get(), s.x) + " " + s.x.unit + ", " + fmt(teachY.get(), s.y) + " " + s.y.unit + ". " + d.points.length + " readings.");
  });
  $("btn-data-clear").addEventListener("click", () => { D().points = []; D().model = null; refreshTeach(); app.announce("Readings cleared."); });
  $("btn-data-table-toggle").addEventListener("click", () => {
    const w = $("data-table-wrap"), b = $("btn-data-table-toggle");
    w.hidden = !w.hidden;
    b.setAttribute("aria-expanded", w.hidden ? "false" : "true");
    b.textContent = w.hidden ? "Show as table" : "Hide table";
  });

  async function trainData(retrain) {
    const d = D();
    await app.trainingMoment({
      title: retrain ? "Learning again, with your new reading…" : "Learning from your " + d.points.length + " readings…",
      sub: "Finding which readings look like " + classNames()[0] + " and which look like " + classNames()[1] + ".",
      doneTitle: retrain ? "Retrained." : "Trained."
    });
    d.model = FF.KNN2D.train(d.points, ranges(), 3);
    return d.model;
  }
  let trainBusy = false;
  async function trainAndGo() {
    if (trainBusy) return;
    trainBusy = true;
    try { await trainData(false); app.show("screen-data-test"); } finally { trainBusy = false; }
  }
  $("btn-data-train").addEventListener("click", trainAndGo);

  /* ---------------- live prediction at a reading ---------------- */

  function predictAt(x, y, evidenceEl, chartTest) {
    const d = D(), s = scenario(), names = classNames();
    if (!d.model) return null;
    const r = d.model.predict(x, y);
    const p = r.label ? r.conf : 1 - r.conf;
    meter.set(p, r.evidence === "weak" ? "but the nearest example is far away" : "");
    if (evidenceEl) {
      const e = $(evidenceEl);
      e.className = "evidence " + r.evidence;
      e.textContent = r.evidence === "weak"
        ? "Weak evidence: no similar readings nearby. It's guessing from the closest it has."
        : "Strong evidence: similar readings nearby.";
    }
    if (chartTest !== false) renderChart({ test: { x, y } });
    d.test = { x, y, said: meter.text(p), evidence: r.evidence, label: r.label };
    return r;
  }

  function startPoint() {
    // Begin at the centre of the first label's cluster: the first prediction should look confident.
    const d = D();
    const a = d.points.filter(p => !p.c);
    const pts = a.length ? a : d.points;
    return { x: pts.reduce((s2, p) => s2 + p.x, 0) / pts.length, y: pts.reduce((s2, p) => s2 + p.y, 0) / pts.length };
  }

  /* ---------------- TEST ---------------- */

  let testX, testY;
  app.registerScreen("screen-data-test", {
    onEnter(s) {
      $("data-test-lead").textContent = L.test.lead + " " + L.test.data;
      app.mountInto(chart, $("screen-data-test"), "chart-slot");
      meter.mount($("screen-data-test"));
      meter.setNames(classNames()[0], classNames()[1]);
      s.testsAttempted += 1;
      const start = startPoint();
      trail = [];
      testX = buildField("field-test-x", "x", () => predictAt(testX.get(), testY.get(), "data-evidence"));
      testY = buildField("field-test-y", "y", () => predictAt(testX.get(), testY.get(), "data-evidence"));
      testX.set(start.x, false); testY.set(start.y, false);
      predictAt(testX.get(), testY.get(), "data-evidence", false);
      renderChart({ test: { x: testX.get(), y: testY.get() }, grow: true });
    },
    onKey(e) { if (e.key === "Enter") { e.preventDefault(); app.show("screen-data-break"); } }
  });
  $("btn-data-to-break").addEventListener("click", () => app.show("screen-data-break"));
  $("btn-data-more").addEventListener("click", () => app.show("screen-data-teach"));

  /* ---------------- BREAK ---------------- */

  let breakX, breakY;
  app.registerScreen("screen-data-break", {
    onEnter(s) {
      $("data-break-lead").textContent = L.breakIt.data;
      $("data-hint-text").hidden = true;
      app.mountInto(chart, $("screen-data-break"), "chart-slot");
      meter.mount($("screen-data-break"));
      const from = D().test || startPoint();
      trail = [];
      breakX = buildField("field-break-x", "x", () => predictAt(breakX.get(), breakY.get(), "data-break-evidence"));
      breakY = buildField("field-break-y", "y", () => predictAt(breakX.get(), breakY.get(), "data-break-evidence"));
      breakX.set(from.x, false); breakY.set(from.y, false);
      predictAt(breakX.get(), breakY.get(), "data-break-evidence");
    },
    onKey(e) { if (e.key === "Enter") { e.preventDefault(); declareDataFailure(); } }
  });

  function declareDataFailure() {
    const s = app.state, d = D();
    const r = predictAt(breakX.get(), breakY.get(), "data-break-evidence");
    d.failurePoint = { x: breakX.get(), y: breakY.get(), said: d.test.said, evidence: r ? r.evidence : "strong", label: r ? r.label : 0 };
    d.failureEvidence = d.failurePoint.evidence;
    s.failureFound = true;
    FF.counter.event("failure_discovered");
    app.show("screen-understand");
  }
  $("btn-data-declare-fail").addEventListener("click", declareDataFailure);
  $("btn-data-hint").addEventListener("click", () => {
    const h = $("data-hint-text");
    h.hidden = false;
    h.textContent = scenario().hint + " " + L.breakIt.stuck.data;
  });
  $("btn-data-skip-break").addEventListener("click", () => { app.state.failureSkipped = true; app.show("screen-lesson"); });

  /* ---------------- IMPROVE ---------------- */

  app.registerScreen("screen-data-improve", {
    onEnter(s) {
      const d = D(), sc = scenario(), names = classNames();
      $("data-improve-lead").textContent = L.improve.data;
      app.mountInto(chart, $("screen-data-improve"), "chart-slot");
      const fp = d.failurePoint || d.test || startPoint();
      $("data-improve-point").textContent = "The reading that fooled it: " + sc.x.label.toLowerCase() + " " + fmt(fp.x, sc.x) + " " + sc.x.unit + ", " + sc.y.label.toLowerCase() + " " + fmt(fp.y, sc.y) + " " + sc.y.unit + ". It said " + (fp.said || "—") + ".";
      $("btn-data-improve-0").textContent = "● It's really " + names[0];
      $("btn-data-improve-1").textContent = "It's really " + names[1] + " ■";
      $("btn-data-retrain").disabled = true;
      $("data-improve-add").hidden = false;
      $("data-improve-test").hidden = true;
      $("data-still-box").hidden = true;
      d.improveAdded = 0;
      renderChart({ test: { x: fp.x, y: fp.y } });
    },
    onKey(e) { if (e.key === "Enter" && !$("btn-data-retrain").disabled && $("data-improve-test").hidden) { e.preventDefault(); retrainData(); } }
  });

  function improveAddData(c) {
    const d = D(), sc = scenario();
    const fp = d.failurePoint || d.test;
    // Exactly one new example: the contested reading, with the visitor's label.
    d.points.push({ x: Number(fmt(clamp(fp.x, sc.x), sc.x)), y: Number(fmt(clamp(fp.y, sc.y), sc.y)), c, phase: "improve" });
    d.improveAdded += 1;
    renderChart({ test: { x: fp.x, y: fp.y } });
    $("btn-data-retrain").disabled = false;
    app.announce("Added the reading as " + classNames()[c] + ". Now retrain.");
    $("btn-data-retrain").focus();
  }
  $("btn-data-improve-0").addEventListener("click", () => improveAddData(0));
  $("btn-data-improve-1").addEventListener("click", () => improveAddData(1));

  let retrainBusy = false;
  async function retrainData() {
    const s = app.state, d = D();
    if (retrainBusy) return;
    retrainBusy = true;
    try { await trainData(true); } finally { retrainBusy = false; }
    s.improvementMade = true;
    FF.counter.event("improvement_completed");
    $("data-improve-add").hidden = true;
    $("data-improve-test").hidden = false;
    meter.mount($("screen-data-improve"));
    const fp = d.failurePoint || d.test;
    const before = fp.said;
    trail = [];
    predictAt(fp.x, fp.y, "data-improve-evidence", false);
    renderChart({ test: { x: fp.x, y: fp.y }, grow: true });
    $("data-improve-result").textContent = "Same reading. Before: " + before + ". Now: " + d.test.said + ".";
    $("data-still-box").hidden = true;
    $("btn-data-better").focus();
  }
  $("btn-data-retrain").addEventListener("click", retrainData);
  $("btn-data-better").addEventListener("click", () => { app.state.improvedBetter = true; app.show("screen-lesson"); });
  $("btn-data-still").addEventListener("click", () => {
    app.state.improvedBetter = false;
    $("data-still-text").textContent = L.improve.stillMore;
    $("data-still-box").hidden = false;
  });
  $("btn-data-add-another").addEventListener("click", () => {
    $("data-improve-add").hidden = false; $("data-improve-test").hidden = true; $("btn-data-retrain").disabled = true;
    $("btn-data-improve-0").focus();
  });
  $("btn-data-move-on").addEventListener("click", () => app.show("screen-lesson"));
})();
