/* leinhardt.no: a real-time 3D scene in Three.js.
   Measured proportions of a small Norwegian tømmerhytte: footprint 6.0 x 4.5 m, wall height 2.2 m,
   roof pitch 30°, logs Ø 0.20 m, door 0.9 x 2.0 m, windows 0.9 x 1.1 m with the sill at 0.9 m,
   floor 0.45 m above ground on a stone base, porch 1.5 m deep, steps 0.18 m. Units are metres.
   Look: toon shading with a three-step ramp, limited palette from the approved style frame,
   blue-hour sky, fog, bloom on the warm lights, film grain. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const C = {
  L: 6.0, D: 4.5, H: 2.2, LOG: 0.2, PITCH: Math.PI / 6, OVER: 0.5,
  FLOOR: 0.45, DOOR_W: 0.9, DOOR_H: 2.0, DOOR_X: 1.2, WIN_X: -1.5, BWIN_X: -1.0,
  WIN_W: 0.9, WIN_H: 1.1, SILL: 0.9, PORCH: 1.5, STEP: 0.18
};
C.RIDGE = C.H + Math.tan(C.PITCH) * (C.D / 2 + C.OVER);

/* palette from the style frame */
const P = {
  skyTop: 0x03162a, skyMid: 0x144283, skyLow: 0x3a5a9a, horizon: 0xd98a4a, fog: 0x12284a,
  ground: 0x3a6a34, groundLit: 0x7fae4c, water: 0x1b4a86, waterDeep: 0x0b2a52,
  timber: 0x3a2a1c, timberLit: 0x6b4a2e, turf: 0x4f7d3a, stone: 0x5d6168, wood: 0x8a6a44, woodLight: 0xb08a5a,
  spruce: 0x1c3c2a, spruceLit: 0x2f5e3a, birchLeaf: 0x5a8a3c, birchBark: 0xe8e4da,
  window: 0xffd98a, lamp: 0xf0a94a, fire: 0xff8a30, moon: 0x9fb8e8
};

export function createWorld(canvas) {
  const lite = new URLSearchParams(location.search).has("capture");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(matchMedia("(max-width: 700px)").matches ? 1.5 : 2, devicePixelRatio));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = lite ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(P.skyMid);
  scene.fog = new THREE.FogExp2(P.fog, 0.022);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 160);

  /* toon ramp: three steps */
  const ramp = new THREE.DataTexture(new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
  const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...extra });
  const M = {
    ground: toon(P.ground, { vertexColors: true }), timber: toon(P.timber), roof: toon(P.turf), stone: toon(P.stone), wood: toon(P.wood), woodLight: toon(P.woodLight),
    window: new THREE.MeshBasicMaterial({ color: P.window }), windowDim: new THREE.MeshBasicMaterial({ color: 0xc98a3a }),
    spruce: toon(P.spruce), trunk: toon(0x3a2a20), birchLeaf: toon(P.birchLeaf), prop: toon(0x8f8577), iron: toon(0x2a2a2e), paper: toon(0xe9dcc0), red: toon(0x8e2f2a),
    cloth: toon(0x6a4a3a), glass: new THREE.MeshBasicMaterial({ color: 0x0c1a30, transparent: true, opacity: 0.55 }), ember: new THREE.MeshBasicMaterial({ color: 0xff9a40 })
  };

  const hotspots = [];
  function hot(mesh, id, name, what, action) { mesh.userData = { id, name, what, action, hot: true }; hotspots.push(mesh); return mesh; }
  function box(w, h, d, mat, x, y, z, parent = scene) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; }
  function cyl(r, len, mat, x, y, z, axis, parent = scene, seg = 10) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat); if (axis === "x") m.rotation.z = Math.PI / 2; else if (axis === "z") m.rotation.x = Math.PI / 2; m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; }
  const rnd = (() => { let s = 11; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; })();

  /* ---------- sky ---------- */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(140, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(P.skyTop) }, mid: { value: new THREE.Color(P.skyMid) }, low: { value: new THREE.Color(P.skyLow) }, hor: { value: new THREE.Color(P.horizon) }, t: { value: 0 } },
    vertexShader: `varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top, mid, low, hor; uniform float t; varying vec3 vp;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){ vec3 d = normalize(vp); float h = d.y;
        vec3 c = mix(low, mid, smoothstep(0.0, 0.25, h)); c = mix(c, top, smoothstep(0.25, 0.8, h));
        float west = smoothstep(0.2, 1.0, -d.x) * smoothstep(0.18, -0.02, h); c = mix(c, hor, west * 0.85);
        vec2 g = floor(d.xz / max(0.02, 0.012 + 0.0 * h) * 1.0 + d.y * 300.0); float s = hash(floor(vec2(atan(d.z, d.x) * 180.0, h * 400.0)));
        float star = step(0.993, s) * smoothstep(0.05, 0.3, h) * (0.6 + 0.4 * sin(t * 2.0 + s * 50.0));
        c += vec3(0.9, 0.95, 1.0) * star * 0.9;
        gl_FragColor = vec4(c, 1.0); }`
  })); scene.add(sky);
  const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 12), new THREE.MeshBasicMaterial({ color: 0xf2f0e4, fog: false })); moonMesh.position.set(-60, 48, -70); scene.add(moonMesh);

  /* ---------- terrain ---------- */
  const groundG = new THREE.PlaneGeometry(120, 120, 90, 90);
  { const p = groundG.attributes.position, col = []; const cGround = new THREE.Color(P.ground), cLit = new THREE.Color(P.groundLit), cDark = new THREE.Color(0x16301c);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = -p.getY(i); let h = 0; if (x < -6) h = -Math.min(1.3, (-6 - x) * 0.16); h += 0.18 * Math.sin(x * 0.6) * Math.cos(z * 0.45) + 0.08 * Math.sin(x * 1.7 + z); if (Math.abs(x) < 5.5 && z > -4 && z < 7.5) h *= 0.15; p.setZ(i, h);
      const dC = Math.hypot(x + 1, z - 3) / 9; const c = cGround.clone().lerp(cLit, Math.max(0, 1 - dC)).lerp(cDark, Math.min(1, Math.max(0, (Math.hypot(x, z) - 12) / 20))); col.push(c.r, c.g, c.b); }
    groundG.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); groundG.computeVertexNormals(); }
  const ground = new THREE.Mesh(groundG, M.ground); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  // path from the steps toward the river
  for (let i = 0; i < 11; i++) { const t = i / 10; const s = new THREE.Mesh(new THREE.CylinderGeometry(0.28 + rnd() * 0.1, 0.3, 0.06, 7), toon(0x8c8a7c)); s.position.set(C.DOOR_X + 0.2 - t * 8.5 + Math.sin(t * 6) * 0.3, 0.05, C.D / 2 + C.PORCH + 0.9 + t * 1.6); s.receiveShadow = true; scene.add(s); }

  /* ---------- water ---------- */
  const waterMat = new THREE.ShaderMaterial({
    transparent: false, fog: true,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), t: { value: 0 }, c1: { value: new THREE.Color(P.water) }, c2: { value: new THREE.Color(P.waterDeep) }, warm: { value: new THREE.Color(P.lamp) }, moonC: { value: new THREE.Color(P.moon) }, cam: { value: new THREE.Vector3() } },
    vertexShader: `#include <fog_pars_vertex>
      uniform float t; varying vec3 vw; varying float vh;
      void main(){ vec3 p = position; float w = sin(p.x * 1.4 + t * 0.9) * 0.03 + sin(p.y * 0.8 - t * 0.6) * 0.04 + sin((p.x + p.y) * 2.6 + t * 1.7) * 0.015; p.z += w; vh = w;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0); vw = (modelMatrix * vec4(p, 1.0)).xyz; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `#include <fog_pars_fragment>
      uniform float t; uniform vec3 c1, c2, warm, moonC, cam; varying vec3 vw; varying float vh;
      void main(){ vec3 V = normalize(cam - vw); float fres = pow(1.0 - max(0.0, V.y), 2.0);
        vec3 c = mix(c2, c1, 0.35 + fres * 0.5 + vh * 3.0);
        float rip = pow(max(0.0, sin(vw.z * 9.0 + t * 2.2 + sin(vw.x * 5.0 + t) * 2.0)), 14.0);
        c += moonC * rip * 0.12;
        float streak = exp(-abs(vw.z - 2.2) * 0.55) * exp(-max(0.0, -8.0 - vw.x) * 0.25) * (0.75 + 0.25 * sin(vw.z * 30.0 + t * 3.0));
        c += warm * streak * 0.55;
        float mstreak = exp(-abs(vw.z + 14.0) * 0.12) * exp(-max(0.0, -10.0 - vw.x) * 0.1) * (0.7 + 0.3 * sin(vw.z * 24.0 - t * 2.0));
        c += moonC * mstreak * 0.12;
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
      }`
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(14, 120, 28, 120), waterMat); water.rotation.x = -Math.PI / 2; water.position.set(-14.5, -1.15, 0); scene.add(water);
  const rockMat = toon(0x4b5058);
  for (let i = 0; i < 40; i++) { const r = 0.25 + rnd() * 0.45; const s = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rockMat); s.position.set(-8.4 - rnd() * 1.2, -0.95 + r * 0.35, -40 + i * 2.2 + rnd()); s.scale.y = 0.55; s.rotation.set(rnd(), rnd(), rnd()); s.castShadow = s.receiveShadow = true; scene.add(s); }

  /* ---------- cabin ---------- */
  const cabin = new THREE.Group(); scene.add(cabin);
  const F = C.FLOOR, halfL = C.L / 2, halfD = C.D / 2, R = C.LOG / 2;
  box(C.L + 0.2, F, C.D + 0.2, M.stone, 0, F / 2, 0, cabin);
  for (let i = 0; i < 34; i++) { const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + rnd() * 0.1, 0), rockMat); const side = i % 4; const u = -1 + rnd() * 2; s.position.set(side < 2 ? u * halfL : (side === 2 ? -halfL - 0.1 : halfL + 0.1), 0.1 + rnd() * 0.3, side < 2 ? (side === 0 ? halfD + 0.1 : -halfD - 0.1) : u * halfD); s.castShadow = true; cabin.add(s); }
  box(C.L - 0.4, 0.1, C.D - 0.4, M.wood, 0, F + 0.05, 0, cabin);
  const openF = [[C.DOOR_X - C.DOOR_W / 2, C.DOOR_X + C.DOOR_W / 2, F + 0.02, F + C.DOOR_H], [C.WIN_X - C.WIN_W / 2, C.WIN_X + C.WIN_W / 2, F + C.SILL, F + C.SILL + C.WIN_H]];
  const openB = [[C.BWIN_X - C.WIN_W / 2, C.BWIN_X + C.WIN_W / 2, F + C.SILL, F + C.SILL + C.WIN_H]];
  const openR = [[-1.0, -0.2, F + 1.0, F + 1.8]];
  function wallX(z, y, odd, opens) {
    const segs = []; let c0 = -halfL - (odd ? 0.22 : 0); const e0 = halfL + (odd ? 0.22 : 0);
    for (const o of opens.filter(o => y > o[2] && y < o[3]).sort((a, b) => a[0] - b[0])) { if (o[0] > c0) segs.push([c0, o[0]]); c0 = Math.max(c0, o[1]); } if (c0 < e0) segs.push([c0, e0]);
    for (const [a, b] of segs) cyl(R, b - a, M.timber, (a + b) / 2, y, z, "x", cabin, 9);
  }
  function wallZ(x, y, odd, opens) {
    const segs = []; let c0 = -halfD - (odd ? 0 : 0.22); const e0 = halfD + (odd ? 0 : 0.22);
    for (const o of opens.filter(o => y > o[2] && y < o[3]).sort((a, b) => a[0] - b[0])) { if (o[0] > c0) segs.push([c0, o[0]]); c0 = Math.max(c0, o[1]); } if (c0 < e0) segs.push([c0, e0]);
    for (const [a, b] of segs) cyl(R, b - a, M.timber, x, y, (a + b) / 2, "z", cabin, 9);
  }
  const nLogs = Math.round(C.H / C.LOG);
  for (let i = 0; i < nLogs; i++) { const y = F + R + i * C.LOG, odd = i % 2; wallX(halfD, y, odd, openF); wallX(-halfD, y, odd, openB); wallZ(-halfL, y, odd, []); wallZ(halfL, y, odd, openR); }

  // solid wall cores behind the logs (no light leaks), with holes for door and windows
  function wallCore(len, opens, x, z, rotY) {
    const sh = new THREE.Shape(); sh.moveTo(-len / 2, 0); sh.lineTo(len / 2, 0); sh.lineTo(len / 2, C.H); sh.lineTo(-len / 2, C.H); sh.closePath();
    for (const o of opens) { const h = new THREE.Path(); h.moveTo(o[0], o[2] - F); h.lineTo(o[1], o[2] - F); h.lineTo(o[1], o[3] - F); h.lineTo(o[0], o[3] - F); h.closePath(); sh.holes.push(h); }
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false }), M.timber); m.position.set(x, F, z); m.rotation.y = rotY; m.castShadow = m.receiveShadow = true; cabin.add(m); return m;
  }
  wallCore(C.L, openF, 0, halfD - 0.06, 0); wallCore(C.L, openB, 0, -halfD - 0.06, 0); wallCore(C.D, [], -halfL + 0.06, 0, -Math.PI / 2); wallCore(C.D, openR.map(o => [-o[1], -o[0], o[2], o[3]]), halfL + 0.06, 0, Math.PI / 2);
  const ceiling = box(C.L, 0.06, C.D, M.woodLight, 0, F + C.H + 0.03, 0, cabin); for (let k = 0; k < 20; k++) box(0.015, 0.02, C.D, M.timber, -halfL + 0.15 + k * 0.3, F + C.H - 0.01, 0, cabin);
  for (const z of [-halfD, halfD]) { const g = new THREE.Shape(); g.moveTo(-halfL, 0); g.lineTo(halfL, 0); g.lineTo(0, C.RIDGE - C.H - Math.tan(C.PITCH) * C.OVER); g.closePath(); const m = new THREE.Mesh(new THREE.ExtrudeGeometry(g, { depth: C.LOG, bevelEnabled: false }), M.timber); m.position.set(0, F + C.H, z - R); m.castShadow = m.receiveShadow = true; cabin.add(m); }
  // roof: boards, turf, edge log (torvvol)
  const slope = Math.hypot(halfD + C.OVER, Math.tan(C.PITCH) * (halfD + C.OVER));
  for (const s of [1, -1]) {
    const g = new THREE.Group(); g.position.set(0, F + C.H + Math.tan(C.PITCH) * (halfD + C.OVER) / 2 + 0.05, s * (halfD + C.OVER) / 2); g.rotation.x = s * C.PITCH; cabin.add(g);
    box(C.L + 0.9, 0.08, slope, M.wood, 0, 0, 0, g); const turf = box(C.L + 0.9, 0.2, slope, M.roof, 0, 0.14, 0, g); turf.name = "turf";
    cyl(0.09, C.L + 0.9, M.timber, 0, 0.22, s * slope / 2, "x", g);
    for (let k = 0; k < 90; k++) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16 + rnd() * 0.12, 4), toon(rnd() < 0.5 ? 0x6a9a3c : 0x7fb04a)); t.position.set(-halfL - 0.4 + rnd() * (C.L + 0.8), 0.3, (rnd() - 0.5) * slope * 0.95); g.add(t); if (rnd() < 0.12) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 4), new THREE.MeshBasicMaterial({ color: [0xf2d36a, 0xe9e4d8, 0xd36bd0][k % 3] })); f.position.copy(t.position); f.position.y += 0.12; g.add(f); } }
  }
  box(0.5, 1.3, 0.5, M.stone, 1.8, F + C.RIDGE - 0.25, -0.6, cabin);
  const chimneyTop = new THREE.Vector3(1.8, F + C.RIDGE + 0.45, -0.6);
  // windows: frame, glass, warm pane behind (so the glow reads from outside and inside)
  function windowAt(x, y, z, w, h, axis, dim) {
    const g = new THREE.Group(); g.position.set(x, y, z); if (axis === "z") g.rotation.y = Math.PI / 2; cabin.add(g);
    const fr = toon(0xe8e2d6); for (const [dx, dy, ww, hh] of [[0, h / 2, w + 0.12, 0.07], [0, -h / 2, w + 0.12, 0.07], [-w / 2, 0, 0.07, h], [w / 2, 0, 0.07, h], [0, 0, 0.04, h], [0, 0, w, 0.04]]) box(ww, hh, 0.26, fr, dx, dy, 0, g);
    const pane = box(w, h, 0.02, dim ? M.windowDim : M.window, 0, 0, 0, g); pane.castShadow = false; pane.name = "pane"; return pane;
  }
  windowAt(C.WIN_X, F + C.SILL + C.WIN_H / 2, halfD, C.WIN_W, C.WIN_H, "x");
  const backPane = windowAt(C.BWIN_X, F + C.SILL + C.WIN_H / 2, -halfD, C.WIN_W, C.WIN_H, "x", true);
  windowAt(halfL, F + 1.4, -0.6, 0.8, 0.8, "z", true);
  backPane.material = M.glass; hot(backPane, "kamera", "Vinduet", "Viltkamera");
  // the view through the back window is the forest; the trail camera sits on a tree out there
  // door, hinged
  const door = new THREE.Group(); door.position.set(C.DOOR_X - C.DOOR_W / 2, F, halfD + R); cabin.add(door);
  const doorLeaf = box(C.DOOR_W, C.DOOR_H, 0.07, M.woodLight, C.DOOR_W / 2, C.DOOR_H / 2, 0, door); hot(doorLeaf, "enter", "Døra", "Gå inn", "enter");
  for (let k = 0; k < 4; k++) box(0.02, C.DOOR_H - 0.1, 0.08, M.wood, 0.1 + k * 0.23, C.DOOR_H / 2, 0, door);
  box(0.05, 0.05, 0.12, M.iron, C.DOOR_W - 0.12, 1.0, 0, door);
  for (const [dx, dy, w, h] of [[0, C.DOOR_H + 0.05, C.DOOR_W + 0.2, 0.1], [-C.DOOR_W / 2 - 0.05, C.DOOR_H / 2, 0.1, C.DOOR_H], [C.DOOR_W / 2 + 0.05, C.DOOR_H / 2, 0.1, C.DOOR_H]]) box(w, h, 0.3, toon(0xe8e2d6), C.DOOR_X + dx, F + dy, halfD, cabin);
  // lantern by the door
  const lantern = box(0.14, 0.2, 0.14, M.iron, C.DOOR_X + 0.75, F + 1.9, halfD + 0.2, cabin); const lanternGlass = box(0.1, 0.12, 0.1, M.window, C.DOOR_X + 0.75, F + 1.9, halfD + 0.2, cabin); lanternGlass.castShadow = false;
  // porch
  box(C.L, 0.1, C.PORCH, M.wood, 0, F - 0.05, halfD + C.PORCH / 2 + 0.1, cabin);
  for (let k = 0; k < 14; k++) box(C.L, 0.012, 0.02, M.timber, 0, F + 0.006, halfD + 0.2 + k * 0.1, cabin);
  for (const x of [-halfL + 0.2, halfL - 0.2, C.DOOR_X - 0.9, C.DOOR_X + 0.9]) cyl(0.07, F + C.H + 0.1, M.wood, x, (F + C.H) / 2 + 0.05, halfD + C.PORCH - 0.05, "y", cabin);
  const pr = new THREE.Group(); pr.position.set(0, F + C.H + 0.3, halfD + C.PORCH / 2 + 0.2); pr.rotation.x = 0.2; cabin.add(pr); box(C.L + 0.9, 0.07, C.PORCH + 0.7, M.wood, 0, 0, 0, pr); box(C.L + 0.9, 0.16, C.PORCH + 0.7, M.roof, 0, 0.12, 0, pr);
  for (const [x0, x1] of [[-halfL + 0.2, C.DOOR_X - 0.9], [C.DOOR_X + 0.9, halfL - 0.2]]) { box(x1 - x0, 0.06, 0.08, M.wood, (x0 + x1) / 2, F + 0.9, halfD + C.PORCH - 0.05, cabin); for (let x = x0 + 0.2; x < x1; x += 0.25) box(0.04, 0.85, 0.04, M.wood, x, F + 0.45, halfD + C.PORCH - 0.05, cabin); }
  for (let i = 0; i < 2; i++) box(1.3, C.STEP, 0.32, M.wood, C.DOOR_X, F - C.STEP * (i + 0.5), halfD + C.PORCH + 0.16 + i * 0.32, cabin);
  const boots = new THREE.Group(); boots.position.set(C.DOOR_X + 0.7, F, halfD + 0.6); cabin.add(boots); for (const dx of [0, 0.14]) { box(0.1, 0.22, 0.12, M.cloth, dx, 0.11, 0, boots); box(0.1, 0.06, 0.24, M.cloth, dx, 0.03, 0.06, boots); }
  const rod = cyl(0.015, 2.4, M.woodLight, -halfL + 0.6, F + 1.1, halfD + 0.35, "y", cabin); rod.rotation.z = 0.12;

  /* ---------- interior ---------- */
  const inner = { x0: -halfL + C.LOG, x1: halfL - C.LOG, z0: -halfD + C.LOG, z1: halfD - C.LOG, y: F + 0.1 };
  // rug
  const rugC = document.createElement("canvas"); rugC.width = 128; rugC.height = 64; { const x = rugC.getContext("2d"); for (let i = 0; i < 16; i++) { x.fillStyle = ["#7a3a2e", "#b8894a", "#3a4a6a", "#d9c7a0"][i % 4]; x.fillRect(i * 8, 0, 8, 64); } }
  const rugT = new THREE.CanvasTexture(rugC); rugT.colorSpace = THREE.SRGBColorSpace; const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.3), new THREE.MeshToonMaterial({ map: rugT, gradientMap: ramp })); rug.rotation.x = -Math.PI / 2; rug.position.set(-0.2, inner.y + 0.012, 0.3); rug.receiveShadow = true; cabin.add(rug);
  // bookshelf with books and binders
  const shelf = new THREE.Group(); shelf.position.set(inner.x0 + 0.18, inner.y, -0.6); cabin.add(shelf);
  const shelfBody = box(0.36, 2.0, 1.6, M.wood, 0, 1.0, 0, shelf); hot(shelfBody, "utdanning", "Bokhylla", "Utdanning");
  for (let i = 0; i < 5; i++) { box(0.34, 0.03, 1.52, M.woodLight, 0.01, 0.1 + i * 0.45, 0, shelf); if (i < 4) { let z = -0.72; while (z < 0.72) { const w = 0.03 + rnd() * 0.05, h = 0.22 + rnd() * 0.16; const b = box(0.26, h, w, toon([0x8e2f2a, 0x2f4e7a, 0xd9c7a0, 0x3f6a3a, 0x6a3a7a, 0xb8894a][Math.floor(rnd() * 6)]), 0.03, 0.115 + i * 0.45 + h / 2, z + w / 2, shelf); z += w + 0.006; if (rnd() < 0.08) z += 0.1; } } }
  for (const dz of [0.5, 0.95]) { box(0.02, 0.32, 0.26, toon(0x3a2a1c), inner.x0 + 0.015, inner.y + 1.65, dz, cabin); box(0.01, 0.26, 0.2, M.paper, inner.x0 + 0.03, inner.y + 1.65, dz, cabin); }
  // desk under the back window, laptop, lamp, sketches
  const deskX = C.BWIN_X, deskZ = inner.z0 + 0.45;
  const desk = box(1.5, 0.05, 0.7, M.wood, deskX, inner.y + 0.75, deskZ, cabin); hot(desk, "prosjekter", "Arbeidsbordet", "Prosjekter");
  for (const [dx, dz] of [[-0.7, -0.3], [0.7, -0.3], [-0.7, 0.3], [0.7, 0.3]]) box(0.05, 0.73, 0.05, M.wood, deskX + dx, inner.y + 0.37, deskZ + dz, cabin);
  box(0.4, 0.2, 0.65, M.wood, deskX + 0.55, inner.y + 0.63, deskZ, cabin);
  box(0.34, 0.02, 0.24, toon(0x9a9aa0), deskX, inner.y + 0.785, deskZ + 0.05, cabin);
  const screenC = document.createElement("canvas"); screenC.width = 256; screenC.height = 160; { const x = screenC.getContext("2d"); x.fillStyle = "#0e1a26"; x.fillRect(0, 0, 256, 160); x.fillStyle = "#24364a"; x.fillRect(0, 0, 256, 14); x.strokeStyle = "#8cff9a"; x.lineWidth = 2; x.strokeRect(40, 40, 90, 70); x.strokeRect(150, 60, 70, 60); x.fillStyle = "#8cff9a"; x.fillRect(40, 28, 70, 12); x.fillRect(150, 48, 60, 12); x.fillStyle = "#07200c"; x.font = "bold 10px monospace"; x.fillText("sprekk 0.91", 43, 38); x.fillText("skade 0.77", 153, 58); x.fillStyle = "#6a8aa0"; for (let i = 0; i < 6; i++) x.fillRect(8, 120 + i * 6, 60 + (i * 37) % 80, 3); }
  const screenT = new THREE.CanvasTexture(screenC); screenT.colorSpace = THREE.SRGBColorSpace;
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.012), [toon(0x9a9aa0), toon(0x9a9aa0), toon(0x9a9aa0), toon(0x9a9aa0), new THREE.MeshBasicMaterial({ map: screenT }), toon(0x9a9aa0)]); lid.position.set(deskX, inner.y + 0.9, deskZ - 0.07); lid.rotation.x = -0.2; cabin.add(lid);
  const screenLight = new THREE.PointLight(0x7fb0ff, 0.6, 2.5, 2); screenLight.position.set(deskX, inner.y + 0.95, deskZ + 0.2); cabin.add(screenLight);
  for (let k = 0; k < 4; k++) { const sh = box(0.2, 0.004, 0.28, M.paper, deskX + 0.35 + rnd() * 0.3, inner.y + 0.78 + k * 0.004, deskZ + 0.1 + rnd() * 0.2, cabin); sh.rotation.y = rnd() * 0.6 - 0.3; }
  const lampBase = cyl(0.08, 0.02, M.iron, deskX - 0.55, inner.y + 0.79, deskZ - 0.15, "y", cabin); const lampArm = cyl(0.012, 0.5, M.iron, deskX - 0.5, inner.y + 1.02, deskZ - 0.1, "y", cabin); lampArm.rotation.z = -0.3;
  const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.14, 12, 1, true), new THREE.MeshToonMaterial({ color: 0x2a2a2e, gradientMap: ramp, side: THREE.DoubleSide })); lampShade.position.set(deskX - 0.4, inner.y + 1.24, deskZ - 0.05); lampShade.rotation.z = 0.5; cabin.add(lampShade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), M.window); bulb.position.set(deskX - 0.36, inner.y + 1.2, deskZ - 0.03); cabin.add(bulb);
  const lampLight = new THREE.PointLight(P.lamp, 3.0, 7, 2); lampLight.position.copy(bulb.position); lampLight.position.y -= 0.05; cabin.add(lampLight);
  // candle on the sill
  const candle = cyl(0.02, 0.1, M.paper, C.BWIN_X + 0.35, F + C.SILL + 0.05, -halfD + 0.2, "y", cabin); const flame = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5), M.ember); flame.position.set(candle.position.x, candle.position.y + 0.08, candle.position.z); cabin.add(flame);
  // chair
  box(0.45, 0.04, 0.45, M.wood, deskX, inner.y + 0.45, deskZ + 0.75, cabin); box(0.45, 0.5, 0.04, M.wood, deskX, inner.y + 0.72, deskZ + 0.97, cabin); for (const [dx, dz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) box(0.04, 0.45, 0.04, M.wood, deskX + dx, inner.y + 0.22, deskZ + 0.75 + dz, cabin);
  // stove with glowing door, pipe, kettle
  const stove = box(0.5, 0.8, 0.5, M.iron, inner.x1 - 0.5, inner.y + 0.55, inner.z0 + 0.5, cabin); hot(stove, "om", "Ovnen", "Om meg");
  for (const [dx, dz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) box(0.05, 0.15, 0.05, M.iron, inner.x1 - 0.5 + dx, inner.y + 0.08, inner.z0 + 0.5 + dz, cabin);
  const stoveGlass = box(0.22, 0.16, 0.02, M.ember, inner.x1 - 0.5, inner.y + 0.5, inner.z0 + 0.76, cabin); stoveGlass.castShadow = false;
  cyl(0.06, 1.5, M.iron, inner.x1 - 0.5, inner.y + 1.7, inner.z0 + 0.5, "y", cabin);
  const kettle = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), toon(0x7a5a3a)); kettle.position.set(inner.x1 - 0.5, inner.y + 1.05, inner.z0 + 0.5); kettle.scale.y = 0.8; kettle.castShadow = true; cabin.add(kettle);
  box(0.5, 0.05, 0.5, M.stone, inner.x1 - 0.5, inner.y + 0.0, inner.z0 + 0.5, cabin);
  // map on the right wall, with pins and a compass below
  const mapC = document.createElement("canvas"); mapC.width = 256; mapC.height = 200; { const x = mapC.getContext("2d"); x.fillStyle = "#e6dcc2"; x.fillRect(0, 0, 256, 200); x.strokeStyle = "#8a7a52"; x.lineWidth = 1.2; for (let i = 0; i < 9; i++) { x.beginPath(); for (let a = 0; a <= 6.3; a += 0.2) { const r = 20 + i * 11 + Math.sin(a * 3 + i) * 7; x.lineTo(120 + Math.cos(a) * r * 1.1, 100 + Math.sin(a) * r * 0.75); } x.closePath(); x.stroke(); } x.strokeStyle = "#3a6aa8"; x.lineWidth = 3; x.beginPath(); x.moveTo(0, 150); x.quadraticCurveTo(80, 130, 256, 170); x.stroke(); for (const [px, py] of [[70, 80], [150, 60], [200, 120], [40, 150]]) { x.fillStyle = "#d8402e"; x.beginPath(); x.arc(px, py, 5, 0, 7); x.fill(); } }
  const mapT = new THREE.CanvasTexture(mapC); mapT.colorSpace = THREE.SRGBColorSpace;
  const map = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7), new THREE.MeshToonMaterial({ map: mapT, gradientMap: ramp })); map.position.set(inner.x1 - 0.01, inner.y + 1.55, 0.3); map.rotation.y = -Math.PI / 2; cabin.add(map); hot(map, "retning", "Kartet", "Dit jeg er på vei");
  const compass = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.015, 16), toon(0xb8a060)); compass.position.set(inner.x1 - 0.02, inner.y + 1.05, 0.3); compass.rotation.z = Math.PI / 2; cabin.add(compass);
  // small table with the open guestbook
  box(0.6, 0.04, 0.6, M.wood, inner.x1 - 1.3, inner.y + 0.55, inner.z0 + 0.9, cabin); for (const [dx, dz] of [[-0.26, -0.26], [0.26, -0.26], [-0.26, 0.26], [0.26, 0.26]]) box(0.04, 0.55, 0.04, M.wood, inner.x1 - 1.3 + dx, inner.y + 0.275, inner.z0 + 0.9 + dz, cabin);
  const book = new THREE.Group(); book.position.set(inner.x1 - 1.3, inner.y + 0.575, inner.z0 + 0.9); book.rotation.y = 0.3; cabin.add(book);
  const bookCover = box(0.36, 0.025, 0.26, toon(0x4a2a1a), 0, 0, 0, book); hot(bookCover, "erfaring", "Hytteboka", "Erfaring"); for (const dx of [-0.085, 0.085]) { const pg = box(0.16, 0.004, 0.24, M.paper, dx, 0.016, 0, book); pg.rotation.z = dx < 0 ? 0.04 : -0.04; } cyl(0.005, 0.14, M.iron, 0.05, 0.025, 0.03, "x", book);
  // fishing gear by the door: net, waders drying, second rod
  const net = new THREE.Group(); net.position.set(inner.x1 - 0.35, inner.y, inner.z1 - 0.55); net.rotation.z = 0.12; cabin.add(net);
  const netHandle = cyl(0.015, 1.3, M.woodLight, 0, 0.65, 0, "y", net); hot(netHandle, "fritid", "Håven og vaderne", "Fritid");
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 6, 20), M.iron); ring.position.set(0, 1.45, 0); ring.rotation.x = 0.2; net.add(ring);
  const bag = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.35, 10, 1, true), new THREE.MeshToonMaterial({ color: 0x5a6a5a, gradientMap: ramp, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })); bag.position.set(0, 1.27, 0.04); bag.rotation.x = Math.PI; net.add(bag);
  for (const dx of [-0.08, 0.08]) cyl(0.07, 1.1, toon(0x3a4a3a), inner.x1 - 0.8 + dx, inner.y + 1.45, inner.z1 - 0.12, "y", cabin);
  box(0.4, 0.04, 0.04, M.wood, inner.x1 - 0.8, inner.y + 2.05, inner.z1 - 0.12, cabin);
  // armchair with blanket, mug
  const arm = new THREE.Group(); arm.position.set(inner.x0 + 0.9, inner.y, inner.z1 - 1.1); arm.rotation.y = 0.6; cabin.add(arm);
  box(0.8, 0.45, 0.8, M.cloth, 0, 0.225, 0, arm); box(0.8, 0.5, 0.2, M.cloth, 0, 0.7, -0.3, arm); box(0.15, 0.25, 0.8, M.cloth, -0.33, 0.57, 0, arm); box(0.15, 0.25, 0.8, M.cloth, 0.33, 0.57, 0, arm); box(0.5, 0.03, 0.6, toon(0x9a3a3a), 0.1, 0.46, 0.05, arm);
  // hook by the door inside: jacket, and the way out
  const hook = box(0.04, 0.3, 0.04, M.iron, C.DOOR_X + 0.7, F + 1.7, halfD - C.LOG - 0.04, cabin); hot(hook, "kontakt", "Døra bak deg", "Kontakt og ut", "exit"); box(0.35, 0.7, 0.12, toon(0x2f4e3a), C.DOOR_X + 0.7, F + 1.3, halfD - C.LOG - 0.1, cabin);
  const roomAmbient = new THREE.PointLight(0xffc080, 1.5, 9, 2); roomAmbient.position.set(0.3, F + 1.25, 0.2); cabin.add(roomAmbient);
  const stoveLight = new THREE.PointLight(P.fire, 1.8, 4, 2); stoveLight.position.set(inner.x1 - 0.5, inner.y + 0.55, inner.z0 + 0.95); cabin.add(stoveLight);

  /* ---------- outside props ---------- */
  const boat = new THREE.Group(); boat.position.set(-8.3, -0.75, 6.2); boat.rotation.y = 1.25; boat.rotation.z = 0.08; scene.add(boat);
  { const hullS = new THREE.Shape(); hullS.moveTo(-2.1, 0); hullS.quadraticCurveTo(0, 0.9, 2.1, 0); hullS.quadraticCurveTo(0, -0.9, -2.1, 0); const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(hullS, { depth: 0.5, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.05 }), M.wood); hull.rotation.x = -Math.PI / 2; hull.position.y = 0; hull.castShadow = hull.receiveShadow = true; boat.add(hull); hot(hull, "fritid", "Båten", "Fritid"); for (const x of [-0.8, 0.2, 1.0]) box(0.12, 0.04, 1.1, M.woodLight, x, 0.42, 0, boat); const oar = cyl(0.02, 2.2, M.woodLight, 0.3, 0.5, 0.3, "x", boat); oar.rotation.y = 0.3; }
  const fire = new THREE.Group(); fire.position.set(-4.5, 0.05, 6.5); scene.add(fire);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.17, 0), rockMat); s.position.set(Math.cos(a) * 0.6, 0.08, Math.sin(a) * 0.6); s.rotation.set(rnd(), rnd(), rnd()); s.castShadow = true; fire.add(s); }
  const logsM = cyl(0.07, 0.8, M.timber, 0, 0.12, 0, "x", fire); logsM.rotation.y = 0.6; hot(logsM, "om", "Bålet", "Om meg"); cyl(0.07, 0.8, M.timber, 0, 0.2, 0, "x", fire).rotation.y = -0.7;
  const flames = []; for (let i = 0; i < 3; i++) { const fl = new THREE.Mesh(new THREE.ConeGeometry(0.12 - i * 0.03, 0.4 - i * 0.08, 7), new THREE.MeshBasicMaterial({ color: [0xff6a20, 0xffa030, 0xfff0a0][i], transparent: true, opacity: 0.85 })); fl.position.set(0, 0.35, 0); fire.add(fl); flames.push(fl); }
  cyl(0.16, 1.5, M.timber, -1.5, 0.16, 1.0, "x", fire); cyl(0.16, 1.5, M.timber, 1.0, 0.16, -1.2, "z", fire);
  const stump = cyl(0.22, 0.4, M.timber, 1.4, 0.2, 0.9, "y", fire);
  // the tree with the trail camera, behind the cabin outside the back window
  const camTree = new THREE.Group(); camTree.position.set(C.BWIN_X - 0.9, 0, -halfD - 2.6); scene.add(camTree);
  cyl(0.14, 6, M.trunk, 0, 3, 0, "y", camTree); // the trail camera itself hangs inside, high on the wall by the door, pointed at the desk
  const camRig = new THREE.Group(); camRig.position.set(C.DOOR_X + 1.1, F + 2.05, halfD - 0.3); camRig.lookAt(C.BWIN_X + 0.2, F + 0.75, inner.z0 + 0.9); cabin.add(camRig);
  const camBox = box(0.14, 0.11, 0.09, toon(0x3a4a34), 0, 0, 0, camRig); camBox.name = "viltkamera"; const lens = new THREE.Mesh(new THREE.CircleGeometry(0.022, 10), new THREE.MeshBasicMaterial({ color: 0x1a2a3a })); lens.position.set(0, 0.01, 0.046); camRig.add(lens); const led = new THREE.Mesh(new THREE.SphereGeometry(0.007, 5, 4), new THREE.MeshBasicMaterial({ color: 0xff3030 })); led.position.set(0.045, 0.035, 0.046); camRig.add(led); box(0.03, 0.08, 0.03, M.iron, 0, 0.09, -0.02, camRig);
  for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(1.5 - k * 0.3, 2.2, 8), M.spruce); c.position.y = 4 + k * 1.3; c.castShadow = true; camTree.add(c); }

  /* ---------- forest, instanced ---------- */
  const treeCount = 150; const trunkI = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.2, 1, 6), M.trunk, treeCount); const tierI = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: ramp }), treeCount * 3);
  trunkI.castShadow = tierI.castShadow = true; tierI.receiveShadow = true;
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(); let n = 0, k = 0; const cA = new THREE.Color(P.spruce), cB = new THREE.Color(P.spruceLit), cc = new THREE.Color();
    while (n < treeCount) { const x = -40 + rnd() * 80, z = -40 + rnd() * 52; if (Math.abs(x) < 6.5 && z > -5.5 && z < 9) continue; if (x < -7.5) continue; if (z > 3 && x > 1.5 && x < 22) continue; if (z > 9 && x > -4) continue; if (Math.hypot(x - (C.BWIN_X - 0.9), z + halfD + 2.6) < 2.5) continue;
      const h = 6 + rnd() * 8; pos.set(x, 1, z); sc.set(1, 2.2, 1); m.compose(pos, q, sc); trunkI.setMatrixAt(n, m);
      for (let t = 0; t < 3; t++) { const r = (1.7 - t * 0.4) * (h / 9); pos.set(x, 2 + t * h * 0.22 + h * 0.22, z); sc.set(r, h * 0.42, r); m.compose(pos, q, sc); tierI.setMatrixAt(k, m); cc.copy(cA).lerp(cB, rnd() * 0.6 + (z > 0 ? 0.3 : 0)); tierI.setColorAt(k, cc); k++; }
      n++; }
    trunkI.instanceMatrix.needsUpdate = true; tierI.instanceMatrix.needsUpdate = true; tierI.instanceColor.needsUpdate = true; }
  scene.add(trunkI, tierI);
  // birches with banded bark
  const barkC = document.createElement("canvas"); barkC.width = 64; barkC.height = 256; { const x = barkC.getContext("2d"); x.fillStyle = "#e8e4da"; x.fillRect(0, 0, 64, 256); x.fillStyle = "#2a2622"; for (let i = 0; i < 26; i++) x.fillRect(rnd() * 50, rnd() * 250, 8 + rnd() * 20, 2 + rnd() * 3); }
  const barkT = new THREE.CanvasTexture(barkC); barkT.colorSpace = THREE.SRGBColorSpace; barkT.wrapS = barkT.wrapT = THREE.RepeatWrapping; barkT.repeat.set(2, 3);
  const barkM = new THREE.MeshToonMaterial({ map: barkT, gradientMap: ramp });
  for (const [x, z, h] of [[5.4, -3.6, 10], [7.2, -1.0, 11], [6.6, 1.9, 9], [-6.2, -6.5, 10], [4.2, -8, 12]]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, h, 8), barkM); t.position.set(x, h / 2, z); t.castShadow = true; scene.add(t); for (let k = 0; k < 4; k++) { const c = new THREE.Mesh(new THREE.SphereGeometry(1.0 + rnd() * 0.7, 8, 6), M.birchLeaf); c.position.set(x + (rnd() - 0.5) * 2, h * 0.75 + rnd() * 2.2, z + (rnd() - 0.5) * 2); c.castShadow = true; scene.add(c); } }
  // grass tufts and flowers in the clearing
  const grassN = 900; const grassI = new THREE.InstancedMesh(new THREE.ConeGeometry(0.05, 0.3, 4), new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: ramp }), grassN);
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), cc = new THREE.Color(); const a = new THREE.Color(0x4f8a34), b = new THREE.Color(0x8fc04e); let n = 0;
    while (n < grassN) { const x = -9 + rnd() * 20, z = -6 + rnd() * 16; if (Math.abs(x) < halfL + 0.3 && z > -halfD - 0.3 && z < halfD + C.PORCH + 0.5) continue; if (x < -8) continue; pos.set(x, 0.1, z); sc.set(0.8 + rnd() * 0.6, 0.5 + rnd() * 0.6, 0.8 + rnd() * 0.6); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6); m.compose(pos, q, sc); grassI.setMatrixAt(n, m); cc.copy(a).lerp(b, Math.max(0, 1 - Math.hypot(x + 1, z - 3) / 8) * rnd()); grassI.setColorAt(n, cc); n++; } grassI.instanceMatrix.needsUpdate = true; grassI.instanceColor.needsUpdate = true; }
  grassI.receiveShadow = true; scene.add(grassI);
  for (let i = 0; i < 36; i++) { const x = -8 + rnd() * 18, z = -5 + rnd() * 14; if (Math.abs(x) < halfL + 0.3 && z > -halfD - 0.3 && z < halfD + C.PORCH + 0.5) continue; const f = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 4), toon([0xd9c060, 0xd8d4c8, 0xb060b0, 0xc04a3a][i % 4])); f.position.set(x, 0.18, z); scene.add(f); }
  // bushes near the walls
  for (const [x, z, r] of [[-3.6, 3.2, 0.7], [-3.9, 2.2, 0.5], [3.8, 3.0, 0.6], [4.2, -2.6, 0.8], [-3.5, -3.3, 0.6]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), toon(0x3f7a38)); b.position.set(x, r * 0.6, z); b.castShadow = true; scene.add(b); }

  /* ---------- particles ---------- */
  function softDot(size, col) { const c = document.createElement("canvas"); c.width = c.height = size; const x = c.getContext("2d"); const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); g.addColorStop(0, col + "ff"); g.addColorStop(0.4, col + "88"); g.addColorStop(1, col + "00"); x.fillStyle = g; x.fillRect(0, 0, size, size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
  const flyN = 40, flyG = new THREE.BufferGeometry(), flyP = new Float32Array(flyN * 3), flyB = []; for (let i = 0; i < flyN; i++) { let fx = -8 + rnd() * 14, fz = -3 + rnd() * 12; while (Math.abs(fx) < halfL + 1 && fz > -halfD - 1 && fz < halfD + C.PORCH + 1) { fx = -8 + rnd() * 14; fz = -3 + rnd() * 12; } flyP[i * 3] = fx; flyP[i * 3 + 1] = 0.3 + rnd() * 1.6; flyP[i * 3 + 2] = fz; flyB.push({ x: flyP[i * 3], y: flyP[i * 3 + 1], z: flyP[i * 3 + 2], p: rnd() * 6.3, s: 0.4 + rnd() }); }
  flyG.setAttribute("position", new THREE.BufferAttribute(flyP, 3)); const flies = new THREE.Points(flyG, new THREE.PointsMaterial({ size: 0.22, map: softDot(32, "#fff6a0"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xfff2a0 })); scene.add(flies);
  const smokeT = softDot(64, "#c8ccd4"); const smoke = []; for (let i = 0; i < 18; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeT, transparent: true, opacity: 0, depthWrite: false })); s.position.copy(chimneyTop); scene.add(s); smoke.push({ s, a: i / 18 * 7, life: 7, dx: rnd() }); }
  const emberN = 60, emberG = new THREE.BufferGeometry(), emberP = new Float32Array(emberN * 3), emberB = []; for (let i = 0; i < emberN; i++) emberB.push({ a: rnd() * 2, life: 1.2 + rnd(), x: (rnd() - .5) * .3, z: (rnd() - .5) * .3, vy: 0.8 + rnd() * 0.8 });
  emberG.setAttribute("position", new THREE.BufferAttribute(emberP, 3)); const embers = new THREE.Points(emberG, new THREE.PointsMaterial({ size: 0.07, map: softDot(16, "#ffb040"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffa040 })); embers.position.copy(fire.position); scene.add(embers);
  const dustN = 60, dustG = new THREE.BufferGeometry(), dustP = new Float32Array(dustN * 3), dustB = []; for (let i = 0; i < dustN; i++) dustB.push({ x: deskX - 0.9 + rnd() * 1.4, y: inner.y + 0.8 + rnd() * 0.9, z: deskZ - 0.3 + rnd() * 0.9, p: rnd() * 6 });
  dustG.setAttribute("position", new THREE.BufferAttribute(dustP, 3)); const dust = new THREE.Points(dustG, new THREE.PointsMaterial({ size: 0.02, map: softDot(16, "#ffe0b0"), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })); cabin.add(dust);

  /* ---------- lights ---------- */
  const hemi = new THREE.HemisphereLight(0x6f8fd0, 0x243a20, 0.7); scene.add(hemi);
  const moon = new THREE.DirectionalLight(P.moon, 0.9); moon.position.set(-30, 36, -40); moon.castShadow = true; moon.shadow.mapSize.set(lite ? 1024 : 2048, lite ? 1024 : 2048); Object.assign(moon.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 120 }); moon.shadow.bias = -0.0008; scene.add(moon);
  const winLight = new THREE.PointLight(P.lamp, 7, 10, 2); winLight.position.set(C.WIN_X, F + 1.5, halfD + 0.5); winLight.castShadow = !lite; winLight.shadow.mapSize.set(512, 512); scene.add(winLight);
  const doorLight = new THREE.PointLight(P.lamp, 3.5, 7, 2); doorLight.position.set(C.DOOR_X + 0.6, F + 1.9, halfD + 0.5); scene.add(doorLight);
  const sideLight = new THREE.PointLight(P.lamp, 2.5, 6, 2); sideLight.position.set(halfL + 0.4, F + 1.4, -0.6); scene.add(sideLight);
  const fireLight = new THREE.PointLight(P.fire, 9, 10, 2); fireLight.position.set(fire.position.x, 0.7, fire.position.z); fireLight.castShadow = !lite; fireLight.shadow.mapSize.set(512, 512); scene.add(fireLight);

  /* ---------- post ---------- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.6, 0.86); composer.addPass(bloom);
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, t: { value: 0 }, grain: { value: 0.035 }, vig: { value: 0.32 }, night: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float t, grain, vig, night; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p + t, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){ vec4 c = texture2D(tDiffuse, vUv);
        vec3 col = c.rgb; col = mix(col, col * vec3(1.02, 0.98, 0.94) + vec3(0.0, 0.01, 0.03), 0.4);
        float n = hash(vUv * 900.0) - 0.5; col += n * grain;
        vec2 d = vUv - 0.5; col *= 1.0 - dot(d, d) * vig * 2.0;
        if (night > 0.0) { float g = dot(col, vec3(0.3, 0.59, 0.11)); vec3 nv = vec3(g * 0.2, g * 1.3 + 0.04, g * 0.3) + 0.04 * sin(vUv.y * 600.0 + t * 20.0); col = mix(col, nv, night); }
        gl_FragColor = vec4(col, c.a); }`
  }); composer.addPass(grade);
  composer.addPass(new OutputPass());

  /* ---------- camera rig ---------- */
  const VIEW = {
    ext: { pos: new THREE.Vector3(9.0, 3.4, 15.5), look: new THREE.Vector3(-2.4, 1.0, 1.5) },
    porch: { pos: new THREE.Vector3(C.DOOR_X + 0.1, F + 1.55, halfD + C.PORCH + 2.6), look: new THREE.Vector3(C.DOOR_X, F + 1.3, halfD) },
    doorway: { pos: new THREE.Vector3(C.DOOR_X, F + 1.55, halfD + 0.9), look: new THREE.Vector3(-0.6, F + 1.2, -1.5) },
    int: { pos: new THREE.Vector3(C.DOOR_X - 0.2, F + 1.55, halfD - 0.7), look: new THREE.Vector3(-0.8, F + 1.1, -1.8) }
  };
  camera.position.copy(VIEW.ext.pos); camera.lookAt(VIEW.ext.look);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(VIEW.ext.look); controls.enablePan = false; controls.enableZoom = true; controls.minDistance = 8; controls.maxDistance = 24; controls.minPolarAngle = 0.95; controls.maxPolarAngle = 1.45; controls.minAzimuthAngle = -0.3; controls.maxAzimuthAngle = 1.3; controls.enableDamping = true; controls.dampingFactor = 0.06;
  const state = { where: "ext", busy: false, look: VIEW.ext.look.clone(), mouse: [0, 0], t: 0, night: 0 };
  let lookBase = null;
  function tour(where) {
    const gsap = window.gsap; if (!gsap || state.busy) return Promise.resolve();
    state.busy = true; controls.enabled = false;
    const tl = gsap.timeline();
    const cur = { px: camera.position.x, py: camera.position.y, pz: camera.position.z, lx: state.look.x, ly: state.look.y, lz: state.look.z, fov: camera.fov };
    tl.to(cur, { fov: where === "int" ? 62 : 42, duration: where === "int" ? 2.2 : 1.6, ease: "power1.inOut", onUpdate() { camera.fov = cur.fov; camera.updateProjectionMatrix(); } }, where === "int" ? 1.6 : 1.2);
    const go = (v, d, e, at) => tl.to(cur, { px: v.pos.x, py: v.pos.y, pz: v.pos.z, lx: v.look.x, ly: v.look.y, lz: v.look.z, duration: d, ease: e, onUpdate() { camera.position.set(cur.px, cur.py, cur.pz); state.look.set(cur.lx, cur.ly, cur.lz); camera.lookAt(state.look); } }, at);
    if (where === "int") { go(VIEW.porch, 1.6, "power2.inOut", 0); tl.to(door.rotation, { y: -1.75, duration: 1.1, ease: "power2.out" }, 1.2); go(VIEW.doorway, 1.3, "power1.inOut", 1.5); go(VIEW.int, 1.2, "power2.out", 2.7); }
    else { go(VIEW.doorway, 1.0, "power2.in", 0); go(VIEW.porch, 1.2, "power1.inOut", 0.9); tl.to(door.rotation, { y: 0, duration: 0.9, ease: "power2.inOut" }, 1.4); go(VIEW.ext, 1.8, "power2.inOut", 2.0); }
    return new Promise(res => tl.eventCallback("onComplete", () => { state.where = where; state.busy = false; lookBase = state.look.clone(); if (where === "ext") { controls.target.copy(VIEW.ext.look); controls.enabled = true; } res(); }));
  }

  /* ---------- picking ---------- */
  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
  function isInside(o) { if (o === doorLeaf) return false; const p = new THREE.Vector3(); o.getWorldPosition(p); return Math.abs(p.x) < halfL && Math.abs(p.z) < halfD - 0.05 && p.y > F; }
  function pick(px, py, w, h) {
    ndc.set(px / w * 2 - 1, -(py / h) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(hotspots, false); if (!hits.length) return null; const o = hits[0].object; const inside = isInside(o);
    if (state.where === "ext" && inside) return null; if (state.where === "int" && !inside) return null; return o;
  }
  function project(obj, w, h) { const v = new THREE.Vector3(); obj.getWorldPosition(v); v.project(camera); return [(v.x + 1) / 2 * w, (1 - v.y) / 2 * h, v.z < 1]; }

  /* ---------- trail camera on the tree, looking at the cabin ---------- */
  const trailCam = new THREE.PerspectiveCamera(50, 4 / 3, 0.1, 60); trailCam.position.set(C.DOOR_X + 1.1, F + 2.05, halfD - 0.3); trailCam.lookAt(C.BWIN_X + 0.2, F + 0.75, inner.z0 + 0.9);
  const trailRT = new THREE.WebGLRenderTarget(640, 480);
  const irFlash = new THREE.PointLight(0xffffff, 1.2, 12, 1.6); irFlash.visible = false; scene.add(irFlash);
  function snapshot() {
    irFlash.position.copy(trailCam.position); irFlash.visible = true; const fogD = scene.fog.density; scene.fog.density = 0.004;
    renderer.setRenderTarget(trailRT); renderer.render(scene, trailCam); renderer.setRenderTarget(null); irFlash.visible = false; scene.fog.density = fogD;
    const buf = new Uint8Array(640 * 480 * 4); renderer.readRenderTargetPixels(trailRT, 0, 0, 640, 480, buf);
    const c = document.createElement("canvas"); c.width = 640; c.height = 480; const x = c.getContext("2d"); const im = x.createImageData(640, 480);
    for (let y = 0; y < 480; y++) im.data.set(buf.subarray((479 - y) * 2560, (480 - y) * 2560), y * 2560); x.putImageData(im, 0, 0); return c;
  }

  /* ---------- frame ---------- */
  let W = 1, H = 1;
  function resize(w, h) { W = w; H = h; renderer.setSize(w, h, false); composer.setSize(w * renderer.getPixelRatio(), h * renderer.getPixelRatio()); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function frame(dt) {
    state.t += dt; const t = state.t;
    sky.material.uniforms.t.value = t; waterMat.uniforms.t.value = t; waterMat.uniforms.cam.value.copy(camera.position); grade.uniforms.t.value = t % 10; grade.uniforms.night.value = state.night;
    fireLight.intensity = 8 + Math.sin(t * 11) * 1.4 + Math.sin(t * 23) * 1.0 + Math.sin(t * 5.3) * 0.8;
    stoveLight.intensity = 1.6 + Math.sin(t * 9) * 0.4; lampLight.intensity = 3.0 + Math.sin(t * 40) * 0.03;
    flames.forEach((f, i) => { f.scale.set(1 + Math.sin(t * 13 + i) * 0.15, 1 + Math.sin(t * 9 + i * 2) * 0.25, 1); f.rotation.y = t * 2 + i; f.position.y = 0.35 + i * 0.05 + Math.sin(t * 7 + i) * 0.03; });
    flame.scale.setScalar(1 + Math.sin(t * 30) * 0.2);
    if (!reduce) {
      for (let i = 0; i < flyN; i++) { const b = flyB[i]; flyP[i * 3] = b.x + Math.sin(t * 0.5 * b.s + b.p) * 0.6; flyP[i * 3 + 1] = b.y + Math.sin(t * 0.8 * b.s + b.p * 2) * 0.25; flyP[i * 3 + 2] = b.z + Math.cos(t * 0.4 * b.s + b.p) * 0.6; } flyG.attributes.position.needsUpdate = true; flies.material.opacity = 0.6 + 0.4 * Math.sin(t * 2);
      for (const s of smoke) { s.a += dt; if (s.a > s.life) { s.a = 0; s.dx = rnd(); } const k = s.a / s.life; s.s.position.set(chimneyTop.x + k * 1.6 + Math.sin(s.a * 1.2 + s.dx * 6) * 0.3, chimneyTop.y + k * 4.5, chimneyTop.z + k * 0.4); const sz = 0.35 + k * 2.2; s.s.scale.set(sz, sz, 1); s.s.material.opacity = (1 - k) * 0.28 * Math.min(1, s.a * 2); }
      for (let i = 0; i < emberN; i++) { const b = emberB[i]; b.a += dt; if (b.a > b.life) { b.a = 0; b.x = (rnd() - .5) * .3; b.z = (rnd() - .5) * .3; } emberP[i * 3] = b.x + Math.sin(b.a * 6 + i) * 0.08; emberP[i * 3 + 1] = 0.3 + b.a * b.vy; emberP[i * 3 + 2] = b.z; } emberG.attributes.position.needsUpdate = true;
      for (let i = 0; i < dustN; i++) { const b = dustB[i]; dustP[i * 3] = b.x + Math.sin(t * 0.3 + b.p) * 0.08; dustP[i * 3 + 1] = b.y + Math.sin(t * 0.2 + b.p * 2) * 0.06; dustP[i * 3 + 2] = b.z + Math.cos(t * 0.25 + b.p) * 0.08; } dustG.attributes.position.needsUpdate = true;
    }
    if (!state.busy) { if (state.where === "ext") controls.update(); else if (lookBase) { const l = lookBase.clone(); l.x += state.mouse[0] * 1.2; l.y += -state.mouse[1] * 0.6; state.look.lerp(l, 0.08); camera.lookAt(state.look); } }
    composer.render();
  }
  return { info: renderer.info, scene, camera, renderer, controls, hotspots, state, tour, pick, project, frame, resize, snapshot, door, VIEW, C, trailCam, grade };
}
