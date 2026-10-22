/* Future Forge — js/vision.js
 *
 * Camera and image features for the Live Vision Lab.
 *
 *   - Frames are drawn from the <video> into a 224x224 canvas, embedded, and
 *     discarded. Nothing is stored except the feature vector and, for the
 *     thumbnail strip, a 52-pixel canvas that lives only in memory.
 *   - Features come from a local MobileNet v2 (0.35) with global average pooling,
 *     loaded from models/mobilenet-v2-035/model.js (no network). If TensorFlow.js
 *     or the model fails for any reason, handcrafted features take over and the
 *     experience continues.
 */
window.FF = window.FF || {};

(function () {
  "use strict";

  const vision = {
    status: "idle",            // idle | loading | ready | fallback
    engineName: "—",
    backend: "",
    inputSize: 224,
    model: null,
    stream: null,
    video: null,
    deviceId: null,
    lastError: null,
    _canvas: null,
    _ctx: null,
    _loopTimer: null,
    _loopBusy: false
  };

  /* ---------------- model ---------------- */

  function base64ToArrayBuffer(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = () => resolve(src);
      s.onerror = () => reject(new Error("Failed to load " + src));
      document.head.appendChild(s);
    });
  }

  /**
   * Load TensorFlow.js and the local MobileNet on demand (about 2.2 MB, once).
   * Safe to call repeatedly; the same promise is reused.
   */
  vision.loadModel = function () {
    if (vision._loading) return vision._loading;
    vision._loading = loadModelOnce();
    return vision._loading;
  };

  async function loadModelOnce() {
    if (vision.status === "ready" || vision.status === "fallback") return vision.status;
    vision.status = "loading";
    try {
      if (typeof tf === "undefined") await loadScript("vendor/tf.min.js");
      if (typeof tf === "undefined") throw new Error("TensorFlow.js not loaded");
      if (!window.FF_MODEL) await loadScript("models/mobilenet-v2-035/model.js");
      const M = window.FF_MODEL;
      if (!M || !M.modelTopology || !M.weightsBase64) throw new Error("Model file missing");
      try { await tf.setBackend("webgl"); } catch (e) { await tf.setBackend("cpu"); }
      await tf.ready();
      vision.backend = tf.getBackend();
      const artifacts = {
        modelTopology: M.modelTopology,
        weightSpecs: M.weightSpecs,
        weightData: base64ToArrayBuffer(M.weightsBase64)
      };
      const model = await tf.loadLayersModel(tf.io.fromMemory(artifacts));
      vision.inputSize = M.inputSize || 224;
      // Warm up once so the first real prediction is not slow.
      const warm = tf.tidy(() => model.predict(tf.zeros([1, vision.inputSize, vision.inputSize, 3])));
      await warm.data();
      warm.dispose();
      vision.model = model;
      vision.engineName = (M.name || "MobileNet") + " · " + vision.backend;
      vision.status = "ready";
    } catch (err) {
      vision.lastError = err;
      vision.model = null;
      vision.engineName = "Fallback image features (no neural network)";
      vision.status = "fallback";
      if (window.console) console.warn("[Future Forge] Embedding model unavailable, using fallback features:", err && err.message);
    }
    return vision.status;
  }

  /* ---------------- camera ---------------- */

  vision.hasCameraAPI = function () {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  };

  vision.listCameras = async function () {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      return all.filter(d => d.kind === "videoinput");
    } catch (e) { return []; }
  };

  /**
   * Start the camera into `videoEl`. Resolves when frames are flowing.
   * Throws an Error with .code in: no-api, blocked, denied, not-found, in-use, other
   */
  vision.startCamera = async function (videoEl, deviceId) {
    if (!vision.hasCameraAPI()) { const e = new Error("Camera not available in this browser"); e.code = "no-api"; throw e; }
    // Embedded in another page (an iframe) whose permissions policy withholds the camera:
    // say so plainly instead of reporting a "declined" permission nobody was asked for.
    const policy = document.permissionsPolicy || document.featurePolicy;
    if (window.self !== window.top && policy && typeof policy.allowsFeature === "function" && !policy.allowsFeature("camera")) {
      const e = new Error("Camera withheld by the embedding page"); e.code = "blocked"; throw e;
    }
    vision.stopCamera();
    const base = { width: { ideal: 640 }, height: { ideal: 480 } };
    const constraints = { audio: false, video: deviceId ? Object.assign({ deviceId: { exact: deviceId } }, base) : Object.assign({ facingMode: { ideal: "environment" } }, base) };
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      if (deviceId && (err.name === "OverconstrainedError" || err.name === "NotFoundError")) {
        // The remembered camera is gone; try any camera.
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: base });
      } else {
        const e = new Error(err.message || String(err));
        e.code = err.name === "NotAllowedError" || err.name === "SecurityError" ? "denied"
          : err.name === "NotFoundError" || err.name === "DevicesNotFoundError" ? "not-found"
          : err.name === "NotReadableError" || err.name === "TrackStartError" ? "in-use" : "other";
        throw e;
      }
    }
    vision.stream = stream;
    vision.video = videoEl;
    try {
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        if (vision.stream === stream) { vision.stream = null; document.dispatchEvent(new CustomEvent("ff:camera-ended")); }
      });
    } catch (e) {}
    vision.deviceId = (stream.getVideoTracks()[0].getSettings() || {}).deviceId || deviceId || null;
    videoEl.srcObject = stream;
    videoEl.setAttribute("playsinline", "");
    videoEl.muted = true;
    await videoEl.play().catch(() => {});
    await new Promise(resolve => {
      if (videoEl.readyState >= 2 && videoEl.videoWidth) return resolve();
      const done = () => { videoEl.removeEventListener("loadeddata", done); resolve(); };
      videoEl.addEventListener("loadeddata", done);
      setTimeout(resolve, 2500);
    });
    return stream;
  };

  vision.stopCamera = function () {
    vision.stopLoop();
    if (vision.stream) {
      vision.stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
      vision.stream = null;
    }
    if (vision.video) { try { vision.video.srcObject = null; } catch (e) {} }
  };

  vision.cameraOn = function () {
    return !!(vision.stream && vision.stream.active && vision.video && vision.video.videoWidth);
  };

  /* ---------------- frames & features ---------------- */

  function workCanvas() {
    if (!vision._canvas) {
      vision._canvas = document.createElement("canvas");
      vision._canvas.width = vision._canvas.height = vision.inputSize;
      vision._ctx = vision._canvas.getContext("2d", { willReadFrequently: true });
    }
    if (vision._canvas.width !== vision.inputSize) { vision._canvas.width = vision._canvas.height = vision.inputSize; }
    return vision._canvas;
  }

  /** Draw the centre square of the live video into the 224x224 working canvas. */
  vision.grabFrame = function () {
    const v = vision.video;
    if (!v || !v.videoWidth) return null;
    const c = workCanvas();
    const s = Math.min(v.videoWidth, v.videoHeight);
    const sx = (v.videoWidth - s) / 2, sy = (v.videoHeight - s) / 2;
    vision._ctx.drawImage(v, sx, sy, s, s, 0, 0, c.width, c.height);
    return c;
  };

  /** Copy a canvas into a small thumbnail canvas (kept in memory only). */
  vision.thumbnail = function (src, size) {
    size = size || 52;
    const t = document.createElement("canvas");
    t.width = t.height = size;
    t.getContext("2d").drawImage(src, 0, 0, size, size);
    return t;
  };

  /** Feature vector for a canvas: MobileNet embedding, or handcrafted features. */
  vision.embed = async function (canvas) {
    if (vision.model) {
      const out = tf.tidy(() => {
        const img = tf.browser.fromPixels(canvas).toFloat().div(127.5).sub(1).expandDims(0);
        return vision.model.predict(img);
      });
      const data = await out.data();
      out.dispose();
      return new Float32Array(data);
    }
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const small = document.createElement("canvas");
    small.width = small.height = 64;
    small.getContext("2d").drawImage(canvas, 0, 0, 64, 64);
    const id = small.getContext("2d").getImageData(0, 0, 64, 64);
    void ctx;
    return FF.features.handcrafted(id);
  };

  /** Grab + embed the current frame. Returns {features, canvas} or null. */
  vision.capture = async function () {
    const c = vision.grabFrame();
    if (!c) return null;
    const features = await vision.embed(c);
    return { features, canvas: c };
  };

  /** A short burst of captures, ~100 ms apart. */
  vision.burst = async function (count, onEach) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const cap = await vision.capture();
      if (!cap) break;
      out.push(cap);
      if (onEach) onEach(cap, i);
      if (i < count - 1) await new Promise(r => setTimeout(r, 100));
    }
    return out;
  };

  /* ---------------- prediction loop ---------------- */

  vision.startLoop = function (onFrame, intervalMs) {
    vision.stopLoop();
    intervalMs = intervalMs || 150;
    const tick = async () => {
      if (!vision._loopTimer) return;
      if (!document.hidden && vision.cameraOn() && !vision._loopBusy) {
        vision._loopBusy = true;
        try {
          const cap = await vision.capture();
          if (cap && vision._loopTimer) onFrame(cap);
        } catch (e) { /* keep the loop alive */ }
        vision._loopBusy = false;
      }
      if (vision._loopTimer) vision._loopTimer = setTimeout(tick, intervalMs);
    };
    vision._loopTimer = setTimeout(tick, 0);
  };

  vision.stopLoop = function () {
    if (vision._loopTimer) { clearTimeout(vision._loopTimer); vision._loopTimer = null; }
  };

  window.FF.vision = vision;
})();
