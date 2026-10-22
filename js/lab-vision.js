/* Future Forge — js/lab-vision.js
 *
 * Live Vision Lab, free mode: two piles of anything.
 * Screens: vision-setup → vision-teach → vision-test → vision-break → (understand) → vision-improve → lesson
 * The camera and the map (js/map.js) travel with the visitor from screen to
 * screen, so the lab reads as one instrument changing state, not pages.
 * The ordered-series (deck) mode branches off vision-setup into js/lab-series.js.
 */
(function () {
  "use strict";

  const $ = id => document.getElementById(id);
  const app = FF.app, vision = FF.vision, meter = app.meter, map = FF.map;
  const L = FF_CONTENT.lessons;
  const cfg = window.FF_CONFIG || {};
  const camHolder = $("cam-holder"), video = $("cam");
  const reduced = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = ms => new Promise(r => setTimeout(r, ms));

  const names = () => app.state.vision.classes;
  let lastCap = null;   // most recent {features, canvas} from the live loop
  let camBusy = false;
  let shotCounter = 0;

  /** Examples are counted in shots (button presses); each shot stores a small burst of frames. */
  function shotsFor(label) {
    const ids = new Set();
    app.state.vision.examples.forEach(e => { if (e.label === label) ids.add(e.shot); });
    return ids.size;
  }

  function mountCam(screenId) {
    app.mountInto(camHolder, $(screenId), "cam-slot");
    $("cam-off").hidden = vision.cameraOn();
  }
  function mountMap(screenId) {
    map.mount($(screenId));
    map.setNames(names()[0], names()[1]);
  }

  function flash() {
    if (reduced()) return;
    camHolder.classList.remove("flash");
    void camHolder.offsetWidth;
    camHolder.classList.add("flash");
  }

  async function ensureEngine(buttons) {
    if (vision.status === "ready" || vision.status === "fallback") return;
    buttons.forEach(b => { b.disabled = true; });
    app.toast("Getting the vision engine ready…", 1500);
    await vision.loadModel();
    buttons.forEach(b => { b.disabled = false; });
  }

  /* ---------------- SETUP ---------------- */

  function camErrorText(code) {
    switch (code) {
      case "denied": return "Camera permission was declined. Allow it from the browser's address bar and try again — or use the Data Lab, which teaches the same thing.";
      case "blocked": return "This page is being shown inside another page that doesn't allow camera use. Use the Data Lab here — it teaches the same thing — or open Future Forge on its own for the Vision Lab.";
      case "not-found": return "No camera was found on this device. The Data Lab teaches the same thing without one.";
      case "in-use": return "The camera is busy in another app or tab. Close it and try again — or use the Data Lab.";
      case "no-api": return "This browser can't open a camera from this page (it needs https or localhost). The Data Lab teaches the same thing.";
      default: return "The camera couldn't start. Try again — or use the Data Lab, which teaches the same thing.";
    }
  }

  function renderKitChoices() {
    const grid = $("kit-grid");
    grid.innerHTML = "";
    const free = document.createElement("button");
    free.type = "button"; free.className = "choice";
    free.innerHTML = '<span class="choice-title">Two piles of anything</span><span class="choice-sub">Cards, objects, whatever is on the table. You name the piles.</span>';
    free.addEventListener("click", () => {
      app.state.kit = "free"; app.state.mode = "vision";
      app.show("screen-vision-teach");
    });
    grid.appendChild(free);
    (FF_CONTENT.series || []).forEach(s => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "choice";
      b.innerHTML = '<span class="choice-title"></span><span class="choice-sub"></span>';
      b.querySelector(".choice-title").textContent = s.name;
      b.querySelector(".choice-sub").textContent = (s.note || "") + " Sort it — best with a partner.";
      b.addEventListener("click", () => {
        app.state.kit = s.id; app.state.mode = "series";
        FF.counter.event("series_started");
        app.show("screen-series-setup");
      });
      grid.appendChild(b);
    });
  }

  app.registerScreen("screen-vision-setup", {
    onEnter() {
      mountCam("screen-vision-setup");
      $("cam-error").hidden = true;
      $("btn-cam-to-data").hidden = true;
      renderKitChoices();
      const on = vision.cameraOn();
      $("cam-controls").hidden = on;
      $("kit-choice").hidden = !on;
      if (!vision.hasCameraAPI() && !on) {
        $("cam-error").hidden = false; $("cam-error").textContent = camErrorText("no-api"); $("btn-cam-to-data").hidden = false;
      }
      vision.loadModel();
    }
  });

  $("btn-cam-on").addEventListener("click", async () => {
    if (camBusy) return;
    camBusy = true;
    const btn = $("btn-cam-on");
    btn.disabled = true; btn.textContent = "Starting camera…";
    $("cam-error").hidden = true;
    try {
      await vision.startCamera(video, app.stationCamera());
      $("cam-off").hidden = true;
      $("cam-controls").hidden = true;
      $("kit-choice").hidden = false;
      app.announce("Camera is on. Choose what to teach it with.");
      const first = $("kit-grid").querySelector("button");
      if (first) first.focus();
    } catch (err) {
      $("cam-error").hidden = false;
      $("cam-error").textContent = camErrorText(err && err.code);
      $("btn-cam-to-data").hidden = false;
      app.announce($("cam-error").textContent);
    }
    btn.disabled = false; btn.textContent = "Turn on camera";
    camBusy = false;
  });
  $("btn-cam-to-data").addEventListener("click", () => {
    app.state.mode = "data";
    FF.counter.event("data_path_started");
    app.show("screen-data-teach");
  });

  document.addEventListener("ff:camera-ended", () => {
    const id = app.current || "";
    if (/vision|series/.test(id) && id !== "screen-vision-setup") {
      app.toast("The camera stopped. Turn it on again to continue.", 4000);
      $("cam-off").hidden = false;
      app.show("screen-vision-setup");
    }
  });

  /* ---------------- live loop: meter + map ---------------- */

  function startLoop(opts) {
    opts = opts || {};
    lastCap = null;
    vision.startLoop(cap => {
      lastCap = cap;
      map.setLive(cap.features);
      if (opts.meter) {
        const m = app.state.vision.model;
        if (m) meter.set(m.predict(cap.features).p);
      }
    }, 150);
  }

  /* ---------------- TEACH ---------------- */

  function renderThumbs() {
    const ex = app.state.vision.examples;
    [0, 1].forEach(label => {
      const wrap = $(label ? "thumbs-b" : "thumbs-a");
      wrap.innerHTML = "";
      const mine = ex.filter(e => e.label === label && e.thumb);
      mine.slice(-6).forEach(e => wrap.appendChild(e.thumb));
      if (mine.length > 6) { const more = document.createElement("span"); more.className = "more"; more.textContent = "+" + (mine.length - 6); wrap.appendChild(more); }
      const n = shotsFor(label);
      $(label ? "count-b" : "count-a").textContent = n + (n === 1 ? " example" : " examples");
    });
    updateTrainButton();
  }

  function updateTrainButton() {
    const nA = shotsFor(0), nB = shotsFor(1);
    const min = cfg.minExamplesPerClass || 3;
    const ok = nA >= min && nB >= min;
    $("btn-vision-train").disabled = !ok;
    const note = $("vision-train-note");
    if (!nA && !nB) note.textContent = "";
    else if (!nA || !nB) note.textContent = "Add examples to both piles. A model can only learn a difference it has been shown.";
    else if (!ok) note.textContent = "A few more of each — " + min + " is the minimum, five or more is better.";
    else if (nA < 5 || nB < 5) note.textContent = "You can train now. More examples usually help.";
    else note.textContent = "";
  }

  function refreshMap(opts) {
    map.setExamples(app.state.vision.examples, app.state.vision.model, opts || {});
  }

  async function addExample(label, phase) {
    if (!vision.cameraOn()) { app.toast("The camera is off."); return; }
    const btnA = $("btn-add-a"), btnB = $("btn-add-b");
    await ensureEngine([btnA, btnB]);
    btnA.disabled = btnB.disabled = true;
    flash();
    const shot = ++shotCounter;
    const from = map.live && map.live.tx != null ? [map.live.cx, map.live.cy] : null;
    const caps = await vision.burst(cfg.burstFrames || 3, (cap, i) => {
      app.state.vision.examples.push({ features: cap.features, label, shot, phase: phase || "teach", thumb: i === 0 ? vision.thumbnail(cap.canvas, 64) : null });
      if (i === 0) { refreshMap({ enterFrom: from }); if (phase !== "improve") map.caption(L.map.teach); }
      if (phase !== "improve") renderThumbs();
    });
    btnA.disabled = btnB.disabled = false;
    const n = shotsFor(label);
    app.announce("Added to " + names()[label] + ". " + n + (n === 1 ? " example." : " examples."));
    return caps.length;
  }

  app.registerScreen("screen-vision-teach", {
    onEnter(s) {
      if (!vision.cameraOn()) { app.show("screen-vision-setup", { noPush: true }); return; }
      mountCam("screen-vision-teach");
      mountMap("screen-vision-teach");
      $("vision-teach-hint").textContent = L.teach.vision;
      $("class-a-name").value = s.vision.classes[0];
      $("class-b-name").value = s.vision.classes[1];
      renderThumbs();
      refreshMap();
      map.clearFailure();
      map.caption(s.vision.examples.length ? L.map.teach : L.map.empty);
      ensureEngine([$("btn-add-a"), $("btn-add-b")]).then(() => startLoop({ meter: false }));
    },
    onLeave() { vision.stopLoop(); map.clearLive(); },
    onKey(e) {
      const k = e.key.toLowerCase();
      if (k === "a") { e.preventDefault(); addExample(0); }
      else if (k === "b") { e.preventDefault(); addExample(1); }
      else if (e.key === "Enter" && !$("btn-vision-train").disabled) { e.preventDefault(); trainAndGo(); }
    }
  });

  function syncNames() {
    const a = ($("class-a-name").value || "").trim() || "A";
    const b = ($("class-b-name").value || "").trim() || "B";
    app.state.vision.classes = [a, b];
    $("btn-add-a").firstChild.textContent = "Add example to " + a + " ";
    $("btn-add-b").firstChild.textContent = "Add example to " + b + " ";
    meter.setNames(a, b);
    map.setNames(a, b);
  }
  $("class-a-name").addEventListener("input", syncNames);
  $("class-b-name").addEventListener("input", syncNames);
  $("btn-add-a").addEventListener("click", () => addExample(0));
  $("btn-add-b").addEventListener("click", () => addExample(1));
  $("btn-vision-clear").addEventListener("click", () => {
    app.state.vision.examples = [];
    app.state.vision.model = null;
    renderThumbs();
    refreshMap();
    map.caption(L.map.empty);
    app.announce("Examples cleared.");
  });

  /**
   * The training moment, in place: the shots glide from "how similar they look"
   * to "which side of the line they fall on", and the line draws itself.
   */
  async function train(retrain) {
    const s = app.state;
    syncNames();
    const shots = shotsFor(0) + shotsFor(1);
    vision.stopLoop(); map.clearLive();
    app.announce((retrain ? "Learning again, with your new example. " : "Learning from your " + shots + " examples. ") + "Finding the direction that separates " + names()[0] + " from " + names()[1] + ".");
    map.caption(retrain ? L.map.retraining : L.map.training);
    document.body.classList.add("training");
    await wait(reduced() ? 150 : 500);
    s.vision.model = FF.Logistic.train(s.vision.examples.map(e => ({ x: e.features, y: e.label })));
    if (retrain) map.ghostFailure();
    refreshMap({ animate: true, duration: 1400 });
    await wait(reduced() ? 300 : 2100);
    document.body.classList.remove("training");
    map.caption(s.vision.model.kind === "logistic" ? L.map.trained : L.map.oneClass);
    app.announce(retrain ? "Retrained." : "Trained.");
    return s.vision.model;
  }

  let trainBusy = false;
  async function trainAndGo() {
    if (trainBusy) return;
    trainBusy = true;
    try { await train(false); app.show("screen-vision-test"); } finally { trainBusy = false; }
  }
  $("btn-vision-train").addEventListener("click", trainAndGo);

  /* ---------------- TEST ---------------- */

  app.registerScreen("screen-vision-test", {
    onEnter(s) {
      if (!vision.cameraOn()) { app.show("screen-vision-setup", { noPush: true }); return; }
      mountCam("screen-vision-test");
      mountMap("screen-vision-test");
      meter.mount($("screen-vision-test"), { bar: false });
      meter.setNames(names()[0], names()[1]);
      meter.idle("Show it something.");
      $("vision-test-lead").textContent = L.test.lead;
      $("vision-test-hint").textContent = L.test.vision;
      s.testsAttempted += 1;
      refreshMap();
      map.caption(L.map.test);
      startLoop({ meter: true });
    },
    onLeave() { vision.stopLoop(); map.clearLive(); },
    onKey(e) { if (e.key === "Enter") { e.preventDefault(); app.show("screen-vision-break"); } }
  });
  $("btn-to-break").addEventListener("click", () => app.show("screen-vision-break"));
  $("btn-test-more-examples").addEventListener("click", () => app.show("screen-vision-teach"));

  /* ---------------- BREAK ---------------- */

  function snapshotNow() {
    const src = vision.grabFrame();
    if (!src) return null;
    const c = document.createElement("canvas");
    c.width = src.width; c.height = src.height;
    c.getContext("2d").drawImage(src, 0, 0);
    return c;
  }

  app.registerScreen("screen-vision-break", {
    onEnter() {
      if (!vision.cameraOn()) { app.show("screen-vision-setup", { noPush: true }); return; }
      mountCam("screen-vision-break");
      mountMap("screen-vision-break");
      meter.mount($("screen-vision-break"), { bar: false });
      meter.idle("Now try to fool it.");
      $("vision-break-lead").textContent = L.breakIt.vision;
      $("break-stuck").hidden = true;
      $("btn-declare-fail").firstChild.textContent = L.breakIt.declare + " ";
      refreshMap();
      map.caption(L.map.breakIt);
      startLoop({ meter: true });
    },
    onLeave() { vision.stopLoop(); map.clearLive(); },
    onKey(e) { if (e.key === "Enter") { e.preventDefault(); declareFailure(); } }
  });

  function declareFailure() {
    const s = app.state;
    const cap = lastCap;
    s.vision.snapshot = snapshotNow();
    s.vision.failurePrediction = cap && s.vision.model ? s.vision.model.predict(cap.features).p : null;
    s.vision.failureFeatures = cap ? cap.features : null;
    s.vision.failureEvidence = cap ? map.evidence(cap.features, s.vision.examples) : { ratio: 1, weak: false };
    if (cap) map.markFailure(cap.features);
    s.failureFound = true;
    FF.counter.event("failure_discovered");
    app.show("screen-understand");
  }
  $("btn-declare-fail").addEventListener("click", declareFailure);
  $("btn-cant-break").addEventListener("click", () => {
    $("break-stuck-text").textContent = L.breakIt.stuck.vision;
    $("break-stuck").hidden = false;
  });
  $("btn-skip-break").addEventListener("click", () => {
    app.state.failureSkipped = true;
    app.show("screen-lesson");
  });

  /** Called by the shared understand screen when the session is a vision session. */
  app.visionUnderstand = function () {
    mountMap("screen-understand");
    map.caption(L.map.failure);
  };

  /* ---------------- IMPROVE ---------------- */

  function showImproveStep(step) {
    $("improve-step-add").hidden = step !== "add";
    $("improve-step-test").hidden = step !== "test";
  }

  app.registerScreen("screen-vision-improve", {
    onEnter(s) {
      if (!vision.cameraOn()) { app.show("screen-vision-setup", { noPush: true }); return; }
      mountCam("screen-vision-improve");
      mountMap("screen-vision-improve");
      $("vision-improve-lead").textContent = L.improve.vision;
      $("btn-improve-add-a").firstChild.textContent = "It's " + names()[0] + " ";
      $("btn-improve-add-b").firstChild.textContent = "It's " + names()[1] + " ";
      $("improve-added").textContent = "";
      $("btn-retrain").disabled = true;
      $("improve-still-box").hidden = true;
      s.vision.improveAdded = 0;
      showImproveStep("add");
      refreshMap();
      map.caption(L.map.improve);
      startLoop({ meter: false });
    },
    onLeave() { vision.stopLoop(); map.clearLive(); },
    onKey(e) {
      const k = e.key.toLowerCase();
      if ($("improve-step-add").hidden) return;
      if (k === "a") { e.preventDefault(); improveAdd(0); }
      else if (k === "b") { e.preventDefault(); improveAdd(1); }
      else if (e.key === "Enter" && !$("btn-retrain").disabled) { e.preventDefault(); retrain(); }
    }
  });

  async function improveAdd(label) {
    const n = await addExample(label, "improve");
    if (!n) return;
    app.state.vision.improveAdded += 1;
    app.state.vision.improveLabel = label;
    $("improve-added").textContent = "Added " + app.state.vision.improveAdded + " hard example" + (app.state.vision.improveAdded === 1 ? "" : "s") + " (as " + names()[label] + "). Now retrain.";
    $("btn-retrain").disabled = false;
    $("btn-retrain").focus();
  }
  $("btn-improve-add-a").addEventListener("click", () => improveAdd(0));
  $("btn-improve-add-b").addEventListener("click", () => improveAdd(1));

  let retrainBusy = false;
  async function retrain() {
    const s = app.state;
    if (retrainBusy) return;
    retrainBusy = true;
    try { await train(true); } finally { retrainBusy = false; }
    s.improvementMade = true;
    FF.counter.event("improvement_completed");
    // Where did the moment that fooled it end up?
    let verdict = "";
    if (s.vision.failureFeatures && s.vision.model && s.vision.model.kind === "logistic") {
      const p = s.vision.model.predict(s.vision.failureFeatures);
      const side = p.label;
      const moved = s.vision.improveLabel != null && side === s.vision.improveLabel;
      verdict = (moved ? L.map.moved : L.map.notMoved).replace("{name}", names()[side]);
      s.vision.failureAfter = p.p;
    }
    showImproveStep("test");
    meter.mount($("screen-vision-improve"), { bar: false });
    meter.idle("Show it the thing that fooled it.");
    $("improve-test-lead").textContent = L.improve.testAgain;
    $("improve-still-box").hidden = true;
    map.caption(verdict || L.map.trained);
    startLoop({ meter: true });
    $("btn-improve-better").focus();
  }
  $("btn-retrain").addEventListener("click", retrain);
  $("btn-improve-better").addEventListener("click", () => {
    app.state.improvedBetter = true;
    app.show("screen-lesson");
  });
  $("btn-improve-still").addEventListener("click", () => {
    app.state.improvedBetter = false;
    $("improve-still-text").textContent = L.improve.stillMore;
    $("improve-still-box").hidden = false;
  });
  $("btn-improve-add-another").addEventListener("click", () => {
    $("btn-retrain").disabled = true;
    $("improve-added").textContent = "";
    showImproveStep("add");
    map.caption(L.map.improve);
    startLoop({ meter: false });
    $("btn-improve-add-a").focus();
  });
  $("btn-improve-move-on").addEventListener("click", () => app.show("screen-lesson"));
})();
