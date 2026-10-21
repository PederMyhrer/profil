/* leinhardt.no: one painted scene, brought to life with a single WebGL pass.
   Depth parallax, water, flickering light, warm flood for the door transition.
   Particles (smoke, fireflies, dust) live on a 2D canvas on top. */
(function () {
  "use strict";
  const scene = document.getElementById("scene");
  const gl2 = document.getElementById("world");
  const fx = document.getElementById("fx");
  const spotsEl = document.getElementById("hotspots");
  const plaque = document.querySelector(".plaque");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const IMG_W = 1680, IMG_H = 944;
  const ASSET = "assets/";

  /* ---------- WebGL ---------- */
  const gl = gl2.getContext("webgl2", { antialias: false, alpha: false, premultipliedAlpha: false });
  if (!gl) { scene.classList.add("nogl"); return; }
  const VS = `#version 300 es
  const vec2 P[3]=vec2[3](vec2(-1,-1),vec2(3,-1),vec2(-1,3));
  void main(){gl_Position=vec4(P[gl_VertexID],0,1);}`;
  const FS = `#version 300 es
  precision highp float;
  uniform sampler2D uImg,uDepth,uLight,uWater;
  uniform vec2 uRes,uOff,uDisp,uCenter,uMouse,uFire;
  uniform float uZoom,uTime,uFlick,uFireR,uParallax,uFlood,uFade,uAlpha,uNight,uHasWater;
  out vec4 o;
  float vign(vec2 p){p=p*2.-1.;return 1.-dot(p,p)*0.12;}
  void main(){
    vec2 px=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);
    vec2 uv0=(px-uOff)/uDisp;
    vec2 uv=uCenter+(uv0-uCenter)/uZoom;
    float d=texture(uDepth,uv).r;
    uv+=(d-0.45)*uParallax*uMouse;
    uv=clamp(uv,vec2(0.002),vec2(0.998));
    vec3 col=texture(uImg,uv).rgb;
    if(uHasWater>0.5){
      float w=texture(uWater,uv).r;
      if(w>0.01){
        vec2 r=uv+vec2(sin(uv.y*160.+uTime*1.4)*0.0022+sin(uv.y*37.-uTime*0.6)*0.0015, sin(uv.x*90.-uTime*0.9)*0.0012)*w;
        vec3 wc=texture(uImg,clamp(r,0.,1.)).rgb;
        col=mix(col,wc,w);
        float s=pow(max(0.,sin(uv.x*120.+uTime*1.5+sin(uv.y*70.+uTime*.6)*3.)),10.)*w;
        s*=0.6+0.4*sin(uv.y*260.-uTime*1.8);
        col+=vec3(0.30,0.42,0.6)*s*0.16;
      }
    }
    float l=texture(uLight,uv).r;
    float fireN=1.-smoothstep(0.,uFireR,distance(uv*vec2(1.,0.56),uFire*vec2(1.,0.56)));
    float amp=0.05+0.30*fireN;
    col+=vec3(1.0,0.62,0.28)*l*amp*(uFlick-0.5)*2.0;
    col+=vec3(1.0,0.55,0.2)*l*0.04;
    if(uNight>0.0){
      float g=dot(col,vec3(0.3,0.59,0.11));
      vec3 nv=vec3(g*0.25,g*1.25+0.04,g*0.35);
      nv+=0.03*sin(px.y*1.7+uTime*30.);
      col=mix(col,nv,uNight);
    }
    col*=vign(uv0);
    col=mix(col,vec3(1.0,0.74,0.38),uFlood);
    col*=(1.-uFade);
    o=vec4(col,uAlpha);
  }`;
  function compile(t, s) { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; }
  const prog = gl.createProgram(); gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const U = {}; ["uImg","uDepth","uLight","uWater","uRes","uOff","uDisp","uCenter","uMouse","uFire","uZoom","uTime","uFlick","uFireR","uParallax","uFlood","uFade","uAlpha","uNight","uHasWater"].forEach(n => U[n] = gl.getUniformLocation(prog, n));
  gl.uniform1i(U.uImg, 0); gl.uniform1i(U.uDepth, 1); gl.uniform1i(U.uLight, 2); gl.uniform1i(U.uWater, 3);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  function tex(img, linear) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function load(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
  const small = matchMedia("(max-width: 700px)").matches && devicePixelRatio < 2.5;
  const scenes = {};
  let cfg = null;
  async function loadScene(n) {
    if (scenes[n]) return scenes[n];
    const p = [load(ASSET + n + (small ? "-m" : "") + ".webp"), load(ASSET + n + "-depth.png"), load(ASSET + n + "-light.png")];
    if (n === "ext") p.push(load(ASSET + "ext-water.png"));
    const [img, dep, lig, wat] = await Promise.all(p);
    scenes[n] = { img: tex(img), depth: tex(dep), light: tex(lig), water: wat ? tex(wat) : null, image: img };
    return scenes[n];
  }

  /* ---------- state ---------- */
  const S = {
    cur: "ext", zoom: 1, center: [0.5, 0.5], flood: 0, fade: 0, night: 0, parallax: reduce ? 0 : 0.035,
    mouse: [0, 0], target: [0, 0], busy: false, alpha: 1, over: null, overAlpha: 0
  };
  let W = 0, H = 0, DPR = 1, OFF = [0, 0], DISP = [1, 1];
  function layout() {
    const cw = scene.clientWidth, ch = scene.clientHeight;
    DPR = Math.min(2, devicePixelRatio || 1);
    W = Math.round(cw * DPR); H = Math.round(ch * DPR);
    gl2.width = W; gl2.height = H; fx.width = W; fx.height = H;
    gl2.style.width = fx.style.width = cw + "px"; gl2.style.height = fx.style.height = ch + "px";
    const s = Math.max(W / IMG_W, H / IMG_H);
    DISP = [IMG_W * s, IMG_H * s]; OFF = [(W - DISP[0]) / 2, (H - DISP[1]) / 2];
    gl.viewport(0, 0, W, H);
    placeSpots();
  }
  /* uv -> css px, honouring zoom */
  function toScreen(u, v) {
    const C = S.center, Z = S.zoom;
    const x = C[0] + (u - C[0]) * Z, y = C[1] + (v - C[1]) * Z;
    return [(OFF[0] + x * DISP[0]) / DPR, (OFF[1] + y * DISP[1]) / DPR];
  }
  function scale() { return DISP[0] / DPR * S.zoom; }

  /* ---------- hotspots ---------- */
  const buttons = [];
  function buildSpots() {
    spotsEl.replaceChildren(); buttons.length = 0;
    const list = cfg[S.cur].spots;
    list.forEach(sp => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "spot"; b.dataset.id = sp.id;
      b.setAttribute("aria-label", sp.name + ": " + sp.what);
      b.innerHTML = '<span class="dot"></span><span class="tag">' + sp.name + "<small>" + sp.what + "</small></span>";
      b.addEventListener("click", () => sp.action === "enter" ? enter() : (sp.id === "kontakt" && S.cur === "int" ? openPanel("kontakt") : openPanel(sp.id)));
      if (sp.action === "enter") b.addEventListener("pointerenter", prefetch, { once: true });
      spotsEl.appendChild(b); buttons.push({ b, sp });
    });
    placeSpots();
  }
  function placeSpots() {
    const sc = scale();
    buttons.forEach(({ b, sp }) => {
      const [x, y] = toScreen(sp.uv[0], sp.uv[1]);
      const w = sp.w * sc, h = sp.h * sc * (IMG_H / IMG_W);
      b.style.left = (x - w / 2) + "px"; b.style.top = (y - h / 2) + "px"; b.style.width = w + "px"; b.style.height = h + "px";
    });
  }

  /* ---------- particles ---------- */
  const fc = fx.getContext("2d");
  let parts = [];
  function spawn(dt, t) {
    const c = cfg[S.cur];
    if (S.cur === "ext") {
      if (Math.random() < dt * 6) parts.push({ k: "smoke", u: c.chimney[0] + (Math.random() - .5) * .004, v: c.chimney[1], a: 0, life: 6 + Math.random() * 3, vx: 0.004 + Math.random() * 0.003, vy: -0.012, s: 2 });
      if (parts.filter(p => p.k === "fly").length < 28 && Math.random() < dt * 4) { const f = c.fireflies; parts.push({ k: "fly", u: f[0] + Math.random() * (f[2] - f[0]), v: f[1] + Math.random() * (f[3] - f[1]), a: 0, life: 6 + Math.random() * 6, ph: Math.random() * 6.28, sp: .4 + Math.random() }); }
      if (Math.random() < dt * 10) parts.push({ k: "ember", u: c.fire[0] + (Math.random() - .5) * .02, v: c.fire[1] - .01, a: 0, life: 1 + Math.random() * 1.2, vx: (Math.random() - .5) * .01, vy: -0.03 - Math.random() * .03 });
    } else if (S.cur === "int") {
      if (parts.filter(p => p.k === "dust").length < 40 && Math.random() < dt * 8) parts.push({ k: "dust", u: c.lamp[0] + (Math.random() - .3) * .16, v: c.lamp[1] + Math.random() * .22, a: 0, life: 8 + Math.random() * 6, ph: Math.random() * 6.28 });
      if (Math.random() < dt * 6) parts.push({ k: "ember", u: c.fire[0] + (Math.random() - .5) * .015, v: c.fire[1] - .02, a: 0, life: .8 + Math.random(), vx: (Math.random() - .5) * .004, vy: -0.015 - Math.random() * .01 });
    }
  }
  function drawParts(dt, t) {
    fc.setTransform(DPR, 0, 0, DPR, 0, 0);
    fc.clearRect(0, 0, W, H);
    if (S.busy && S.flood > 0.2) return;
    spawn(dt, t);
    const sc = scale() / IMG_W;
    parts = parts.filter(p => (p.a += dt) < p.life);
    fc.globalCompositeOperation = "lighter";
    for (const p of parts) {
      const k = p.a / p.life;
      if (p.k === "smoke") {
        p.u += p.vx * dt + Math.sin(p.a * 1.3 + p.life) * 0.0015 * dt; p.v += p.vy * dt * (1 - k * .5);
        const [x, y] = toScreen(p.u, p.v); const r = (6 + k * 70) * sc;
        const g = fc.createRadialGradient(x, y, 0, x, y, r); const al = (1 - k) * 0.11 * Math.min(1, p.a * 0.8);
        g.addColorStop(0, "rgba(190,195,205," + al + ")"); g.addColorStop(1, "rgba(190,195,205,0)");
        fc.fillStyle = g; fc.beginPath(); fc.arc(x, y, r, 0, 7); fc.fill();
      } else if (p.k === "fly") {
        const b = Math.max(0, Math.sin(p.a * p.sp + p.ph)); if (b < .2) continue;
        const [x, y] = toScreen(p.u + Math.sin(p.a * .5 + p.ph) * .01, p.v + Math.cos(p.a * .35 + p.ph) * .006);
        const r = 6 * sc * (0.6 + b); const env = Math.min(1, p.a, p.life - p.a);
        const g = fc.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, "rgba(255,245,170," + (b * .9 * env) + ")"); g.addColorStop(.3, "rgba(230,230,120," + (b * .35 * env) + ")"); g.addColorStop(1, "rgba(230,230,120,0)");
        fc.fillStyle = g; fc.beginPath(); fc.arc(x, y, r, 0, 7); fc.fill();
      } else if (p.k === "ember") {
        p.u += p.vx * dt; p.v += p.vy * dt; const [x, y] = toScreen(p.u + Math.sin(p.a * 9) * .002, p.v);
        fc.fillStyle = "rgba(255," + (170 - k * 120 | 0) + ",40," + (1 - k) * .9 + ")"; fc.fillRect(x, y, 2.2 * sc, 2.2 * sc);
      } else if (p.k === "dust") {
        const [x, y] = toScreen(p.u + Math.sin(p.a * .3 + p.ph) * .01, p.v + p.a * .002);
        const env = Math.min(1, p.a / 2, (p.life - p.a) / 2) * (0.35 + 0.3 * Math.sin(p.a * 2 + p.ph));
        fc.fillStyle = "rgba(255,220,160," + env * .45 + ")"; fc.beginPath(); fc.arc(x, y, 1.6 * sc, 0, 7); fc.fill();
      }
    }
    fc.globalCompositeOperation = "source-over";
    drawBoxes();
  }

  /* ---------- render ---------- */
  let flick = 0.5, flickT = 0.5, last = 0, raf = 0, running = false;
  function render(now) {
    const t = now / 1000, dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    if (Math.random() < dt * 12) flickT = Math.random();
    flick += (flickT - flick) * Math.min(1, dt * 9);
    if (!reduce) {
      const idle = [Math.sin(t * .23) * .35, Math.cos(t * .17) * .25];
      const tx = S.target[0] * .7 + idle[0] * .3, ty = S.target[1] * .7 + idle[1] * .3;
      S.mouse[0] += (tx - S.mouse[0]) * Math.min(1, dt * 2.5); S.mouse[1] += (ty - S.mouse[1]) * Math.min(1, dt * 2.5);
    }
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    const draw = (name, alpha) => {
      const sc = scenes[name]; if (!sc) return;
      const c = cfg[name];
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sc.img);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, sc.depth);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, sc.light);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, sc.water || sc.light);
      gl.uniform2f(U.uRes, W, H); gl.uniform2f(U.uOff, OFF[0], OFF[1]); gl.uniform2f(U.uDisp, DISP[0], DISP[1]);
      gl.uniform2f(U.uCenter, S.center[0], S.center[1]); gl.uniform2f(U.uMouse, S.mouse[0], S.mouse[1]);
      gl.uniform2f(U.uFire, c.fire[0], c.fire[1]); gl.uniform1f(U.uFireR, c.fire[2]);
      gl.uniform1f(U.uZoom, S.zoom); gl.uniform1f(U.uTime, reduce ? 10 : t); gl.uniform1f(U.uFlick, reduce ? 0.5 : flick);
      gl.uniform1f(U.uParallax, S.parallax); gl.uniform1f(U.uFlood, S.flood); gl.uniform1f(U.uFade, S.fade);
      gl.uniform1f(U.uAlpha, alpha); gl.uniform1f(U.uNight, name === "int" ? S.night : 0); gl.uniform1f(U.uHasWater, sc.water ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    draw(S.cur, 1);
    if (S.over && S.overAlpha > 0) draw(S.over, S.overAlpha);
    drawParts(dt, t);
    if (running && !reduce) raf = requestAnimationFrame(render);
  }
  function start() { if (running || reduce) return; running = true; last = performance.now(); raf = requestAnimationFrame(render); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  function once() { requestAnimationFrame(render); }

  /* ---------- transition ---------- */
  function prefetch() { loadScene("door"); loadScene("int"); }
  async function enter() {
    if (S.busy || S.cur === "int") return;
    S.busy = true; scene.classList.add("busy"); spotsEl.hidden = true; plaque.classList.add("away");
    await Promise.all([loadScene("door"), loadScene("int")]);
    const door = cfg.ext.spots.find(s => s.action === "enter").uv;
    if (reduce) {
      S.cur = "int"; S.center = [0.5, 0.5]; S.zoom = 1; finishEnter(); once(); return;
    }
    const tl = gsap.timeline({ onComplete: finishEnter });
    tl.to(S.center, { 0: door[0], 1: door[1] - 0.04, duration: 1.0, ease: "power2.inOut" }, 0)
      .to(S, { zoom: 2.6, duration: 1.0, ease: "power2.in" }, 0)
      .to(S, { flood: 0.35, duration: 0.6, ease: "power1.in" }, 0.5)
      .add(() => { S.cur = "door"; S.zoom = 1.0; S.center = [cfg.door.opening[0], cfg.door.opening[1]]; S.flood = 0.15; }, 1.0)
      .to(S, { zoom: 1.9, duration: 0.9, ease: "power2.in" }, 1.0)
      .to(S, { flood: 1, duration: 0.6, ease: "power2.in" }, 1.3)
      .add(() => { S.cur = "int"; S.zoom = 1.08; S.center = [0.5, 0.5]; }, 1.9)
      .to(S, { flood: 0, zoom: 1, duration: 0.9, ease: "power2.out" }, 1.95);
  }
  function finishEnter() {
    S.busy = false; scene.classList.remove("busy"); scene.classList.add("inside");
    parts = []; buildSpots(); spotsEl.hidden = false;
    document.getElementById("exitBtn").hidden = false; document.getElementById("camBtn").hidden = false;
    document.querySelector(".plaque p.hint").textContent = "Klikk på tingene i rommet. Døra bak deg tar deg ut igjen.";
    plaque.classList.remove("away"); plaque.classList.add("inside");
    pulseSpots();
  }
  function pulseSpots() { buttons.forEach(({ b }, i) => { b.classList.add("pulse"); b.style.animationDelay = (i * 90) + "ms"; setTimeout(() => b.classList.remove("pulse"), 2500); }); }
  function exit() {
    if (S.busy || S.cur !== "int") return;
    S.busy = true; spotsEl.hidden = true; setNight(false);
    const done = () => { S.cur = "ext"; S.zoom = 1; S.center = [0.5, 0.5]; S.fade = 0; S.busy = false; parts = []; scene.classList.remove("inside"); plaque.classList.remove("inside"); buildSpots(); spotsEl.hidden = false; document.getElementById("exitBtn").hidden = true; document.getElementById("camBtn").hidden = true; document.querySelector(".plaque p.hint").textContent = HINT; once(); };
    if (reduce) { done(); return; }
    gsap.to(S, { fade: 1, duration: 0.45, ease: "power1.in", onComplete: done });
  }

  /* ---------- panel ---------- */
  const panel = document.getElementById("panel"), panelBody = document.getElementById("panelBody");
  function openPanel(id) {
    const src = document.querySelector('section[data-id="' + id + '"]'); if (!src) return;
    const copy = src.cloneNode(true); copy.removeAttribute("id");
    const h = copy.querySelector("h3"); if (h) h.id = "panelTitle";
    panelBody.replaceChildren(copy);
    if (id === "kamera") wireDemo(copy);
    if (typeof panel.showModal === "function") panel.showModal(); else location.hash = id;
  }
  document.getElementById("panelClose").addEventListener("click", () => panel.close());
  panel.addEventListener("click", e => { if (e.target === panel) panel.close(); });

  /* ---------- viltkamera: real object detection in the browser ---------- */
  let ortSession = null, ortLoading = null, boxes = [], camOn = false;
  const NAMES = "person,bicycle,car,motorcycle,airplane,bus,train,truck,boat,traffic light,fire hydrant,stop sign,parking meter,bench,bird,cat,dog,horse,sheep,cow,elephant,bear,zebra,giraffe,backpack,umbrella,handbag,tie,suitcase,frisbee,skis,snowboard,sports ball,kite,baseball bat,baseball glove,skateboard,surfboard,tennis racket,bottle,wine glass,cup,fork,knife,spoon,bowl,banana,apple,sandwich,orange,broccoli,carrot,hot dog,pizza,donut,cake,chair,couch,potted plant,bed,dining table,toilet,tv,laptop,mouse,remote,keyboard,cell phone,microwave,oven,toaster,sink,refrigerator,book,clock,vase,scissors,teddy bear,hair drier,toothbrush".split(",");
  const NO = { boat: "båt", chair: "stol", couch: "sofa", laptop: "laptop", book: "bok", cup: "kopp", bench: "benk", "potted plant": "plante", clock: "klokke", bottle: "flaske", person: "person", dog: "hund", cat: "katt", bird: "fugl", bed: "seng", "dining table": "bord", vase: "vase", backpack: "sekk", car: "bil", truck: "lastebil", bicycle: "sykkel", horse: "hest", cow: "ku", sheep: "sau", umbrella: "paraply", tv: "skjerm", oven: "ovn", knife: "kniv", bowl: "bolle" };
  function loadOrt() {
    if (ortLoading) return ortLoading;
    ortLoading = new Promise((res, rej) => {
      const s = document.createElement("script"); s.src = ASSET + "ort/ort.min.js";
      s.onload = async () => {
        try {
          ort.env.wasm.wasmPaths = new URL(ASSET + "ort/", location.href).href; ort.env.wasm.numThreads = 1;
          let buf = null;
          for (const name of ["yolo11n.onnx", "yolo11n.onnx.wasm"]) { try { const r = await fetch(ASSET + "ort/" + name); if (r.ok) { buf = await r.arrayBuffer(); break; } } catch (_) { } }
          if (!buf) throw new Error("model not found");
          ortSession = await ort.InferenceSession.create(new Uint8Array(buf), { executionProviders: ["wasm"] });
          res(ortSession);
        } catch (e) { rej(e); }
      };
      s.onerror = rej; document.head.appendChild(s);
    });
    return ortLoading;
  }
  async function detect(img) {
    const sess = await loadOrt();
    const c = document.createElement("canvas"); c.width = 640; c.height = 640; const x = c.getContext("2d");
    x.fillStyle = "#727272"; x.fillRect(0, 0, 640, 640);
    const r = 640 / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height);
    const nw = Math.round((img.naturalWidth || img.width) * r), nh = Math.round((img.naturalHeight || img.height) * r);
    x.drawImage(img, 0, 0, nw, nh);
    const d = x.getImageData(0, 0, 640, 640).data, f = new Float32Array(3 * 640 * 640);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) { f[p] = d[i] / 255; f[p + 409600] = d[i + 1] / 255; f[p + 819200] = d[i + 2] / 255; }
    const out = (await sess.run({ images: new ort.Tensor("float32", f, [1, 3, 640, 640]) })).output0.data; // 84 x 8400
    const N = 8400, cand = [];
    for (let i = 0; i < N; i++) {
      let best = 0, bc = 0; for (let k = 0; k < 80; k++) { const s = out[(4 + k) * N + i]; if (s > best) { best = s; bc = k; } }
      if (best < 0.35) continue;
      const cx = out[i], cy = out[N + i], w = out[2 * N + i], h = out[3 * N + i];
      cand.push({ x: (cx - w / 2) / r, y: (cy - h / 2) / r, w: w / r, h: h / r, s: best, c: bc });
    }
    cand.sort((a, b) => b.s - a.s);
    const keep = [];
    for (const a of cand) {
      let ok = true;
      for (const b of keep) { const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)), iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)); const inter = ix * iy, uni = a.w * a.h + b.w * b.h - inter; if (inter / uni > 0.45) { ok = false; break; } }
      if (ok) keep.push(a); if (keep.length >= 12) break;
    }
    return keep;
  }
  function drawBoxes() {
    if (!camOn || !boxes.length) return;
    const sc = scale() / IMG_W;
    fc.font = "600 " + Math.max(11, 13 * Math.min(1.4, sc * 1680 / 1200)) + "px 'JetBrains Mono', monospace";
    for (const b of boxes) {
      const [x, y] = toScreen(b.x / IMG_W, b.y / IMG_H); const w = b.w * sc, h = b.h * sc;
      fc.strokeStyle = "#8cff9a"; fc.lineWidth = 1.5; fc.strokeRect(x, y, w, h);
      const label = (NO[NAMES[b.c]] || NAMES[b.c]) + " " + b.s.toFixed(2); const tw = fc.measureText(label).width + 8;
      fc.fillStyle = "#8cff9a"; fc.fillRect(x - 0.75, y - 16, tw, 16); fc.fillStyle = "#07200c"; fc.fillText(label, x + 3, y - 4);
    }
    if (boxes.length) { fc.textAlign = "right"; fc.fillStyle = "#8cff9a"; fc.fillText("CAM 01  REC  " + new Date().toISOString().slice(0, 19).replace("T", " "), W / DPR - 18, 24 + (parseFloat(getComputedStyle(scene).getPropertyValue("--safe-top")) || 0)); fc.textAlign = "left"; }
  }
  async function setNight(on) {
    camOn = on; const btn = document.getElementById("camBtn"); btn.setAttribute("aria-pressed", String(on));
    document.querySelectorAll('[data-action="cam"]').forEach(b => b.textContent = on ? "Slå av viltkameraet" : "Slå på viltkameraet");
    if (reduce) S.night = on ? 1 : 0; else gsap.to(S, { night: on ? 1 : 0, duration: 0.5 });
    if (!on) { boxes = []; once(); return; }
    setStatus("Laster modellen (10 MB) og ser seg rundt i rommet.");
    try { boxes = await detect(scenes.int.image); setStatus(boxes.length ? "Modellen fant " + boxes.length + " ting i rommet. Boksene er ekte treff, ikke tegnet på forhånd." : "Modellen fant ingenting den kjenner igjen her."); }
    catch (e) { setStatus("Kunne ikke kjøre modellen i denne nettleseren."); console.error(e); }
    once();
  }
  function setStatus(t) { document.querySelectorAll(".camStatus").forEach(el => el.textContent = t); }
  document.getElementById("camBtn").addEventListener("click", () => { if (S.cur === "int" && !S.busy) setNight(!camOn); });
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-action]"); if (!b) return;
    if (b.dataset.action === "cam") { if (S.cur !== "int") { panel.close(); enter().then(() => setNight(true)); } else { setNight(!camOn); if (panel.open && innerWidth <= 640) panel.close(); } }
    if (b.dataset.action === "copy") { const v = b.dataset.copy; const done = () => { b.textContent = "Kopiert"; setTimeout(() => b.textContent = "Kopier", 1600); }; try { navigator.clipboard.writeText(v).then(done, () => sel(b)); } catch (_) { sel(b); } }
    if (b.dataset.action === "enter") { panel.close(); enter(); }
  });
  function sel(b) { const a = b.parentElement.querySelector(".addr"); if (!a) return; const r = document.createRange(); r.selectNodeContents(a); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  function wireDemo(root) {
    const inp = root.querySelector("input[type=file]"), outC = root.querySelector("canvas.demoOut"), st = root.querySelector(".camStatus");
    if (!inp) return;
    inp.addEventListener("change", async () => {
      const f = inp.files[0]; if (!f) return;
      const img = await load(URL.createObjectURL(f));
      st.textContent = "Ser på bildet ditt. Ingenting sendes noe sted, alt skjer i nettleseren.";
      try {
        const res = await detect(img); const r = Math.min(1, 640 / img.naturalWidth); outC.width = img.naturalWidth * r; outC.height = img.naturalHeight * r; outC.hidden = false;
        const x = outC.getContext("2d"); x.drawImage(img, 0, 0, outC.width, outC.height); x.lineWidth = 2; x.strokeStyle = "#8cff9a"; x.font = "600 12px 'JetBrains Mono',monospace";
        for (const b of res) { x.strokeRect(b.x * r, b.y * r, b.w * r, b.h * r); const l = (NO[NAMES[b.c]] || NAMES[b.c]) + " " + b.s.toFixed(2); x.fillStyle = "#8cff9a"; x.fillRect(b.x * r, b.y * r - 16, x.measureText(l).width + 8, 16); x.fillStyle = "#07200c"; x.fillText(l, b.x * r + 4, b.y * r - 4); }
        st.textContent = res.length ? "Fant " + res.length + " ting: " + [...new Set(res.map(b => NO[NAMES[b.c]] || NAMES[b.c]))].join(", ") + "." : "Fant ingenting modellen kjenner igjen (den kan 80 vanlige ting fra COCO-settet).";
      } catch (e) { st.textContent = "Kunne ikke kjøre modellen i denne nettleseren."; }
    });
  }

  /* ---------- input ---------- */
  scene.addEventListener("pointermove", e => { if (e.pointerType === "touch") return; const r = scene.getBoundingClientRect(); S.target = [((e.clientX - r.left) / r.width - .5) * 2, ((e.clientY - r.top) / r.height - .5) * 2]; });
  scene.addEventListener("pointerleave", () => S.target = [0, 0]);
  try { addEventListener("deviceorientation", e => { if (e.gamma == null) return; S.target = [Math.max(-1, Math.min(1, e.gamma / 25)), Math.max(-1, Math.min(1, (e.beta - 40) / 25))]; }); } catch (_) { }
  document.getElementById("exitBtn").addEventListener("click", exit);
  addEventListener("keydown", e => { if (e.key === "Escape" && !panel.open && S.cur === "int") exit(); });
  const HINT = document.querySelector(".plaque p.hint").textContent;

  /* ---------- sound ---------- */
  const soundBtn = document.getElementById("soundBtn"); let audio = null;
  soundBtn.addEventListener("click", () => {
    try {
      if (!audio) {
        const AC = window.AudioContext || window.webkitAudioContext; const ac = new AC();
        const len = ac.sampleRate * 6, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0); let l = 0;
        for (let i = 0; i < len; i++) { l = (l + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.2; }
        const fade = ac.sampleRate * .5; for (let i = 0; i < fade; i++) { const k = i / fade; d[i] *= k; d[len - 1 - i] = d[len - 1 - i] * k + d[i] * (1 - k); }
        const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
        const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 650;
        const g = ac.createGain(); g.gain.value = 0; src.connect(lp).connect(g).connect(ac.destination); src.start();
        audio = { ac, g, on: false };
      }
      audio.on = !audio.on; if (audio.ac.state === "suspended") audio.ac.resume();
      audio.g.gain.setTargetAtTime(audio.on ? .35 : 0, audio.ac.currentTime, .4);
      soundBtn.setAttribute("aria-pressed", String(audio.on));
    } catch (_) { soundBtn.disabled = true; }
  });

  /* ---------- boot ---------- */
  (async function boot() {
    cfg = await (await fetch("hotspots.json")).json();
    await loadScene("ext");
    layout(); buildSpots(); scene.classList.add("ready");
    wireDemo(document.getElementById("kamera"));
    once(); start();
    new IntersectionObserver(es => es[0].isIntersecting ? start() : stop()).observe(scene);
    document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
    let rt; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { layout(); once(); }, 80); }).observe(scene);
    setTimeout(prefetch, 4000);
    if (location.hash) { const id = location.hash.slice(1); const el = document.getElementById(id); if (el) setTimeout(() => el.scrollIntoView(), 50); }
  })().catch(e => { console.error(e); scene.classList.add("nogl"); });
})();
