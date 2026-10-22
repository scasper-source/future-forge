# Automated checks

Headless-Chromium walkthroughs of the visitor paths, used to test this build.

```
npm install playwright            # once; downloads its own Chromium, or set CHROME=/path/to/chrome
python3 -m http.server 8822       # from the Future Forge folder, in another terminal
node tools/tests/smoke.js         # Data Lab, start to reset
node tools/tests/vision.js        # Vision Lab with a fake camera and synthetic frames
node tools/tests/series.js        # two-sorter deck flow, swap, add a decision
node tools/tests/edge.js          # edge cases: agree/disagree on all, one label, skips, keyboard-only, 360 px, resets, offline, file://, idle guard, no camera
```

The camera is Chromium's fake device (`--use-fake-device-for-media-stream`); card and pile images are drawn on a canvas and injected through `FF.vision.grabFrame`, so the classifier runs on real MobileNet embeddings of synthetic pictures.
