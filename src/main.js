import { createWorld } from "./world.js";
import { detect, drawBoxes } from "./detect.js";

const sceneEl = document.getElementById("scene");
const canvas = document.getElementById("world");
const labelEl = document.getElementById("label");
const plaque = document.querySelector(".plaque");
const hint = document.querySelector(".plaque .hint");
const HINT_OUT = hint.textContent, HINT_IN = "Klikk på tingene i rommet. Døra bak deg tar deg ut igjen. Beveg musa for å se deg rundt.";
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const stats = document.getElementById("stats");

/* device routing: no WebGL2, very low memory or data saver gets the still image and the text */
function weakDevice() {
  try { const c = document.createElement("canvas"); if (!c.getContext("webgl2")) return "webgl"; } catch (_) { return "webgl"; }
  if (navigator.deviceMemory && navigator.deviceMemory <= 2) return "memory";
  if (navigator.connection && navigator.connection.saveData) return "savedata";
  if (new URLSearchParams(location.search).has("static")) return "static";
  return null;
}
let world; const weak = weakDevice();
if (weak) { sceneEl.classList.add("nogl"); document.getElementById("staticNote").hidden = false; hint.textContent = "Alt står i hytteboka under."; }
else { try { world = createWorld(canvas); } catch (e) { console.error(e); sceneEl.classList.add("nogl"); document.getElementById("staticNote").hidden = false; } }
if (world) boot();

function boot() {
  const { camera, state, tour, pick, project, frame, resize } = world;
  function layout() { const w = sceneEl.clientWidth, h = sceneEl.clientHeight; resize(w, h); }
  layout(); new ResizeObserver(layout).observe(sceneEl);
  sceneEl.classList.add("ready");

  /* pointer */
  let hover = null, px = 0, py = 0;
  sceneEl.addEventListener("pointermove", e => {
    const r = sceneEl.getBoundingClientRect(); px = e.clientX - r.left; py = e.clientY - r.top;
    state.mouse = [(px / r.width - .5) * 2, (py / r.height - .5) * 2];
  });
  sceneEl.addEventListener("pointerleave", () => { state.mouse = [0, 0]; hover = null; labelEl.hidden = true; });
  canvas.addEventListener("click", e => {
    if (state.busy) return;
    const r = sceneEl.getBoundingClientRect(); const o = pick(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
    if (!o) return; act(o.userData);
  });
  function act(u) {
    if (u.action === "enter") return enter();
    if (u.action === "exit") { openPanel("kontakt"); return; }
    openPanel(u.id);
  }
  async function enter() {
    if (state.where === "int" || state.busy) return;
    plaque.classList.add("away"); labelEl.hidden = true;
    if (reduce) { camera.position.copy(world.VIEW.int.pos); state.look.copy(world.VIEW.int.look); camera.lookAt(state.look); world.door.rotation.y = -1.75; state.where = "int"; world.controls.enabled = false; }
    else await tour("int");
    hint.textContent = HINT_IN; plaque.classList.remove("away"); plaque.classList.add("inside");
    document.getElementById("exitBtn").hidden = false; document.getElementById("camBtn").hidden = false;
  }
  async function exit() {
    if (state.where !== "int" || state.busy) return;
    setCam(false); plaque.classList.add("away"); labelEl.hidden = true;
    if (reduce) { camera.position.copy(world.VIEW.ext.pos); state.look.copy(world.VIEW.ext.look); camera.lookAt(state.look); world.door.rotation.y = 0; state.where = "ext"; world.controls.enabled = true; }
    else await tour("ext");
    hint.textContent = HINT_OUT; plaque.classList.remove("away", "inside");
    document.getElementById("exitBtn").hidden = true; document.getElementById("camBtn").hidden = true;
  }
  document.getElementById("exitBtn").addEventListener("click", exit);
  addEventListener("keydown", e => { if (e.key === "Escape" && !panel.open && state.where === "int") exit(); });
  window.__tour = { enter, exit, world };

  /* label follows the hovered object */
  function updateLabel() {
    if (state.busy) { labelEl.hidden = true; return; }
    const r = sceneEl.getBoundingClientRect(); const o = pick(px, py, r.width, r.height);
    if (o !== hover) { hover = o; sceneEl.style.cursor = o ? "pointer" : ""; }
    if (!o) { labelEl.hidden = true; return; }
    const [x, y, ok] = project(o, r.width, r.height); if (!ok) { labelEl.hidden = true; return; }
    labelEl.hidden = false; labelEl.style.left = x + "px"; labelEl.style.top = y + "px";
    labelEl.innerHTML = o.userData.name + "<small>" + o.userData.what + "</small>";
  }

  /* loop with fps meter */
  let last = performance.now(), fpsAcc = 0, fpsN = 0, running = true;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    frame(dt); updateLabel();
    fpsAcc += dt; fpsN++; if (fpsAcc > 0.5) { stats.textContent = Math.round(fpsN / fpsAcc) + " fps · " + world.info.render.calls + " kall · " + Math.round(world.info.render.triangles / 1000) + "k tri"; fpsAcc = 0; fpsN = 0; }
    if (running) requestAnimationFrame(loop);
  }
  const capture = new URLSearchParams(location.search).has("capture");
  if (capture && window.gsap) { gsap.ticker.remove(gsap.updateRoot); window.__step = t => { gsap.updateRoot(t); frame(1 / 12); updateLabel(); }; }
  else requestAnimationFrame(loop);
  new IntersectionObserver(es => { running = es[0].isIntersecting; if (running) { last = performance.now(); requestAnimationFrame(loop); } }).observe(sceneEl);

  /* panel */
  const panel = document.getElementById("panel"), panelBody = document.getElementById("panelBody");
  function openPanel(id) {
    const src = document.querySelector('section[data-id="' + id + '"]'); if (!src) return;
    const copy = src.cloneNode(true); copy.removeAttribute("id"); const h = copy.querySelector("h3"); if (h) h.id = "panelTitle";
    panelBody.replaceChildren(copy); if (id === "kamera") wireDemo(copy);
    if (typeof panel.showModal === "function") panel.showModal(); else location.hash = id;
  }
  document.getElementById("panelClose").addEventListener("click", () => panel.close());
  panel.addEventListener("click", e => { if (e.target === panel) panel.close(); });

  /* viltkamera: snapshot from the camera on the tree, run the model on it */
  let camOn = false;
  const setStatus = t => document.querySelectorAll(".camStatus").forEach(el => el.textContent = t);
  async function setCam(on) {
    camOn = on; const b = document.getElementById("camBtn"); b.setAttribute("aria-pressed", String(on));
    document.querySelectorAll('[data-action="cam"]').forEach(x => x.textContent = on ? "Slå av viltkameraet" : "Slå på viltkameraet");
    const view = document.getElementById("camView"); const vc = document.getElementById("camCanvas");
    if (!on) { view.hidden = true; return; }
    view.hidden = false; const snap = world.snapshot(); vc.width = snap.width; vc.height = snap.height; const x = vc.getContext("2d"); x.drawImage(snap, 0, 0);
    setStatus("Viltkameraet på treet tok et bilde av scenen. Laster modellen (10 MB) og ser på det.");
    try {
      const boxes = await detect(snap, 0.4); x.drawImage(snap, 0, 0); drawBoxes(x, boxes);
      setStatus(boxes.length ? "Modellen fant " + boxes.length + " ting i bildet fra viltkameraet." : "Modellen fant ingenting den kjenner igjen i dette bildet. Den kan 80 vanlige ting fra COCO-settet, og scenen er tegnet, ikke fotografert.");
    } catch (e) { setStatus("Kunne ikke kjøre modellen i denne nettleseren."); console.error(e); }
  }
  document.getElementById("camBtn").addEventListener("click", () => setCam(!camOn));
  document.getElementById("camClose").addEventListener("click", () => setCam(false));
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-action]"); if (!b) return;
    if (b.dataset.action === "cam") { panel.close(); if (state.where !== "int") enter().then(() => setCam(true)); else setCam(!camOn); }
    if (b.dataset.action === "enter") { panel.close(); enter(); }
    if (b.dataset.action === "copy") { const v = b.dataset.copy; const done = () => { b.textContent = "Kopiert"; setTimeout(() => b.textContent = "Kopier", 1600); }; try { navigator.clipboard.writeText(v).then(done, () => sel(b)); } catch (_) { sel(b); } }
  });
  function sel(b) { const a = b.parentElement.querySelector(".addr"); if (!a) return; const r = document.createRange(); r.selectNodeContents(a); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  function wireDemo(root) {
    const inp = root.querySelector("input[type=file]"), outC = root.querySelector("canvas.demoOut"), st = root.querySelector(".camStatus"); if (!inp) return;
    inp.addEventListener("change", async () => {
      const f = inp.files[0]; if (!f) return; const img = new Image(); img.src = URL.createObjectURL(f); await img.decode();
      st.textContent = "Ser på bildet ditt. Ingenting sendes noe sted.";
      try { const res = await detect(img); const r = Math.min(1, 640 / img.naturalWidth); outC.width = img.naturalWidth * r; outC.height = img.naturalHeight * r; outC.hidden = false; const x = outC.getContext("2d"); x.drawImage(img, 0, 0, outC.width, outC.height); drawBoxes(x, res, r); st.textContent = res.length ? "Fant " + res.length + " ting." : "Fant ingenting modellen kjenner igjen (den kan 80 vanlige ting fra COCO)."; }
      catch (e) { st.textContent = "Kunne ikke kjøre modellen i denne nettleseren."; }
    });
  }
  wireDemo(document.getElementById("kamera"));
  if (location.hash) { const el = document.getElementById(location.hash.slice(1)); if (el) setTimeout(() => el.scrollIntoView(), 50); }
}
