/* leinhardt.no: a real-time 3D scene. Step 1, grey box.
   Everything is built from measured proportions of a small Norwegian tømmerhytte:
   footprint 6.0 x 4.5 m, wall height 2.2 m, roof pitch 30°, logs Ø 0.20 m,
   door 0.9 x 2.0 m, windows 0.9 x 1.1 m with the sill at 0.9 m, floor 0.45 m above ground,
   porch 1.5 m deep, steps 0.18 m. Units in the scene are metres. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export const STAGE = { GREYBOX: 1, LOOK: 2, DETAIL: 3 };
export let stage = STAGE.GREYBOX;

const C = {
  L: 6.0, D: 4.5, H: 2.2, LOG: 0.2, PITCH: Math.PI / 6, OVER: 0.5,
  FLOOR: 0.45, DOOR_W: 0.9, DOOR_H: 2.0, DOOR_X: 1.2,
  WIN_W: 0.9, WIN_H: 1.1, SILL: 0.9, PORCH: 1.5, STEP: 0.18
};
C.RIDGE = C.H + Math.tan(C.PITCH) * (C.D / 2 + C.OVER);

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const lite = new URLSearchParams(location.search).has("capture"); if (lite) renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x6b7078);
  scene.fog = new THREE.Fog(0x6b7078, 18, 60);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);

  const grey = (c = 0x9a9a9a, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, metalness: 0, ...extra });
  const M = {
    ground: grey(0x7d8278), water: grey(0x5e6670, { roughness: 0.3 }), wall: grey(0x8d8a84), roof: grey(0x7a7d76),
    stone: grey(0x6f6f6f), wood: grey(0xa09688), prop: grey(0xb0aca4), window: new THREE.MeshStandardMaterial({ color: 0xffe9b0, emissive: 0xffc26a, emissiveIntensity: 0.55, roughness: 0.5 }),
    hot: grey(0xb8b4ac), tree: grey(0x767d74), trunk: grey(0x6a6258)
  };

  const hotspots = []; // meshes that can be clicked
  function hot(mesh, id, name, what, action) { mesh.userData = { id, name, what, action, hot: true }; hotspots.push(mesh); return mesh; }
  function box(w, h, d, mat, x, y, z, parent = scene) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; }

  /* ---------- terrain and river ---------- */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90, 60, 60), M.ground);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  { // gentle slope down toward the river at +z, a few bumps
    const p = ground.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); const z = -y; let h = 0; if (x < -6) h = -Math.min(1.2, (-6 - x) * 0.14); h += 0.15 * Math.sin(x * 0.7) * Math.cos(z * 0.5); if (Math.abs(x) < 5 && z > -4 && z < 7) h *= 0.2; p.setZ(i, h); }
    ground.geometry.computeVertexNormals();
  }
  scene.add(ground);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(10, 90, 1, 1), M.water);
  water.rotation.x = -Math.PI / 2; water.position.set(-13.5, -1.1, 0); water.receiveShadow = true; water.name = "water"; scene.add(water);
  for (let i = 0; i < 26; i++) { const r = 0.25 + Math.random() * 0.35; const s = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 7), M.stone); s.position.set(-8.8 - Math.random() * 0.8, -0.9 + r * 0.4, -30 + i * 2.4 + Math.random()); s.scale.y = 0.6; s.castShadow = s.receiveShadow = true; scene.add(s); }

  /* ---------- cabin ---------- */
  const cabin = new THREE.Group(); cabin.position.set(0, 0, 0); scene.add(cabin);
  const F = C.FLOOR;
  box(C.L + 0.2, F, C.D + 0.2, M.stone, 0, F / 2, 0, cabin);                          // stone foundation
  box(C.L - 0.4, 0.1, C.D - 0.4, M.wood, 0, F + 0.05, 0, cabin);                       // floor
  // log walls: stacked logs so the proportions read; front wall has openings
  const logs = Math.round(C.H / C.LOG);
  const halfL = C.L / 2, halfD = C.D / 2;
  const doorX = C.DOOR_X, winX = -1.5;
  for (let i = 0; i < logs; i++) {
    const y = F + C.LOG / 2 + i * C.LOG, odd = i % 2;
    // back wall (-z) and side walls full length
    { const bw = [[-1.0 - C.WIN_W / 2, -1.0 + C.WIN_W / 2, F + C.SILL, F + C.SILL + C.WIN_H]]; const segsB = []; let c0 = -halfL - (odd ? 0.15 : 0); const e0 = halfL + (odd ? 0.15 : 0);
      for (const o of bw.filter(o => y > o[2] && y < o[3])) { if (o[0] > c0) segsB.push([c0, o[0]]); c0 = Math.max(c0, o[1]); } if (c0 < e0) segsB.push([c0, e0]);
      for (const [a, b] of segsB) box(b - a, C.LOG, C.LOG, M.wall, (a + b) / 2, y, -halfD, cabin); }
    box(C.LOG, C.LOG, C.D + (odd ? 0 : 0.3), M.wall, -halfL, y, 0, cabin);
    box(C.LOG, C.LOG, C.D + (odd ? 0 : 0.3), M.wall, halfL, y, 0, cabin);
    // front wall (+z): leave door and window openings
    const segs = [];
    const openings = [[doorX - C.DOOR_W / 2, doorX + C.DOOR_W / 2, F + 0.02, F + C.DOOR_H], [winX - C.WIN_W / 2, winX + C.WIN_W / 2, F + C.SILL, F + C.SILL + C.WIN_H]];
    let cursor = -halfL - (odd ? 0.15 : 0);
    const end = halfL + (odd ? 0.15 : 0);
    const cuts = openings.filter(o => y > o[2] && y < o[3]).sort((a, b) => a[0] - b[0]);
    for (const o of cuts) { if (o[0] > cursor) segs.push([cursor, o[0]]); cursor = Math.max(cursor, o[1]); }
    if (cursor < end) segs.push([cursor, end]);
    for (const [a, b] of segs) box(b - a, C.LOG, C.LOG, M.wall, (a + b) / 2, y, halfD, cabin);
  }
  // gables
  for (const z of [-halfD, halfD]) {
    const g = new THREE.Shape(); g.moveTo(-halfL, 0); g.lineTo(halfL, 0); g.lineTo(0, C.RIDGE - C.H - Math.tan(C.PITCH) * C.OVER); g.closePath();
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(g, { depth: C.LOG, bevelEnabled: false }), M.wall);
    m.position.set(0, F + C.H, z - C.LOG / 2); m.castShadow = m.receiveShadow = true; cabin.add(m);
  }
  // roof: two slabs
  const slope = Math.hypot(halfD + C.OVER, Math.tan(C.PITCH) * (halfD + C.OVER));
  for (const s of [1, -1]) {
    const r = box(C.L + 0.8, 0.18, slope, M.roof, 0, 0, 0, cabin);
    r.position.set(0, F + C.H + Math.tan(C.PITCH) * (halfD + C.OVER) / 2 + 0.05, s * (halfD + C.OVER) / 2);
    r.rotation.x = s * C.PITCH; r.name = "roof";
  }
  box(0.5, 1.2, 0.5, M.stone, 1.8, F + C.RIDGE - 0.3, -0.6, cabin).name = "chimney";
  // window (front) and side window: glowing panes
  const win = box(C.WIN_W, C.WIN_H, 0.06, M.window, winX, F + C.SILL + C.WIN_H / 2, halfD, cabin); win.castShadow = false;
  const win2 = box(0.06, 0.8, 0.8, M.window, halfL, F + 1.3, -0.6, cabin); win2.castShadow = false;
  const winB = box(C.WIN_W, C.WIN_H, 0.06, M.window, -1.0, F + C.SILL + C.WIN_H / 2, -halfD, cabin); winB.castShadow = false;
  // door: hinged group
  const door = new THREE.Group(); door.position.set(doorX - C.DOOR_W / 2, F, halfD + C.LOG / 2); cabin.add(door);
  const doorLeaf = box(C.DOOR_W, C.DOOR_H, 0.06, M.wood, C.DOOR_W / 2, C.DOOR_H / 2, 0, door);
  hot(doorLeaf, "enter", "Døra", "Gå inn", "enter");
  box(0.05, 0.05, 0.05, M.prop, C.DOOR_W - 0.12, 1.0, 0.05, door);
  // porch and steps
  box(C.L, 0.1, C.PORCH, M.wood, 0, F - 0.05, halfD + C.PORCH / 2 + 0.1, cabin);
  for (const x of [-halfL + 0.2, halfL - 0.2]) { box(0.12, F + C.H, 0.12, M.wood, x, (F + C.H) / 2, halfD + C.PORCH, cabin); }
  const pr = box(C.L + 0.8, 0.14, C.PORCH + 0.6, M.roof, 0, F + C.H + 0.3, halfD + C.PORCH / 2 + 0.2, cabin); pr.rotation.x = -0.2;
  box(0.08, 0.9, C.PORCH - 0.2, M.wood, -halfL + 0.2, F + 0.45, halfD + C.PORCH / 2, cabin);
  box(1.6, 0.06, 0.08, M.wood, -halfL + 1.0, F + 0.9, halfD + C.PORCH - 0.05, cabin);
  box(1.6, 0.06, 0.08, M.wood, halfL - 1.0, F + 0.9, halfD + C.PORCH - 0.05, cabin);
  for (let i = 0; i < 2; i++) box(1.2, C.STEP, 0.3, M.wood, doorX, F - C.STEP * (i + 0.5), halfD + C.PORCH + 0.15 + i * 0.3, cabin);

  /* ---------- interior ---------- */
  const inner = { x0: -halfL + C.LOG, x1: halfL - C.LOG, z0: -halfD + C.LOG, z1: halfD - C.LOG, y: F + 0.1 };
  const shelf = box(0.35, 2.0, 1.6, M.prop, inner.x0 + 0.18, inner.y + 1.0, -0.6, cabin); hot(shelf, "utdanning", "Bokhylla", "Utdanning");
  for (let i = 0; i < 4; i++) box(0.33, 0.03, 1.5, M.wood, inner.x0 + 0.18, inner.y + 0.4 + i * 0.45, -0.6, cabin);
  const desk = box(1.4, 0.05, 0.7, M.wood, -1.0, inner.y + 0.75, inner.z0 + 0.45, cabin); hot(desk, "prosjekter", "Arbeidsbordet", "Prosjekter");
  for (const [dx, dz] of [[-0.65, -0.3], [0.65, -0.3], [-0.65, 0.3], [0.65, 0.3]]) box(0.05, 0.73, 0.05, M.wood, -1.0 + dx, inner.y + 0.37, inner.z0 + 0.45 + dz, cabin);
  box(0.33, 0.02, 0.23, M.prop, -1.0, inner.y + 0.79, inner.z0 + 0.5, cabin);                 // laptop base
  const lid = box(0.33, 0.22, 0.015, M.prop, -1.0, inner.y + 0.9, inner.z0 + 0.38, cabin); lid.rotation.x = 0.25;
  const chair = box(0.45, 0.05, 0.45, M.wood, -1.0, inner.y + 0.45, inner.z0 + 1.1, cabin); box(0.45, 0.5, 0.05, M.wood, -1.0, inner.y + 0.72, inner.z0 + 1.32, cabin);
  const stove = box(0.5, 0.9, 0.5, M.stone, inner.x1 - 0.5, inner.y + 0.45, inner.z0 + 0.5, cabin); hot(stove, "om", "Ovnen", "Om meg");
  box(0.12, 1.6, 0.12, M.stone, inner.x1 - 0.5, inner.y + 1.7, inner.z0 + 0.5, cabin);
  const map = box(0.04, 0.7, 0.9, M.prop, inner.x1 - 0.03, inner.y + 1.5, 0.3, cabin); hot(map, "retning", "Kartet", "Dit jeg er på vei");
  const table = box(0.6, 0.05, 0.6, M.wood, inner.x1 - 1.3, inner.y + 0.55, inner.z0 + 0.9, cabin);
  const book = box(0.32, 0.04, 0.24, M.prop, inner.x1 - 1.3, inner.y + 0.6, inner.z0 + 0.9, cabin); hot(book, "erfaring", "Hytteboka", "Erfaring");
  const net = box(0.06, 1.5, 0.06, M.wood, inner.x1 - 0.35, inner.y + 0.75, inner.z1 - 0.5, cabin); net.rotation.z = 0.15; hot(net, "fritid", "Håven og vaderne", "Fritid");
  box(0.4, 0.4, 0.04, M.prop, inner.x1 - 0.35, inner.y + 1.6, inner.z1 - 0.5, cabin).rotation.z = 0.15;
  const arm = box(0.8, 0.5, 0.8, M.prop, inner.x0 + 0.9, inner.y + 0.25, inner.z1 - 1.0, cabin); box(0.8, 0.5, 0.2, M.prop, inner.x0 + 0.9, inner.y + 0.75, inner.z1 - 1.4, cabin);
  const winIn = box(C.WIN_W, C.WIN_H, 0.02, M.window, -1.0, F + C.SILL + C.WIN_H / 2, -halfD + C.LOG + 0.02, cabin); winIn.castShadow = false; hot(winIn, "kamera", "Vinduet", "Viltkamera");
  const doorIn = box(0.3, 0.3, 0.05, M.prop, doorX, F + 1.6, halfD - C.LOG - 0.04, cabin); hot(doorIn, "kontakt", "Døra bak deg", "Kontakt og ut", "exit"); // a hook by the door

  /* ---------- outside props ---------- */
  const boat = new THREE.Group(); boat.position.set(-8.6, -0.85, 6.0); boat.rotation.y = 1.25; scene.add(boat);
  box(4.2, 0.5, 1.3, M.wood, 0, 0.25, 0, boat); box(0.1, 0.6, 1.2, M.wood, 1.2, 0.3, 0, boat); hot(boat.children[0], "fritid", "Båten", "Fritid");
  const fire = new THREE.Group(); fire.position.set(-4.5, 0.05, 6.5); scene.add(fire);
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; box(0.3, 0.2, 0.25, M.stone, Math.cos(a) * 0.55, 0.1, Math.sin(a) * 0.55, fire).rotation.y = a; }
  const logsM = box(0.8, 0.12, 0.12, M.wood, 0, 0.12, 0, fire); logsM.rotation.y = 0.6; box(0.8, 0.12, 0.12, M.wood, 0, 0.2, 0, fire).rotation.y = -0.7; hot(logsM, "om", "Bålet", "Om meg");
  box(1.4, 0.3, 0.3, M.wood, -1.6, 0.15, 0.9, fire); // log bench
  const camTree = new THREE.Group(); camTree.position.set(-2.4, 0, -8.5); scene.add(camTree);
  box(0.25, 5, 0.25, M.trunk, 0, 2.5, 0, camTree); box(0.18, 0.12, 0.1, M.prop, 0, 2.2, 0.18, camTree).name = "viltkamera";
  const crown = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), M.tree); crown.position.set(0, 5.4, 0); crown.castShadow = true; camTree.add(crown);
  // spruce forest
  const rnd = (() => { let s = 7; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; })();
  const coneG = new THREE.ConeGeometry(1, 1, 7), cylG = new THREE.CylinderGeometry(0.15, 0.2, 1, 6);
  for (let i = 0; i < 110; i++) {
    const x = -34 + rnd() * 68, z = -30 + rnd() * 38; if (Math.abs(x) < 6.5 && z > -5 && z < 9) continue; if (x < -7) continue; if (z > 3 && x > 1.5 && x < 20) continue; if (z > 9 && x > -4) continue;
    const h = 6 + rnd() * 7; const t = new THREE.Group(); t.position.set(x, 0, z);
    const trunk = new THREE.Mesh(cylG, M.trunk); trunk.scale.set(1, 2, 1); trunk.position.y = 1; t.add(trunk);
    for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(coneG, M.tree); const r = (1.6 - k * 0.35) * (h / 8); c.scale.set(r, h * 0.45, r); c.position.y = 2 + k * h * 0.22 + h * 0.2; c.castShadow = true; t.add(c); }
    scene.add(t);
  }
  // birches near the cabin (right side in the style frame)
  for (const [x, z] of [[5.6, -3.5], [7.4, -1.2], [6.8, 1.6]]) { const b = box(0.22, 9, 0.22, M.prop, x, 4.5, z); const c = new THREE.Mesh(new THREE.SphereGeometry(1.5, 9, 7), M.tree); c.position.set(x, 9.0, z); c.castShadow = true; scene.add(c); }

  /* ---------- lights ---------- */
  const hemi = new THREE.HemisphereLight(0x9fb4d8, 0x4a4a44, 0.6); scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xbfd0ff, 1.0); moon.position.set(-12, 18, -8); moon.castShadow = true;
  moon.shadow.mapSize.set(lite ? 1024 : 2048, lite ? 1024 : 2048); Object.assign(moon.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 }); scene.add(moon);
  const winLight = new THREE.PointLight(0xffb060, 6, 9, 2); winLight.position.set(winX, F + 1.5, halfD + 0.4); winLight.castShadow = true; scene.add(winLight);
  const doorLight = new THREE.PointLight(0xffb060, 4, 7, 2); doorLight.position.set(doorX, F + 1.9, halfD + 0.3); scene.add(doorLight);
  const roomLight = new THREE.PointLight(0xffc080, 2.5, 7, 2); roomLight.position.set(-0.6, F + 1.3, inner.z0 + 0.7); scene.add(roomLight);
  const fireLight = new THREE.PointLight(0xff8a30, 8, 9, 2); fireLight.position.set(fire.position.x, 0.6, fire.position.z); fireLight.castShadow = true; scene.add(fireLight);
  const stoveLight = new THREE.PointLight(0xff7a30, 4, 4, 2); stoveLight.position.set(inner.x1 - 0.5, inner.y + 0.5, inner.z0 + 0.85); scene.add(stoveLight);

  /* ---------- camera rig ---------- */
  const VIEW = {
    ext: { pos: new THREE.Vector3(9.0, 3.6, 15.5), look: new THREE.Vector3(-2.2, 1.0, 1.5) },
    porch: { pos: new THREE.Vector3(doorX + 0.1, F + 1.55, halfD + C.PORCH + 2.6), look: new THREE.Vector3(doorX, F + 1.3, halfD) },
    doorway: { pos: new THREE.Vector3(doorX, F + 1.55, halfD + 0.9), look: new THREE.Vector3(-0.6, F + 1.2, -1.5) },
    int: { pos: new THREE.Vector3(doorX - 0.2, F + 1.55, halfD - 0.7), look: new THREE.Vector3(-0.8, F + 1.1, -1.8) }
  };
  camera.position.copy(VIEW.ext.pos); camera.lookAt(VIEW.ext.look);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(VIEW.ext.look); controls.enablePan = false; controls.enableZoom = true;
  controls.minDistance = 8; controls.maxDistance = 24; controls.minPolarAngle = 0.9; controls.maxPolarAngle = 1.45;
  controls.minAzimuthAngle = -0.3; controls.maxAzimuthAngle = 1.3; controls.enableDamping = true; controls.dampingFactor = 0.06;

  const state = { where: "ext", busy: false, look: new THREE.Vector3().copy(VIEW.ext.look), mouse: [0, 0], t: 0 };
  let lookBase = null;
  function tour(where) {
    const gsap = window.gsap; if (!gsap || state.busy) return Promise.resolve();
    state.busy = true; controls.enabled = false;
    const tl = gsap.timeline();
    const cur = { px: camera.position.x, py: camera.position.y, pz: camera.position.z, lx: state.look.x, ly: state.look.y, lz: state.look.z, fov: camera.fov };
    tl.to(cur, { fov: where === "int" ? 62 : 42, duration: where === "int" ? 2.2 : 1.6, ease: "power1.inOut", onUpdate() { camera.fov = cur.fov; camera.updateProjectionMatrix(); } }, where === "int" ? 1.6 : 1.2);
    const go = (v, d, e, at) => tl.to(cur, { px: v.pos.x, py: v.pos.y, pz: v.pos.z, lx: v.look.x, ly: v.look.y, lz: v.look.z, duration: d, ease: e, onUpdate() { camera.position.set(cur.px, cur.py, cur.pz); state.look.set(cur.lx, cur.ly, cur.lz); camera.lookAt(state.look); } }, at);
    if (where === "int") {
      go(VIEW.porch, 1.6, "power2.inOut", 0);
      tl.to(door.rotation, { y: -1.75, duration: 1.1, ease: "power2.out" }, 1.2);
      go(VIEW.doorway, 1.3, "power1.inOut", 1.5);
      go(VIEW.int, 1.2, "power2.out", 2.7);
    } else {
      go(VIEW.doorway, 1.0, "power2.in", 0);
      go(VIEW.porch, 1.2, "power1.inOut", 0.9);
      tl.to(door.rotation, { y: 0, duration: 0.9, ease: "power2.inOut" }, 1.4);
      go(VIEW.ext, 1.8, "power2.inOut", 2.0);
    }
    return new Promise(res => tl.eventCallback("onComplete", () => {
      state.where = where; state.busy = false; lookBase = state.look.clone();
      if (where === "ext") { controls.target.copy(VIEW.ext.look); controls.enabled = true; }
      res();
    }));
  }

  /* ---------- picking ---------- */
  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
  function pick(px, py, w, h) {
    ndc.set(px / w * 2 - 1, -(py / h) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(hotspots, false);
    if (!hits.length) return null;
    const o = hits[0].object;
    // only things in the current place
    const inside = o === doorLeaf ? false : o.parent === cabin && Math.abs(o.position.x) < halfL && Math.abs(o.position.z) < halfD - 0.05;
    if (state.where === "ext" && inside) return null;
    if (state.where === "int" && !inside && o !== doorIn) return null;
    return o;
  }
  function project(obj, w, h) { const v = new THREE.Vector3(); obj.getWorldPosition(v); v.project(camera); return [(v.x + 1) / 2 * w, (1 - v.y) / 2 * h, v.z < 1]; }

  /* ---------- viltkamera: a real camera on the tree ---------- */
  const trailCam = new THREE.PerspectiveCamera(50, 4 / 3, 0.1, 40);
  trailCam.position.set(camTree.position.x, 2.2, camTree.position.z + 0.25); trailCam.lookAt(-1.0, F + 1.4, -halfD);
  const trailRT = new THREE.WebGLRenderTarget(640, 480);
  function snapshot() {
    renderer.setRenderTarget(trailRT); renderer.render(scene, trailCam); renderer.setRenderTarget(null);
    const buf = new Uint8Array(640 * 480 * 4); renderer.readRenderTargetPixels(trailRT, 0, 0, 640, 480, buf);
    const c = document.createElement("canvas"); c.width = 640; c.height = 480; const x = c.getContext("2d"); const im = x.createImageData(640, 480);
    for (let y = 0; y < 480; y++) im.data.set(buf.subarray((479 - y) * 2560, (480 - y) * 2560), y * 2560); // flip
    x.putImageData(im, 0, 0); return c;
  }

  /* ---------- frame ---------- */
  function resize(w, h) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  function frame(dt) {
    state.t += dt;
    fireLight.intensity = 7 + Math.sin(state.t * 11) * 1.4 + Math.sin(state.t * 23) * 1.0;
    stoveLight.intensity = 3.5 + Math.sin(state.t * 9) * 0.8;
    if (!state.busy) {
      if (state.where === "ext") controls.update();
      else if (lookBase) { const l = lookBase.clone(); l.x += state.mouse[0] * 1.2; l.y += -state.mouse[1] * 0.6; state.look.lerp(l, 0.08); camera.lookAt(state.look); }
    }
    renderer.render(scene, camera);
  }
  return { scene, camera, renderer, controls, hotspots, state, tour, pick, project, frame, resize, snapshot, door, VIEW, C, materials: M, lights: { hemi, moon, winLight, doorLight, roomLight, fireLight, stoveLight }, water, trailCam };
}
