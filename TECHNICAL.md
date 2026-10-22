# Future Forge — technical notes (Layer 3)

For whoever maintains this next. Build v1.2.0, September 2026, for the October 24 Open House pilot. (v1.0.0 is kept as the stable fallback; see "Versions" at the end.)

## What it is

A static web app: no build step, no server-side code, no accounts, no external services. Plain HTML/CSS/JS in classic `<script>` tags (not ES modules) so the whole thing also runs from a double-clicked `index.html`. Every file it needs is in this folder; after one load it runs with no network.

```
index.html                 all screens, as <section class="screen"> blocks toggled with the hidden attribute
styles.css                 one responsive layout (360 px phone → 43-inch display); type scales with clamp()
app.js                     session state, routing, the shared meter, training moment, closing, reset, staff panel
config.js                  the only file an operator edits (endpoint flag, tally on/off, idle reset, hints, offline cache)
sw.js, manifest.webmanifest  offline cache + installable PWA (only active when served over http/https)
js/classifier.js           logistic head (vision), 2-D nearest-neighbour (data), handcrafted fallback features
js/vision.js               camera, frame grab, MobileNet embedding (lazy-loads vendor/tf.min.js + the model)
js/map.js                  the map: the model's interior drawn truthfully (see "The map" below)
js/lab-vision.js           Live Vision Lab, free "two piles" mode
js/lab-series.js           ordered-series deck mode: two-sorter and one-sorter flows, the reveal chart
js/lab-data.js             Accessible Data Lab: sensor scatter, KNN, table equivalents
js/challenge.js            deterministic challenge-card generator; optional endpoint behind a flag
js/counter.js              anonymous per-day tally (localStorage, counts only)
content/domains.js         the six futures: names, sensor scenarios, starter readings, challenge templates
content/lessons.js         every line of teaching copy (spec copy verbatim)
content/challenge-cards.js the challenge card's fixed text and per-lesson extra questions
content/series.js          the card decks: id, count, two end labels. Add a deck = add an object here.
assets/fonts/              Space Grotesk + Inter (OFL), embedded as data URIs in fonts.css so they load from file://
models/mobilenet-v2-035/model.js   MobileNetV2 (α 0.35, 224) feature extractor, ImageNet weights, inlined
vendor/tf.min.js           TensorFlow.js 4.22 custom bundle (core + layers + WebGL/CPU backends), 0.95 MB
tools/                     model converter, tfjs bundle entry, the no-dependency PowerShell server
```

Content files are `.js` rather than `.json` deliberately: browsers refuse `fetch()` of local files under `file://`, and the pilot must work by double-click. Each file just assigns to `window.FF_CONTENT`. Edit the data inside; nothing in `app.js` knows the domain names, deck names or sensor labels.

## The five decisions from the build brief

1. **Vision stack.** MobileNetV2 width 0.35 at 224×224, ImageNet weights, headless with global average pooling → a 1280-value embedding per frame. Shipped locally, no CDN at runtime, precached by the service worker when hosted. Weights are 16-bit quantised (cosine similarity to float32 embeddings = 1.0000 on test photos; 8-bit drifted to 0.93 so was rejected). **First load: tf.min.js 0.95 MB + model 1.2 MB + app ≈ 0.16 MB ≈ 2.3 MB**, loaded lazily in the background after Start so the Data Lab never pays for it. If TensorFlow.js or the model fails to load (old browser, corrupted file, WebGL context lost), `FF.vision` falls back automatically to handcrafted features (grey thumbnail + colour histogram + edge-orientation histogram, ~236 dims) and the experience continues; the staff panel shows which engine is running.
2. **Classifier head.** Binary logistic regression on mean-centred, L2-normalised embeddings, 220 gradient-descent steps, class-balanced, light L2, then a single scale factor so the median training margin is ≈ 93 % (keeps confidence readable across feature types). Trains in tens of milliseconds; "Retrain" is instant. Chosen over KNN because it gives a smooth confidence curve across an ordered series — the signature chart needs that — and because one added hard example moves the boundary. The Data Lab uses distance-weighted 3-nearest-neighbour instead, with a separate evidence flag (nearest example farther than 3× the typical spacing = "weak evidence"): local reasoning is what a 2-D scatter teaches, and one added reading fixes its neighbourhood immediately.
3. **Ordered series.** `content/series.js` declares a deck as `{id, count, ends:[…,…]}`. The app asks for cards by number (shuffled per sorter so nobody sees the gradient in order), captures a 3-frame burst per call, trains on sorter A's calls, and records predictions during sorter B's pass, which doubles as the held-out test. Swap retrains on B and tests on A's captures. One sorter: sort, then a 1→N judging pass. **Add a deck without touching app.js: add one object to `content/series.js`.** Redrawing the printed cards changes nothing as long as the count and the two end names hold. The free "two piles of anything" mode never reads that file.
4. **Big-screen legibility.** One layout. Type, the meter and the card number scale with `clamp()`; lab headings shrink so the camera/chart, the meter and the controls stay above the fold on a 1080p display. The meter reads as a single line ("NORMAL 100 %") at about 88 px on a 1920-wide display. The series chart is an SVG with a `viewBox` that switches to a narrower frame under 620 px; it has an `aria-label` narrative and a full table equivalent. Charts are capped at ~60 % of viewport height.
5. **The counter.** Kept. `localStorage["ff.tally.v1"]` holds `{day, total, byDomain, events}` — coarse counts only, no identifier, no per-visit record, self-expiring at midnight. Reset destroys the session and leaves the tally; the staff panel clears it; `counter: false` in `config.js` removes it entirely. If any persistence at all is judged unacceptable, flip that flag and nothing else changes.

## The map (v1.1)

`js/map.js` draws the vision model's interior on a canvas that travels with the visitor from Teach through Improve. Every shot is a 1280-value MobileNet feature vector; the map places one point per shot in two real dimensions:

- **Before training:** the two principal directions of variation among the shots (dual PCA on the n×n Gram matrix — n is tens, d is 1280, so this is microseconds). The visitor watches each shot land where the network puts it; similar pictures sit together.
- **After training:** x is the model's own logit (the learned line is therefore exactly the vertical centre line — a point's side of the line *is* its prediction), y is the largest remaining direction of variation after removing the decision direction ("differences it noticed but doesn't use"). On Train, points glide from the first system to the second over 1.4 s and the line draws itself: the moment the model finds the direction that separates the piles, shown rather than described.
- **Live:** the current camera frame is a white point with a short trail, projected the same way. Pushing it across the line is the break.
- **Failure:** the declared frame is ringed; `map.evidence()` compares its nearest-neighbour distance (cosine, on raw normalised features) with the median nearest-neighbour spacing of the examples; a ratio above 1.8 surfaces the line "The closest thing it had ever seen was unusually far from this."
- **Improve:** the added shot enters ringed white; on retrain the failure point's old position is kept as a dashed ghost with a line to its new position, and the caption says which side it now falls on.

Nothing on the map is decorative; every element is a rendering of model state. Reduced motion removes glides, trail and pulse. The canvas carries an `aria-label` narrative; the meter text remains the accessible truth for the live prediction.

Other v1.1 moments, all in CSS or a few lines of JS: the Data Lab's decision regions fade in outward from the readings (delay ∝ distance to the nearest example); the series reveal draws its line, pops the dots in order, then surfaces the disagreement band; screens cross-fade; the hook is a procedural attract field that periodically sorts itself; the closing screen carries a "Your session" record built from state, over the visitor's own map/scatter as a faint backdrop; the finish shows the day's tally as a phyllotaxis field (one seed per completed session, coloured by future). Every animated moment has a static twin under `prefers-reduced-motion`.

## Session model

```
state = { seed, startedAt, domain, mode ("vision" | "data" | "series"), kit,
          vision: { classes, examples[{features, label, shot, thumb}], model, snapshot, failurePrediction },
          data:   { points[{x, y, c, phase}], model, test, failurePoint, failureEvidence },
          series: { deck, sorters, order, labels{A,B}, captures{A,B,T}, model, trainedOn, preds },
          testsAttempted, failureFound, failureSkipped, reason[], improvementMade, improvedBetter, idea, card, completed }
```

Created on Start, replaced on replay, destroyed on Reset (`FF.app.reset()` stops the camera, drops every thumbnail and snapshot from the DOM, returns to the hook). Camera frames live only in a 224×224 working canvas that is overwritten every capture; a thumbnail is a 64-px canvas held in memory for the strip. Nothing is written to disk, nothing is uploaded. There is no analytics beacon of any kind.

The optional challenge endpoint (`config.js → challengeEndpoint`) is off. When on, `js/challenge.js` POSTs exactly `{domain, idea, lesson}` with a 4 s timeout and uses the local card on any failure; the idea text is stripped of email-, URL- and phone-shaped fragments first. Lesson codes are listed at the top of `content/challenge-cards.js`.

## Prohibited by design

No face detection, no biometrics, no demographic inference, no names, no email, no identifiers, no persistent device ID, no retained images, no third-party scripts, no fonts from the network. The service worker only ever caches same-origin GETs, so an enabled endpoint is never cached.

## Accessibility notes

Every action is a `<button>` or a native input. Focus moves to the new screen's `h1` on each transition; screen readers get a polite live region for events and a throttled one for the live meter (a new announcement only when the reading changes bucket, at most every 2.5 s). Charts carry an `aria-label` narrative and a "Show as table" equivalent. Colour is never alone: pile A is always ● and pile B is ■, on buttons, markers and the meter. `prefers-reduced-motion` disables the attract cycle, the capture flash, the rising closing lines and shortens the training moment. Nothing is timed except the optional idle guard, which warns for a full minute first. Designed toward WCAG 2.2 AA; not certified — see the human list in the build report.

## Testing

`tools/tests/` contains the Playwright scripts used for this build (headless Chromium with a fake camera and synthetic frames injected through `FF.vision.grabFrame`). They cover: both labs end to end, two-sorter and one-sorter series, sorters who agree/disagree on everything, a sorter who uses one label, skipped cards, keyboard-only, 360 px width, ten consecutive resets, nonsense input, offline after load with the endpoint enabled and unreachable, `file://` loading, the idle guard, and no camera. Run with `node tools/tests/edge.js` after `npm i playwright` and starting any static server on port 8822.

## Rebuilding vendored pieces (only if upgrading)

- TensorFlow.js: `vendor/README.md`.
- Model: `python3 tools/convert-mobilenet-h5-to-tfjs.py mobilenet_v2_weights_tf_dim_ordering_tf_kernels_0.35_224.h5 models/mobilenet-v2-035/model.js` (needs only `h5py` and `numpy`; the weight file is the keras-applications release on GitHub, Apache 2.0).
- Service worker: bump `CACHE` in `sw.js` whenever a file changes, or hosted visitors keep the old version.

## Versions

- `Future Forge 1.2` (this folder) — v1.2.0, current. Same substance as v1.1; adds the `offlineCache` switch, the embedded-camera notice, an explicit dark colour scheme, the Edge launcher and the version label in the footer (from `config.js → version`), so a copy identifies itself on screen.
- `Future Forge v1 (stable)` — v1.0.0, the pre-map build. Same flows, tests and copy; plain meter instead of the map. Open its `index.html` to roll back.

## Hosting a preview, and embedding

Any static host works (the folder is the deployment). Two things matter when the build is still changing: set `offlineCache: false` in `config.js` on a preview host so reviewers never get a stale cached copy (the app also unregisters any cache an earlier visit left), and bump `CACHE` in `sw.js` on the real host when files change. If the page is embedded in another page (an iframe) whose permissions policy withholds the camera — most hosted previews do this — the Vision Lab reports it plainly ("shown inside another page that doesn't allow camera use") and offers the Data Lab; nothing else changes. Give the iframe `allow="camera"` if you control the embedding page.

The September 2026 review copy is published as a private claude.ai artifact from the Future Forge Claude project; it is this folder with `offlineCache: false` and a "shared preview" version label. Its camera is withheld by the viewer, so the Vision Lab there ends at the notice above.

## Known limits

- The PowerShell server in `tools/serve.ps1` was written for this build but not executed on a real Windows machine here; the launcher tests it and falls back to opening `index.html` directly if it doesn't answer.
- Camera on `file://` works in Chrome and Edge; Safari and Firefox may prompt every launch or refuse. Hosting on https or running the launcher (localhost) avoids that.
- iOS Safari needs the camera started by a tap (it is) and may pause the video when the tab is backgrounded; the loop resumes when visible.
