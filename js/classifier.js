/* Future Forge — js/classifier.js
 *
 * The small learners. No dependencies.
 *
 *   FF.Logistic   binary logistic regression over feature vectors (vision path)
 *   FF.KNN2D      nearest-neighbour classifier over two sensor readings (data path)
 *   FF.features   handcrafted image features, used only if the embedding model fails to load
 */
window.FF = window.FF || {};

(function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* Logistic head                                                       */
  /* ------------------------------------------------------------------ */

  function l2norm(v) {
    let s = 0;
    for (let i = 0; i < v.length; i++) s += v[i] * v[i];
    s = Math.sqrt(s) || 1;
    const out = new Float32Array(v.length);
    for (let i = 0; i < v.length; i++) out[i] = v[i] / s;
    return out;
  }

  function sigmoid(z) {
    if (z >= 0) { const e = Math.exp(-z); return 1 / (1 + e); }
    const e = Math.exp(z); return e / (1 + e);
  }

  /**
   * Train a logistic classifier.
   * @param {Array<{x: Float32Array, y: number}>} examples  y is 0 (class A) or 1 (class B)
   * @param {object} [opts]  iterations, lr, l2, targetMargin
   * @returns model with predict(x) -> {p: P(class B), label: 0|1, logit}
   */
  function trainLogistic(examples, opts) {
    opts = Object.assign({ iterations: 220, lr: 0.6, l2: 0.002, targetMargin: 2.6 }, opts || {});
    const n = examples.length;
    if (n === 0) return constantModel(null);
    const d = examples[0].x.length;
    const nB = examples.reduce((s, e) => s + (e.y ? 1 : 0), 0);
    const nA = n - nB;
    if (nA === 0 || nB === 0) return constantModel(nB ? 1 : 0, examples[0].x.length);

    // Centre on the training mean, then unit-normalise: makes the head
    // insensitive to the absolute scale of whatever features it is given.
    const mu = new Float32Array(d);
    for (const e of examples) for (let i = 0; i < d; i++) mu[i] += e.x[i] / n;
    const X = examples.map(e => {
      const c = new Float32Array(d);
      for (let i = 0; i < d; i++) c[i] = e.x[i] - mu[i];
      return l2norm(c);
    });
    const Y = examples.map(e => (e.y ? 1 : 0));
    // Class-balanced weights so a lopsided pile does not drag the boundary.
    const W = Y.map(y => (y ? n / (2 * nB) : n / (2 * nA)));

    const w = new Float32Array(d);
    let b = 0;
    const grad = new Float32Array(d);
    for (let it = 0; it < opts.iterations; it++) {
      grad.fill(0);
      let gb = 0;
      for (let k = 0; k < n; k++) {
        const x = X[k];
        let z = b;
        for (let i = 0; i < d; i++) z += w[i] * x[i];
        const err = (sigmoid(z) - Y[k]) * W[k] / n;
        for (let i = 0; i < d; i++) grad[i] += err * x[i];
        gb += err;
      }
      for (let i = 0; i < d; i++) w[i] -= opts.lr * (grad[i] + opts.l2 * w[i]);
      b -= opts.lr * gb;
    }

    // Light calibration: scale logits so the median margin on the training
    // examples is `targetMargin` (~93 %). Keeps confidence readable and
    // comparable whether features come from MobileNet or the fallback.
    const margins = X.map((x, k) => {
      let z = b; for (let i = 0; i < d; i++) z += w[i] * x[i];
      return (Y[k] ? z : -z);
    }).filter(m => m > 0).sort((a, b2) => a - b2);
    let scale = 1;
    if (margins.length) {
      const med = margins[Math.floor(margins.length / 2)];
      if (med > 1e-6) scale = Math.min(50, Math.max(0.2, opts.targetMargin / med));
    }
    for (let i = 0; i < d; i++) w[i] *= scale;
    b *= scale;

    // Unit vector along the decision direction, for the map (js/map.js).
    let wn = 0; for (let i = 0; i < d; i++) wn += w[i] * w[i];
    wn = Math.sqrt(wn) || 1;
    const wHat = new Float32Array(d);
    for (let i = 0; i < d; i++) wHat[i] = w[i] / wn;

    return {
      kind: "logistic",
      dim: d,
      count: n,
      countA: nA,
      countB: nB,
      mu, w, b, wHat,
      /** Centre + normalise a raw feature vector the way training did. */
      prepare(x) {
        const c = new Float32Array(d);
        for (let i = 0; i < d; i++) c[i] = x[i] - mu[i];
        return l2norm(c);
      },
      predict(x) {
        const u = this.prepare(x);
        let z = b;
        for (let i = 0; i < d; i++) z += w[i] * u[i];
        const p = sigmoid(z);
        return { p, label: p >= 0.5 ? 1 : 0, logit: z, u };
      }
    };
  }

  function constantModel(label, dim) {
    return {
      kind: "constant",
      dim: dim || 0,
      count: 0,
      constantLabel: label,
      mu: null, w: null, b: 0, wHat: null,
      prepare(x) { return l2norm(x); },
      predict() {
        if (label === null || label === undefined) return { p: 0.5, label: 0, logit: 0 };
        return { p: label ? 0.98 : 0.02, label, logit: label ? 3.9 : -3.9 };
      }
    };
  }

  /* ------------------------------------------------------------------ */
  /* 2-D nearest neighbour (Accessible Data Lab)                          */
  /* ------------------------------------------------------------------ */

  /**
   * @param {Array<{x:number,y:number,c:number}>} points   c is 0 or 1
   * @param {{x:{min,max}, y:{min,max}}} ranges
   * @param {number} [k=3]
   */
  function trainKNN(points, ranges, k) {
    k = k || 3;
    const nz = p => [
      (p.x - ranges.x.min) / (ranges.x.max - ranges.x.min || 1),
      (p.y - ranges.y.min) / (ranges.y.max - ranges.y.min || 1)
    ];
    const P = points.map(p => ({ u: nz(p), c: p.c ? 1 : 0 }));
    // Typical spacing: median distance from each example to its nearest other example.
    const nn = P.map((a, i) => {
      let best = Infinity;
      for (let j = 0; j < P.length; j++) if (j !== i) {
        const d = Math.hypot(a.u[0] - P[j].u[0], a.u[1] - P[j].u[1]);
        if (d < best) best = d;
      }
      return best;
    }).filter(Number.isFinite).sort((a, b) => a - b);
    const typical = nn.length ? Math.max(0.02, nn[Math.floor(nn.length / 2)]) : 0.1;
    const counts = [P.filter(p => p.c === 0).length, P.filter(p => p.c === 1).length];

    return {
      kind: "knn",
      k,
      count: P.length,
      counts,
      typical,
      predict(x, y) {
        if (!P.length) return { label: 0, conf: 0.5, evidence: "none", ratio: Infinity, neighbours: [] };
        const q = nz({ x, y });
        const ds = P.map((p, i) => ({ d: Math.hypot(q[0] - p.u[0], q[1] - p.u[1]), c: p.c, i }));
        ds.sort((a, b) => a.d - b.d);
        const top = ds.slice(0, Math.min(k, ds.length));
        const votes = [0, 0];
        for (const t of top) votes[t.c] += 1 / (t.d + 0.02);
        const total = votes[0] + votes[1];
        const label = votes[1] > votes[0] ? 1 : 0;
        const conf = total ? votes[label] / total : 0.5;
        const ratio = top[0].d / typical;
        const evidence = ratio > 3 ? "weak" : "strong";
        return { label, conf, evidence, ratio, neighbours: top.map(t => t.i) };
      }
    };
  }

  /* ------------------------------------------------------------------ */
  /* Handcrafted image features (fallback only)                          */
  /* ------------------------------------------------------------------ */

  /**
   * Build a ~236-dimension feature vector from a square RGBA ImageData.
   * Grey thumbnail + colour histogram + edge-orientation histogram.
   * Crude, but enough to tell two piles of cards apart when MobileNet is unavailable.
   */
  function handcraftedFeatures(imageData) {
    const { width: W, height: H, data } = imageData;
    const gray = new Float32Array(W * H);
    const hueHist = new Float32Array(12), satHist = new Float32Array(4), valHist = new Float32Array(4);
    for (let i = 0, p = 0; i < W * H; i++, p += 4) {
      const r = data[p] / 255, g = data[p + 1] / 255, b = data[p + 2] / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), v = mx, s = mx ? (mx - mn) / mx : 0;
      gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
      let h = 0;
      if (mx !== mn) {
        if (mx === r) h = ((g - b) / (mx - mn)) % 6;
        else if (mx === g) h = (b - r) / (mx - mn) + 2;
        else h = (r - g) / (mx - mn) + 4;
        h = (h * 60 + 360) % 360;
      }
      hueHist[Math.min(11, Math.floor(h / 30))] += s;
      satHist[Math.min(3, Math.floor(s * 4))] += 1;
      valHist[Math.min(3, Math.floor(v * 4))] += 1;
    }
    // 12x12 grey thumbnail (box filter)
    const T = 12, thumb = new Float32Array(T * T);
    const cw = W / T, ch = H / T;
    for (let ty = 0; ty < T; ty++) for (let tx = 0; tx < T; tx++) {
      let s = 0, c = 0;
      for (let y = Math.floor(ty * ch); y < Math.floor((ty + 1) * ch); y++)
        for (let x = Math.floor(tx * cw); x < Math.floor((tx + 1) * cw); x++) { s += gray[y * W + x]; c++; }
      thumb[ty * T + tx] = c ? s / c : 0;
    }
    // Edge orientation histogram, 8 bins x 3x3 cells, on the grey image.
    const G = 3, bins = 8, eo = new Float32Array(G * G * bins);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const gx = gray[y * W + x + 1] - gray[y * W + x - 1];
      const gy = gray[(y + 1) * W + x] - gray[(y - 1) * W + x];
      const mag = Math.hypot(gx, gy);
      if (mag < 0.04) continue;
      const ang = (Math.atan2(gy, gx) + Math.PI) / (2 * Math.PI); // 0..1
      const bin = Math.min(bins - 1, Math.floor(ang * bins));
      const cell = Math.min(G - 1, Math.floor(y / H * G)) * G + Math.min(G - 1, Math.floor(x / W * G));
      eo[cell * bins + bin] += mag;
    }
    const blocks = [l2norm(thumb), l2norm(hueHist), l2norm(satHist), l2norm(valHist), l2norm(eo)];
    const weights = [1.0, 1.2, 0.5, 0.5, 1.0];
    const total = blocks.reduce((s, b) => s + b.length, 0);
    const out = new Float32Array(total);
    let o = 0;
    blocks.forEach((b, i) => { for (let j = 0; j < b.length; j++) out[o++] = b[j] * weights[i]; });
    return out;
  }

  window.FF.Logistic = { train: trainLogistic };
  window.FF.KNN2D = { train: trainKNN };
  window.FF.features = { handcrafted: handcraftedFeatures, l2norm };
})();
