// Minimal TensorFlow.js bundle for Future Forge: core (+ chained ops) + layers + WebGL + CPU backends.
// Rebuild: npx esbuild entry.js --bundle --minify --format=iife --global-name=tf --target=es2017 --legal-comments=none --outfile=tf.min.js
export * from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-core/dist/public/chained_ops/register_all_chained_ops';
import '@tensorflow/tfjs-core/dist/register_all_gradients';
export * from '@tensorflow/tfjs-layers';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';
export const FF_TFJS_BUNDLE = 'tfjs-core+layers+webgl+cpu 4.22.0';
