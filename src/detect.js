/* YOLO11n in the browser via ONNX Runtime Web. Loaded on demand. */
const ASSET = "assets/ort/";
const NAMES = "person,bicycle,car,motorcycle,airplane,bus,train,truck,boat,traffic light,fire hydrant,stop sign,parking meter,bench,bird,cat,dog,horse,sheep,cow,elephant,bear,zebra,giraffe,backpack,umbrella,handbag,tie,suitcase,frisbee,skis,snowboard,sports ball,kite,baseball bat,baseball glove,skateboard,surfboard,tennis racket,bottle,wine glass,cup,fork,knife,spoon,bowl,banana,apple,sandwich,orange,broccoli,carrot,hot dog,pizza,donut,cake,chair,couch,potted plant,bed,dining table,toilet,tv,laptop,mouse,remote,keyboard,cell phone,microwave,oven,toaster,sink,refrigerator,book,clock,vase,scissors,teddy bear,hair drier,toothbrush".split(",");
const NO = { boat: "båt", chair: "stol", couch: "sofa", laptop: "laptop", book: "bok", cup: "kopp", bench: "benk", "potted plant": "plante", clock: "klokke", bottle: "flaske", person: "person", dog: "hund", cat: "katt", bird: "fugl", bed: "seng", "dining table": "bord", vase: "vase", backpack: "sekk", car: "bil", truck: "lastebil", bicycle: "sykkel", horse: "hest", cow: "ku", sheep: "sau", umbrella: "paraply", tv: "skjerm", oven: "ovn", knife: "kniv", bowl: "bolle", suitcase: "koffert", "fire hydrant": "hydrant" };
export const label = c => NO[NAMES[c]] || NAMES[c];
let session = null, loading = null;
export function load() {
  if (loading) return loading;
  loading = new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = ASSET + "ort.min.js";
    s.onload = async () => {
      try {
        ort.env.wasm.wasmPaths = new URL(ASSET, location.href).href; ort.env.wasm.numThreads = 1;
        let buf = null;
        for (const n of ["yolo11n.onnx", "yolo11n.onnx.wasm"]) { try { const r = await fetch(ASSET + n); if (r.ok) { buf = await r.arrayBuffer(); break; } } catch (_) { } }
        if (!buf) throw new Error("model not found");
        session = await ort.InferenceSession.create(new Uint8Array(buf), { executionProviders: ["wasm"] }); res(session);
      } catch (e) { rej(e); }
    };
    s.onerror = rej; document.head.appendChild(s);
  });
  return loading;
}
/* img: HTMLImageElement or canvas. Returns boxes in source pixel coordinates. */
export async function detect(img, thr = 0.35) {
  const sess = await load();
  const sw = img.naturalWidth || img.width, sh = img.naturalHeight || img.height;
  const c = document.createElement("canvas"); c.width = 640; c.height = 640; const x = c.getContext("2d");
  x.fillStyle = "#727272"; x.fillRect(0, 0, 640, 640);
  const r = 640 / Math.max(sw, sh); x.drawImage(img, 0, 0, Math.round(sw * r), Math.round(sh * r));
  const d = x.getImageData(0, 0, 640, 640).data, f = new Float32Array(3 * 640 * 640);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) { f[p] = d[i] / 255; f[p + 409600] = d[i + 1] / 255; f[p + 819200] = d[i + 2] / 255; }
  const out = (await sess.run({ images: new ort.Tensor("float32", f, [1, 3, 640, 640]) })).output0.data;
  const N = 8400, cand = [];
  for (let i = 0; i < N; i++) {
    let best = 0, bc = 0; for (let k = 0; k < 80; k++) { const s = out[(4 + k) * N + i]; if (s > best) { best = s; bc = k; } }
    if (best < thr) continue;
    const cx = out[i], cy = out[N + i], w = out[2 * N + i], h = out[3 * N + i];
    cand.push({ x: (cx - w / 2) / r, y: (cy - h / 2) / r, w: w / r, h: h / r, s: best, c: bc });
  }
  cand.sort((a, b) => b.s - a.s);
  const keep = [];
  for (const a of cand) {
    let ok = true;
    for (const b of keep) { const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)), iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)); const inter = ix * iy; if (inter / (a.w * a.h + b.w * b.h - inter) > 0.45) { ok = false; break; } }
    if (ok) keep.push(a); if (keep.length >= 12) break;
  }
  return keep;
}
export function drawBoxes(ctx, boxes, scale = 1) {
  ctx.lineWidth = 2; ctx.strokeStyle = "#8cff9a"; ctx.font = "600 12px 'JetBrains Mono',monospace";
  for (const b of boxes) {
    ctx.strokeRect(b.x * scale, b.y * scale, b.w * scale, b.h * scale);
    const l = label(b.c) + " " + b.s.toFixed(2); const tw = ctx.measureText(l).width + 8;
    ctx.fillStyle = "#8cff9a"; ctx.fillRect(b.x * scale, b.y * scale - 16, tw, 16); ctx.fillStyle = "#07200c"; ctx.fillText(l, b.x * scale + 4, b.y * scale - 4);
  }
}
