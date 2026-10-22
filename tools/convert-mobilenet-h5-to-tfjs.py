#!/usr/bin/env python3
"""
Convert the Keras MobileNetV2 (alpha 0.35, 224) ImageNet weights into the
single JavaScript model file Future Forge ships at models/mobilenet-v2-035/model.js.

Why a .js file and not model.json + shards: the app must also run from a
double-clicked index.html (file://), where browsers refuse to fetch() model
files. A script tag loads anywhere. The file defines window.FF_MODEL =
{modelTopology, weightSpecs, weightsBase64, ...}; js/vision.js hands it to
tf.io.fromMemory(). It is the standard TensorFlow.js layers-model format,
just inlined.

Source weights (Apache 2.0, the same files keras-applications downloads):
  https://github.com/JonathanCMitchell/mobilenet_v2_keras/releases/download/v1.1/
    mobilenet_v2_weights_tf_dim_ordering_tf_kernels_0.35_224.h5

Usage:
  python3 convert-mobilenet-h5-to-tfjs.py IN.h5 OUT.js [--top] [--float]

  --top     keep the 1000-class ImageNet head (for validation only; the app
            ships the headless, global-average-pooled feature extractor)
  --uint8   8-bit quantised weights (smallest; embeddings drift ~7 % from float)
  --float   float32 weights (largest). Default is 16-bit quantised: half the
            size of float with no measurable change in the features.

Requires only h5py and numpy. No TensorFlow needed.
"""
import base64, json, sys
import h5py, numpy as np

def make_layers(names, with_top):
    """Rebuild the MobileNetV2 (old Keras 2.1.x layout, 'same' padding) topology
    from the ordered layer list stored in the h5 file."""
    stride2_blocks = {1, 3, 6, 13}
    layers, current, block_input = [], None, None
    def add(name, cls, cfg, inbound):
        cfg = dict(cfg); cfg["name"] = name; cfg.setdefault("trainable", True)
        layers.append({"name": name, "class_name": cls, "config": cfg,
                       "inbound_nodes": [[[i, 0, 0, {}] for i in inbound]] if inbound else []})
    init_g = {"class_name": "GlorotUniform", "config": {"seed": None}}
    init_z = {"class_name": "Zeros", "config": {}}
    init_o = {"class_name": "Ones", "config": {}}
    conv_common = {"data_format": "channels_last", "dilation_rate": [1, 1], "activation": "linear",
                   "use_bias": False, "kernel_initializer": init_g, "bias_initializer": init_z,
                   "kernel_regularizer": None, "bias_regularizer": None, "activity_regularizer": None,
                   "kernel_constraint": None, "bias_constraint": None}
    bn_common = {"axis": 3, "momentum": 0.999, "epsilon": 0.001, "center": True, "scale": True,
                 "beta_initializer": init_z, "gamma_initializer": init_o,
                 "moving_mean_initializer": init_z, "moving_variance_initializer": init_o,
                 "beta_regularizer": None, "gamma_regularizer": None, "beta_constraint": None, "gamma_constraint": None}
    for n, shape in names:
        if n == "input_1":
            add(n, "InputLayer", {"batch_input_shape": [None, 224, 224, 3], "dtype": "float32", "sparse": False}, [])
            current = n
        elif n == "Conv1":
            add(n, "Conv2D", dict(conv_common, filters=shape[3], kernel_size=[3, 3], strides=[2, 2], padding="same"), [current]); current = n
        elif n.startswith("bn") or n == "Conv_1_bn":
            add(n, "BatchNormalization", bn_common, [current]); current = n
        elif n.endswith("_relu"):
            add(n, "ReLU", {"max_value": 6.0, "negative_slope": 0.0, "threshold": 0.0}, [current]); current = n
        elif "_expand" in n:
            block_input = current
            add(n, "Conv2D", dict(conv_common, filters=shape[3], kernel_size=[1, 1], strides=[1, 1], padding="same"), [current]); current = n
        elif "_depthwise" in n:
            blk = int(n.split("_")[0][4:])
            if blk == 0: block_input = current
            s = 2 if blk in stride2_blocks else 1
            cfg = {"kernel_size": [3, 3], "strides": [s, s], "padding": "same", "data_format": "channels_last",
                   "dilation_rate": [1, 1], "depth_multiplier": 1, "activation": "linear", "use_bias": False,
                   "depthwise_initializer": init_g, "bias_initializer": init_z, "depthwise_regularizer": None,
                   "bias_regularizer": None, "activity_regularizer": None, "depthwise_constraint": None, "bias_constraint": None}
            add(n, "DepthwiseConv2D", cfg, [current]); current = n
        elif "_project" in n:
            add(n, "Conv2D", dict(conv_common, filters=shape[3], kernel_size=[1, 1], strides=[1, 1], padding="same"), [current]); current = n
        elif n.startswith("res_connect"):
            add(n, "Add", {}, [block_input, current]); current = n
        elif n == "Conv_1":
            add(n, "Conv2D", dict(conv_common, filters=shape[3], kernel_size=[1, 1], strides=[1, 1], padding="same"), [current]); current = n
        elif n == "average_pooling2d_1":
            add("global_average_pooling2d", "GlobalAveragePooling2D", {"data_format": "channels_last"}, [current]); current = "global_average_pooling2d"
        elif n == "flatten_1":
            pass
        elif n == "Logits":
            if with_top:
                add(n, "Dense", {"units": shape[1], "activation": "softmax", "use_bias": True, "kernel_initializer": init_g,
                                 "bias_initializer": init_z, "kernel_regularizer": None, "bias_regularizer": None,
                                 "activity_regularizer": None, "kernel_constraint": None, "bias_constraint": None}, [current]); current = n
        else:
            raise SystemExit("Unknown layer in h5: " + n)
    return layers, current

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    with_top = "--top" in sys.argv
    quant = None if "--float" in sys.argv else ("uint8" if "--uint8" in sys.argv else "uint16")
    src, out = args[0], args[1]
    f = h5py.File(src, "r")
    names = []
    for n in f.attrs["layer_names"]:
        n = n.decode() if isinstance(n, bytes) else n
        wn = [w.decode() if isinstance(w, bytes) else w for w in f[n].attrs.get("weight_names", [])]
        names.append((n, tuple(f[n][wn[0]].shape) if wn else None))
    layers, output = make_layers(names, with_top)
    topology = {"class_name": "Model", "keras_version": "2.2.4", "backend": "tensorflow",
                "config": {"name": "mobilenetv2_0.35_224" + ("" if with_top else "_features"), "layers": layers,
                           "input_layers": [["input_1", 0, 0]], "output_layers": [[output, 0, 0]]}}
    specs, blobs = [], []
    for n, _ in names:
        if n == "Logits" and not with_top: continue
        for w in f[n].attrs.get("weight_names", []):
            w = w.decode() if isinstance(w, bytes) else w
            arr = np.array(f[n][w], dtype=np.float32)
            wname = n + "/" + w.split("/")[-1].replace(":0", "")
            spec = {"name": wname, "shape": list(arr.shape), "dtype": "float32"}
            if quant:
                levels = 255.0 if quant == "uint8" else 65535.0
                mn, mx = float(arr.min()), float(arr.max())
                scale = (mx - mn) / levels if mx > mn else 1.0
                q = np.round((arr - mn) / scale).clip(0, levels).astype(np.uint8 if quant == "uint8" else np.uint16)
                spec["quantization"] = {"dtype": quant, "min": mn, "scale": scale}
                blobs.append(q.tobytes())
            else:
                blobs.append(arr.tobytes())
            specs.append(spec)
    data = b"".join(blobs)
    b64 = base64.b64encode(data).decode("ascii")
    js = ("/* Future Forge — local image-feature model. Generated by tools/convert-mobilenet-h5-to-tfjs.py.\n"
          " * MobileNetV2, width 0.35, 224x224, ImageNet weights (Apache 2.0), " +
          ("with ImageNet head" if with_top else "headless: output is the 1280-value global-average-pooled feature vector") + ".\n"
          " * Weights are " + ({"uint8": "8-bit quantised", "uint16": "16-bit quantised"}.get(quant, "float32")) + ". Loaded by js/vision.js via tf.io.fromMemory(). Not fetched, so it works from file://.\n */\n")
    js += "window.FF_MODEL = " + json.dumps({
        "name": "MobileNet v2 (0.35, local)", "inputSize": 224, "preprocess": "x/127.5-1", "outputDim": 1000 if with_top else 1280,
        "modelTopology": topology, "weightSpecs": specs, "weightsBase64": b64}, separators=(",", ":")) + ";\n"
    open(out, "w").write(js)
    print("layers:", len(layers), "weights:", len(specs), "weight bytes:", len(data), "file bytes:", len(js))

if __name__ == "__main__":
    main()
