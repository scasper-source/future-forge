# vendor/

`tf.min.js` — TensorFlow.js 4.22.0, custom bundle (core + chained ops + layers + WebGL and CPU backends; converter and data packages left out). Apache 2.0, see LICENSE-tensorflowjs.txt.

Rebuild (only if upgrading TensorFlow.js):

```
npm install @tensorflow/tfjs@4.22.0 esbuild
npx esbuild tools/tfjs-entry.js --bundle --minify --format=iife --global-name=tf --target=es2017 --legal-comments=none --outfile=vendor/tf.min.js
```
