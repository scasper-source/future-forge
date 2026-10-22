/* Future Forge — js/lab-series.js
 *
 * Ordered-series (deck) mode of the Live Vision Lab, driven by content/series.js.
 * Two sorters label the same deck without conferring; the model learns from A
 * and is tested on B. One sorter: label once, then the model judges each card.
 * The reveal is the signature picture: model confidence across the series with
 * the human disagreement band on the same axes.
 *
 * "Sorter A" and "Sorter B" are session-length labels only. Everything here is
 * destroyed on Reset with the rest of the session.
 */
(function () {
  "use strict";

  const $ = id => document.getElementById(id);
  const app = FF.app, vision = FF.vision, meter = app.meter;
  const L = FF_CONTENT.lessons.series;
  const cfg = window.FF_CONFIG || {};
  const camHolder = $("cam-holder");
  const SVGNS = "http://www.w3.org/2000/svg";
  const reduced = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const S = () => app.state.series;
  const deck = () => (FF_CONTENT.series || []).find(d => d.id === app.state.kit) || FF_CONTENT.series[0];
  const endName = i => deck().ends[i].name;

  function mountCam(screenId) {
    app.mountInto(camHolder, $(screenId), "cam-slot");
    $("cam-off").hidden = vision.cameraOn();
  }
  function shuffled(n) {
    const a = []; for (let i = 1; i <= n; i++) a.push(i);
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function cards() { const a = []; for (let i = 1; i <= deck().count; i++) a.push(i); return a; }
  function fmtCards(list) {
    if (!list.length) return "none";
    if (list.length === 1) return "card " + list[0];
    // contiguous runs → "cards 4–6"; otherwise "cards 3, 5 and 7"
    let contiguous = true;
    for (let i = 1; i < list.length; i++) if (list[i] !== list[i - 1] + 1) contiguous = false;
    if (contiguous) return "cards " + list[0] + "–" + list[list.length - 1];
    return "cards " + list.slice(0, -1).join(", ") + " and " + list[list.length - 1];
  }

  /* ---------------- model helpers ---------------- */

  function examplesFor(sorter) {
    const s = S(), out = [];
    cards().forEach(c => {
      const lab = s.labels[sorter][c];
      if (lab === 0 || lab === 1) (s.captures[sorter][c] || []).forEach(f => out.push({ x: f, y: lab }));
    });
    return out;
  }
  function trainOn(sorter) {
    const s = S();
    s.model = FF.Logistic.train(examplesFor(sorter));
    s.trainedOn = sorter;
    return s.model;
  }
  function predictCard(sorter, c) {
    const s = S();
    const feats = s.captures[sorter] && s.captures[sorter][c];
    if (!s.model || !feats || !feats.length) return null;
    let sum = 0;
    feats.forEach(f => { sum += s.model.predict(f).p; });
    return sum / feats.length;
  }
  /** Predictions for the test side: B's captures (two sorters) or the test-pass captures (one sorter). */
  function recomputePreds() {
    const s = S();
    const side = s.sorters === 2 ? (s.trainedOn === "A" ? "B" : "A") : "T";
    s.preds = {};
    cards().forEach(c => { s.preds[c] = predictCard(side, c); });
    s.testSide = side;
  }

  /* ---------------- SETUP ---------------- */

  app.registerScreen("screen-series-setup", {
    onEnter(s) {
      if (!vision.cameraOn()) { app.show("screen-vision-setup", { noPush: true }); return; }
      mountCam("screen-series-setup");
      const d = deck();
      $("h-series-setup").textContent = L.setupTitle;
      $("series-setup-intro").textContent = L.setupIntro;
      $("series-deck-name").textContent = d.name + " · " + d.count + " cards · " + d.ends[0].name + " → " + d.ends[1].name;
      $("series-deck-note").textContent = d.note || "";
      $("series-two-title").textContent = L.twoSorters; $("series-two-note").textContent = L.twoSortersNote;
      $("series-one-title").textContent = L.oneSorter; $("series-one-note").textContent = L.oneSorterNote;
      setSorters(2);
      vision.loadModel();
    }
  });
  let sortersChoice = 2;
  function setSorters(n) {
    sortersChoice = n;
    $("btn-sorters-2").setAttribute("aria-pressed", n === 2 ? "true" : "false");
    $("btn-sorters-1").setAttribute("aria-pressed", n === 1 ? "true" : "false");
    $("btn-series-begin").textContent = n === 2 ? L.beginA : L.beginOne;
  }
  $("btn-sorters-2").addEventListener("click", () => setSorters(2));
  $("btn-sorters-1").addEventListener("click", () => setSorters(1));
  $("btn-series-begin").addEventListener("click", async () => {
    const d = deck();
    app.state.series = {
      deck: d.id, sorters: sortersChoice, current: "A", idx: 0,
      order: { A: shuffled(d.count), B: shuffled(d.count), T: cards() },
      labels: { A: {}, B: {} }, captures: { A: {}, B: {}, T: {} },
      model: null, trainedOn: null, preds: {}, testSide: null, improve: { card: null, added: 0 }
    };
    if (vision.status !== "ready" && vision.status !== "fallback") { app.toast("Getting the vision engine ready…", 1500); await vision.loadModel(); }
    app.show("screen-series-label");
  });

  /* ---------------- LABEL (Sorter A, then B) ---------------- */

  function currentCard() { const s = S(); return s.order[s.current][s.idx]; }

  function renderLabel() {
    const s = S(), d = deck();
    const c = currentCard();
    const who = s.sorters === 2 ? ("Sorter " + s.current) : "Sort the deck";
    $("h-series-label").textContent = who + " — say what you see.";
    $("series-card-number").innerHTML = "";
    const num = document.createElement("span"); num.textContent = "CARD " + c;
    const sub = document.createElement("small"); sub.textContent = d.id + "-" + c + " · number on the back";
    $("series-card-number").appendChild(num); $("series-card-number").appendChild(sub);
    $("series-card-prompt").textContent = L.cardPrompt.replace("{n}", c);
    $("btn-series-end-0").innerHTML = "● " + endName(0) + ' <span class="kbd">1</span>';
    $("btn-series-end-1").innerHTML = endName(1) + ' ■ <span class="kbd">2</span>';
    const dots = $("series-dots"); dots.innerHTML = "";
    for (let i = 0; i < d.count; i++) { const sp = document.createElement("span"); if (i < s.idx) sp.className = "done"; else if (i === s.idx) sp.className = "now"; dots.appendChild(sp); }
    $("series-progress").textContent = "Card " + (s.idx + 1) + " of " + d.count + " · " + who + ".";
    $("btn-series-undo").disabled = s.idx === 0;
  }

  app.registerScreen("screen-series-label", {
    onEnter() {
      if (!S()) { app.show("screen-series-setup", { noPush: true }); return; }
      mountCam("screen-series-label");
      renderLabel();
    },
    onKey(e) {
      if (e.key === "1") { e.preventDefault(); labelCard(0); }
      else if (e.key === "2") { e.preventDefault(); labelCard(1); }
    }
  });

  let labelBusy = false;
  async function labelCard(label) {
    if (labelBusy) return;
    if (!vision.cameraOn()) { app.toast("The camera is off."); return; }
    labelBusy = true;
    const s = S(), c = currentCard();
    $("btn-series-end-0").disabled = $("btn-series-end-1").disabled = true;
    camHolder.classList.remove("flash"); void camHolder.offsetWidth; camHolder.classList.add("flash");
    const caps = await vision.burst(cfg.burstFrames || 3);
    s.captures[s.current][c] = caps.map(x => x.features);
    s.labels[s.current][c] = label;
    app.announce("Card " + c + ": " + endName(label) + ".");
    $("btn-series-end-0").disabled = $("btn-series-end-1").disabled = false;
    labelBusy = false;
    advance();
  }
  $("btn-series-end-0").addEventListener("click", () => labelCard(0));
  $("btn-series-end-1").addEventListener("click", () => labelCard(1));
  $("btn-series-skip").addEventListener("click", () => {
    const s = S(), c = currentCard();
    s.labels[s.current][c] = null; delete s.captures[s.current][c];
    app.announce("Card " + c + " skipped.");
    advance();
  });
  $("btn-series-undo").addEventListener("click", () => {
    const s = S();
    if (s.idx === 0) return;
    s.idx -= 1;
    const c = currentCard();
    delete s.labels[s.current][c]; delete s.captures[s.current][c];
    renderLabel();
    app.announce("Card " + c + " undone. Label it again.");
  });

  async function advance() {
    const s = S(), d = deck();
    s.idx += 1;
    if (s.idx < d.count) { renderLabel(); return; }
    // Pass finished.
    if (s.current === "A") {
      const n = examplesFor("A").length;
      await app.trainingMoment({
        title: "Learning from " + (s.sorters === 2 ? "Sorter A's calls…" : "your calls…"),
        sub: n ? ("Finding patterns that separate " + endName(0) + " from " + endName(1) + ".") : "",
        doneTitle: "Trained."
      });
      trainOn("A");
      if (s.sorters === 2) { s.current = "B"; s.idx = 0; app.show("screen-series-interstitial", { noFocus: false }); }
      else { s.idx = 0; app.show("screen-series-interstitial"); }
    } else {
      recomputePreds();
      app.show("screen-series-reveal");
    }
  }

  /* ---------------- INTERSTITIAL ---------------- */

  app.registerScreen("screen-series-interstitial", {
    onEnter(s) {
      const ss = s.series;
      const constant = ss.model && ss.model.kind === "constant";
      if (ss.sorters === 2) {
        $("h-series-inter").textContent = L.trainedOnA;
        $("series-inter-text").textContent = (constant ? L.oneClassOnly.replace(/\{name\}/g, endName(ss.model.constantLabel || 0)) + " " : "") + L.handoff;
        $("btn-series-inter-go").textContent = "Sorter B, begin";
      } else {
        $("h-series-inter").textContent = "Trained on your calls.";
        $("series-inter-text").textContent = (constant ? "You called every card " + endName(ss.model.constantLabel || 0) + ", so that is all it can say. " : "") + L.testIntro;
        $("btn-series-inter-go").textContent = "Begin the test";
      }
    },
    onKey(e) { if (e.key === "Enter") { e.preventDefault(); $("btn-series-inter-go").click(); } }
  });
  $("btn-series-inter-go").addEventListener("click", () => {
    const s = S();
    if (s.sorters === 2) app.show("screen-series-label"); else { s.idx = 0; app.show("screen-series-test"); }
  });

  /* ---------------- TEST PASS (one sorter) ---------------- */

  let judged = false;
  function renderTest() {
    const s = S(), d = deck(), c = s.order.T[s.idx];
    $("h-series-test").textContent = "Now the model judges each card.";
    $("series-test-number").innerHTML = "";
    const num = document.createElement("span"); num.textContent = "CARD " + c;
    const sub = document.createElement("small"); sub.textContent = d.id + "-" + c;
    $("series-test-number").appendChild(num); $("series-test-number").appendChild(sub);
    $("series-test-prompt").textContent = L.testPrompt.replace("{n}", c);
    $("series-test-progress").textContent = "Card " + (s.idx + 1) + " of " + d.count + ".";
    $("btn-series-judge").innerHTML = L.judge + ' <span class="kbd">Enter</span>';
    judged = false;
    meter.idle("Put the card under the camera, then judge it.");
  }
  app.registerScreen("screen-series-test", {
    onEnter() {
      if (!S()) { app.show("screen-series-setup", { noPush: true }); return; }
      mountCam("screen-series-test");
      meter.mount($("screen-series-test"));
      meter.setNames(endName(0), endName(1));
      renderTest();
    },
    onKey(e) { if (e.key === "Enter") { e.preventDefault(); $("btn-series-judge").click(); } }
  });
  $("btn-series-judge").addEventListener("click", async () => {
    const s = S(), c = s.order.T[s.idx];
    if (!judged) {
      if (!vision.cameraOn()) { app.toast("The camera is off."); return; }
      $("btn-series-judge").disabled = true;
      const caps = await vision.burst(cfg.burstFrames || 3);
      s.captures.T[c] = caps.map(x => x.features);
      const p = predictCard("T", c);
      meter.set(p == null ? 0.5 : p);
      app.announce("Card " + c + ": model says " + meter.text(p == null ? 0.5 : p) + ".");
      judged = true;
      $("btn-series-judge").disabled = false;
      $("btn-series-judge").innerHTML = (s.idx + 1 < deck().count ? "Next card →" : "See the picture →") + ' <span class="kbd">Enter</span>';
      return;
    }
    nextTest();
  });
  $("btn-series-test-skip").addEventListener("click", () => { const s = S(); delete s.captures.T[s.order.T[s.idx]]; nextTest(); });
  function nextTest() {
    const s = S();
    s.idx += 1;
    if (s.idx < deck().count) renderTest();
    else { recomputePreds(); app.show("screen-series-reveal"); }
  }

  /* ---------------- REVEAL: the picture ---------------- */

  function analysis() {
    const s = S(), n = deck().count, list = cards();
    const A = s.labels.A, B = s.labels.B;
    const preds = s.preds || {};
    const trainedLabels = s.labels[s.trainedOn] || {};
    const otherSorter = s.trainedOn === "A" ? "B" : "A";
    const testLabels = s.sorters === 2 ? s.labels[otherSorter] : s.labels.A;
    const disagree = s.sorters === 2 ? list.filter(c => (A[c] === 0 || A[c] === 1) && (B[c] === 0 || B[c] === 1) && A[c] !== B[c]) : [];
    const both = s.sorters === 2 ? list.filter(c => (A[c] === 0 || A[c] === 1) && (B[c] === 0 || B[c] === 1)) : [];
    const judged = list.filter(c => preds[c] != null);
    const unsure = judged.filter(c => preds[c] > 0.38 && preds[c] < 0.62);
    const modelLabel = c => (preds[c] == null ? null : (preds[c] >= 0.5 ? 1 : 0));
    const agreeWith = labels => judged.filter(c => (labels[c] === 0 || labels[c] === 1)).map(c => [c, modelLabel(c) === labels[c]]);
    const vsTrained = agreeWith(trainedLabels), vsTest = agreeWith(testLabels);
    const misses = vsTest.filter(x => !x[1]).map(x => x[0]);
    let leastSure = null;
    judged.forEach(c => { const conf = Math.max(preds[c], 1 - preds[c]); if (!leastSure || conf < leastSure.conf) leastSure = { c, conf }; });
    // Boundary drawn by the trained sorter: transitions between consecutive labelled cards.
    const boundaries = [];
    let prev = null;
    list.forEach(c => { const l = trainedLabels[c]; if (l === 0 || l === 1) { if (prev && prev.l !== l) boundaries.push([prev.c, c]); prev = { c, l }; } });
    return { n, list, A, B, preds, disagree, both, judged, unsure, misses, vsTrained, vsTest, boundaries, modelLabel, otherSorter, testLabels, trainedLabels, leastSure };
  }

  function el(name, attrs, text) {
    const e = document.createElementNS(SVGNS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function renderSeriesChart() {
    const s = S(), a = analysis(), d = deck();
    const narrow = ($("series-chart-wrap").clientWidth || 900) < 620;
    const W = narrow ? 640 : 960, H = narrow ? 520 : 520, M = { l: narrow ? 92 : 96, r: 30, t: 40, b: 150 };
    const svg = el("svg", { viewBox: "0 0 " + W + " " + H, class: "chart series-chart" + (reduced() || s.revealed ? "" : " reveal"), role: "img" });
    const xs = c => M.l + (c - 0.5) / a.n * (W - M.l - M.r);
    const ys = p => H - M.b - p * (H - M.t - M.b);
    const half = (W - M.l - M.r) / a.n / 2;
    const rowA = H - M.b + 58, rowB = H - M.b + 100;
    // Unsure zone
    svg.appendChild(el("rect", { x: M.l, y: ys(0.62), width: W - M.l - M.r, height: ys(0.38) - ys(0.62), class: "unsure-zone" }));
    svg.appendChild(el("text", { x: W - M.r - 6, y: ys(0.5) - 8, "text-anchor": "end", class: "label" }, "unsure"));
    // Disagreement bands
    const runs = [];
    a.disagree.forEach(c => { const last = runs[runs.length - 1]; if (last && last[1] === c - 1) last[1] = c; else runs.push([c, c]); });
    runs.forEach(([c1, c2], i) => {
      svg.appendChild(el("rect", { x: xs(c1) - half, y: M.t - 10, width: xs(c2) - xs(c1) + 2 * half, height: rowB + 20 - (M.t - 10), class: "band", rx: 10 }));
      if (i === 0) svg.appendChild(el("text", { x: xs(c1) - half + 8, y: M.t + 12, class: "band-label" }, "They disagreed here"));
    });
    // Trained sorter's boundary (single-sorter mode: the line they drew)
    if (s.sorters === 1) a.boundaries.forEach(([c1, c2]) => {
      const x = (xs(c1) + xs(c2)) / 2;
      svg.appendChild(el("line", { x1: x, x2: x, y1: M.t - 10, y2: rowA + 20, stroke: "#ff9e80", "stroke-width": 4, "stroke-dasharray": "10 8" }));
      svg.appendChild(el("text", { x: x + 8, y: M.t + 12, class: "band-label" }, "your line"));
    });
    // Axes
    const axis = el("g", { class: "axis" });
    axis.appendChild(el("line", { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b }));
    axis.appendChild(el("line", { x1: M.l, x2: M.l, y1: M.t, y2: H - M.b }));
    [[0, "0%"], [0.5, "50%"], [1, "100%"]].forEach(([p, t]) => {
      axis.appendChild(el("line", { x1: M.l - 6, x2: W - M.r, y1: ys(p), y2: ys(p), class: "grid" }));
      axis.appendChild(el("text", { x: M.l - 12, y: ys(p) + 5, "text-anchor": "end", class: "label" }, t));
    });
    axis.appendChild(el("text", { x: W - M.r, y: M.t - 14, "text-anchor": "end", class: "label big" }, "▲ sure it's " + endName(1) + " ■"));
    axis.appendChild(el("text", { x: W - M.r, y: H - M.b - 10, "text-anchor": "end", class: "label big" }, "▼ sure it's " + endName(0) + " ●"));
    a.list.forEach(c => axis.appendChild(el("text", { x: xs(c), y: H - M.b + 24, "text-anchor": "middle", class: "label big" }, String(c))));
    axis.appendChild(el("text", { x: M.l - 12, y: H - M.b + 24, "text-anchor": "end", class: "row-label" }, "Card"));
    svg.appendChild(axis);
    // Confidence line + dots
    const pts = a.judged.map(c => [xs(c), ys(a.preds[c])]);
    if (pts.length > 1) svg.appendChild(el("polyline", { points: pts.map(p => p.join(",")).join(" "), class: "conf-line" }));
    a.judged.forEach((c, i) => {
      const p = a.preds[c];
      const cls = p > 0.38 && p < 0.62 ? "unsure" : (p >= 0.5 ? "b" : "a");
      const fill = cls === "unsure" ? "#e9e4ff" : (cls === "b" ? "#f5b400" : "#7cc4ff");
      if (a.misses.includes(c)) svg.appendChild(el("circle", { cx: xs(c), cy: ys(p), r: 19, class: "miss" }));
      const dotEl = el("circle", { cx: xs(c), cy: ys(p), r: 11, fill, class: "conf-dot" });
      dotEl.style.setProperty("--d", (250 + i * (1400 / Math.max(1, a.judged.length))) + "ms");
      svg.appendChild(dotEl);
    });
    // Label rows
    const mark = (row, labels, name) => {
      svg.appendChild(el("text", { x: M.l - 12, y: row + 6, "text-anchor": "end", class: "row-label" }, name));
      a.list.forEach(c => {
        const l = labels[c];
        if (l === 0) svg.appendChild(el("circle", { cx: xs(c), cy: row, r: 10, fill: "#7cc4ff" }));
        else if (l === 1) svg.appendChild(el("rect", { x: xs(c) - 9, y: row - 9, width: 18, height: 18, fill: "#f5b400" }));
        else svg.appendChild(el("text", { x: xs(c), y: row + 5, "text-anchor": "middle", class: "label" }, "–"));
      });
    };
    mark(rowA, s.labels.A, s.sorters === 2 ? "Sorter A" : "You");
    if (s.sorters === 2) mark(rowB, s.labels.B, "Sorter B");
    // Text equivalent
    let label = "Model confidence across " + d.name + " cards 1 to " + a.n + ", trained on " + (s.sorters === 2 ? "Sorter " + s.trainedOn : "your labels") + ". ";
    a.list.forEach(c => {
      const p = a.preds[c];
      label += "Card " + c + ": " + (s.sorters === 2 ? "A said " + (s.labels.A[c] == null ? "skip" : endName(s.labels.A[c])) + ", B said " + (s.labels.B[c] == null ? "skip" : endName(s.labels.B[c])) : "you said " + (s.labels.A[c] == null ? "skip" : endName(s.labels.A[c])));
      label += ", model " + (p == null ? "not judged" : (Math.round(Math.max(p, 1 - p) * 100) + "% " + endName(p >= 0.5 ? 1 : 0))) + ". ";
    });
    svg.setAttribute("aria-label", label);
    const wrap = $("series-chart-wrap"); wrap.innerHTML = ""; wrap.appendChild(svg);
    s.revealed = true;
    const leg = $("series-legend");
    leg.innerHTML = "";
    [["#7cc4ff", "● " + endName(0)], ["#f5b400", "■ " + endName(1)], ["#e9e4ff", "unsure (38–62%)"], ["#ff9e80", s.sorters === 2 ? "disagreement / model differs from " + (a.otherSorter === "B" ? "Sorter B" : "Sorter A") : "your line"]].forEach(([c, t]) => {
      const sp = document.createElement("span"); const sw = document.createElement("i"); sw.className = "sw"; sw.style.background = c; sp.appendChild(sw); sp.appendChild(document.createTextNode(t)); leg.appendChild(sp);
    });
  }

  function renderSeriesTable() {
    const s = S(), a = analysis();
    const wrap = $("series-table-wrap"); wrap.innerHTML = "";
    const t = document.createElement("table"); t.className = "readings-table";
    t.innerHTML = "<caption>Every card</caption><thead><tr><th scope=\"col\">Card</th><th scope=\"col\">" + (s.sorters === 2 ? "Sorter A" : "You") + "</th>" + (s.sorters === 2 ? "<th scope=\"col\">Sorter B</th>" : "") + "<th scope=\"col\">Model (trained on " + (s.sorters === 2 ? "Sorter " + s.trainedOn : "you") + ")</th></tr></thead><tbody></tbody>";
    const tb = t.querySelector("tbody");
    a.list.forEach(c => {
      const tr = document.createElement("tr");
      const p = a.preds[c];
      const cells = [String(c), s.labels.A[c] == null ? "skipped" : endName(s.labels.A[c])];
      if (s.sorters === 2) cells.push(s.labels.B[c] == null ? "skipped" : endName(s.labels.B[c]));
      cells.push(p == null ? "not judged" : (endName(p >= 0.5 ? 1 : 0) + " " + Math.round(Math.max(p, 1 - p) * 100) + "%" + (a.misses.includes(c) ? " — differs" : "")));
      cells.forEach(v => { const td = document.createElement("td"); td.textContent = v; tr.appendChild(td); });
      tb.appendChild(tr);
    });
    wrap.appendChild(t);
  }

  function sureness(a) {
    if (a.unsure.length) return "Its confidence dropped on " + fmtCards(a.unsure) + ".";
    if (a.leastSure) return "It never dropped into the unsure zone; it was least sure on card " + a.leastSure.c + " (" + Math.round(a.leastSure.conf * 100) + "%).";
    return "";
  }

  function revealText() {
    const s = S(), a = analysis();
    const constant = s.model && s.model.kind === "constant";
    if (constant) return L.oneClassOnly.replace(/\{name\}/g, endName(s.model.constantLabel || 0));
    if (s.sorters === 2) {
      const who = "Sorter " + s.trainedOn, other = "Sorter " + a.otherSorter;
      if (!a.both.length) return "Not enough cards were labelled by both sorters to compare.";
      if (!a.disagree.length) return L.agreeAll + " " + sureness(a);
      if (a.disagree.length === a.both.length) return L.disagreeAll;
      const agreeT = a.vsTrained.filter(x => x[1]).length, agreeO = a.vsTest.filter(x => x[1]).length;
      return "Sorter A and Sorter B disagreed on " + fmtCards(a.disagree) + ". The model learned from " + who + ": it agrees with " + who + " on " + agreeT + " of " + a.vsTrained.length + " cards and with " + other + " on " + agreeO + " of " + a.vsTest.length + ". " + sureness(a);
    }
    const b = a.boundaries.length ? a.boundaries.map(([c1, c2]) => c1 + " and " + c2).join(", ") : "nowhere — every card got the same label";
    return "You drew the line between cards " + b + ". " + sureness(a) + (a.misses.length ? " It called " + fmtCards(a.misses) + " differently from you." : "");
  }

  app.registerScreen("screen-series-reveal", {
    onEnter(s) {
      if (!S()) { app.show("screen-series-setup", { noPush: true }); return; }
      const ss = s.series;
      meter.setNames(endName(0), endName(1));
      $("h-series-reveal").textContent = ss.sorters === 2 ? L.revealTwo : L.revealOne;
      const first = !ss.revealed;
      renderSeriesChart();
      renderSeriesTable();
      $("series-reveal-text").textContent = revealText();
      $("series-reveal-text").classList.toggle("reveal-text", first && !reduced());
      $("series-table-wrap").hidden = true; $("btn-series-table-toggle").setAttribute("aria-expanded", "false"); $("btn-series-table-toggle").textContent = "Show as table";
      const swap = $("btn-series-swap");
      swap.hidden = ss.sorters !== 2;
      swap.textContent = ss.trainedOn === "A" ? L.swap : L.swapBack;
      $("btn-series-improve").textContent = L.addDecision;
      s.failureFound = true;
      if (!ss.revealCounted) { ss.revealCounted = true; FF.counter.event("failure_discovered"); }
    }
  });
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    if (app.current !== "screen-series-reveal" || !S()) return;
    clearTimeout(resizeTimer); resizeTimer = setTimeout(renderSeriesChart, 150);
  });
  $("btn-series-table-toggle").addEventListener("click", () => {
    const w = $("series-table-wrap"), b = $("btn-series-table-toggle");
    w.hidden = !w.hidden; b.setAttribute("aria-expanded", w.hidden ? "false" : "true"); b.textContent = w.hidden ? "Show as table" : "Hide table";
  });
  $("btn-series-swap").addEventListener("click", async () => {
    const s = S();
    const to = s.trainedOn === "A" ? "B" : "A";
    await app.trainingMoment({ title: "Learning from Sorter " + to + " instead…", sub: "Same cards. Different judgment.", doneTitle: "Trained on Sorter " + to + "." });
    trainOn(to);
    recomputePreds();
    app.show("screen-series-reveal", { noPush: true });
  });
  $("btn-series-lesson").addEventListener("click", () => app.show("screen-lesson"));
  $("btn-series-improve").addEventListener("click", () => app.show("screen-series-improve"));

  /* ---------------- IMPROVE: add a decision ---------------- */

  let impCard = null, impBefore = null;
  app.registerScreen("screen-series-improve", {
    onEnter(s) {
      if (!S()) { app.show("screen-series-setup", { noPush: true }); return; }
      mountCam("screen-series-improve");
      meter.setNames(endName(0), endName(1));
      const a = analysis();
      $("h-series-improve").textContent = L.improveTitle;
      $("series-improve-intro").textContent = L.improveIntro;
      const row = $("series-improve-cards"); row.innerHTML = "";
      const contested = a.disagree.length ? a.disagree : a.unsure;
      impCard = contested[0] || deck().middle || Math.ceil(a.n / 2);
      a.list.forEach(c => {
        const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = String(c);
        b.setAttribute("aria-label", "Card " + c + (contested.includes(c) ? " (contested)" : ""));
        b.setAttribute("aria-pressed", c === impCard ? "true" : "false");
        if (contested.includes(c)) b.style.borderColor = "#ff9e80";
        b.addEventListener("click", () => { impCard = c; row.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false")); updateImproveStatus(); });
        row.appendChild(b);
      });
      $("btn-series-imp-0").innerHTML = "● " + endName(0) + ' <span class="kbd">1</span>';
      $("btn-series-imp-1").innerHTML = endName(1) + ' ■ <span class="kbd">2</span>';
      $("btn-series-retrain").disabled = true;
      $("series-improve-result").hidden = true;
      s.series.improve = { card: impCard, added: 0 };
      updateImproveStatus();
    },
    onKey(e) {
      if (e.key === "1") { e.preventDefault(); improveLabel(0); }
      else if (e.key === "2") { e.preventDefault(); improveLabel(1); }
      else if (e.key === "Enter" && !$("btn-series-retrain").disabled) { e.preventDefault(); $("btn-series-retrain").click(); }
    }
  });
  function updateImproveStatus() {
    const s = S(), p = s.preds[impCard];
    impBefore = p;
    $("series-improve-status").textContent = "Card " + impCard + " now: " + (p == null ? "not judged" : meter.text(p)) + ". Put card " + impCard + " under the camera and give it your call.";
  }
  async function improveLabel(label) {
    const s = S();
    if (!vision.cameraOn()) { app.toast("The camera is off."); return; }
    $("btn-series-imp-0").disabled = $("btn-series-imp-1").disabled = true;
    const caps = await vision.burst(cfg.burstFrames || 3);
    const side = s.trainedOn;
    s.captures[side][impCard] = (s.captures[side][impCard] || []).concat(caps.map(x => x.features));
    s.labels[side][impCard] = label;
    s.improve = { card: impCard, added: (s.improve.added || 0) + 1, label };
    $("btn-series-imp-0").disabled = $("btn-series-imp-1").disabled = false;
    $("btn-series-retrain").disabled = false;
    $("series-improve-status").textContent = "Added card " + impCard + " as " + endName(label) + ". Now retrain.";
    app.announce("Added card " + impCard + " as " + endName(label) + ". Now retrain.");
    $("btn-series-retrain").focus();
  }
  $("btn-series-imp-0").addEventListener("click", () => improveLabel(0));
  $("btn-series-imp-1").addEventListener("click", () => improveLabel(1));
  $("btn-series-retrain").addEventListener("click", async () => {
    const s = app.state, ss = S();
    await app.trainingMoment({ title: "Learning again, with your decision…", sub: "", doneTitle: "Retrained." });
    trainOn(ss.trainedOn);
    recomputePreds();
    s.improvementMade = true;
    FF.counter.event("improvement_completed");
    const after = ss.preds[impCard];
    const txt = L.improveResult.replace("{n}", impCard) + " Card " + impCard + " — before: " + (impBefore == null ? "not judged" : meter.text(impBefore)) + ". Now: " + (after == null ? "not judged" : meter.text(after)) + ".";
    $("series-improve-result-text").textContent = txt;
    $("series-improve-result").hidden = false;
    $("btn-series-retrain").disabled = true;
    app.announce(txt);
    $("btn-series-imp-lesson").focus();
  });
  $("btn-series-back-to-reveal").addEventListener("click", () => app.show("screen-series-reveal"));
  $("btn-series-imp-lesson").addEventListener("click", () => app.show("screen-lesson"));
})();
