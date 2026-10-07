/* Real-time 3D for the portfolio.
   - #wall: the studio wall of screens (home). Each screen is a project; clicking the wall
     (the cursor is the remote there) powers it on, a phone opens the studio line.
   - [data-turntable]: a draggable turntable on each project page.
   Every object is a placeholder built from primitives. To swap in a real model, put a .glb in
   assets/models/ and name it in MODELS inside build/build.py (see README.md). */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const D = window.DATA;
const S = window.SITE || {};
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
const G = window.gsap;
const IMG = i => 'assets/img/' + D.images[i].k + '.jpg';
const proj = id => D.projects.find(p => p.id === id);
const lerp = (a, b, t) => a + (b - a) * t;
const loader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();

/* ------------------------------------------------------------------ shared */
function makeRenderer(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(devicePixelRatio, 2));
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.02;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  return r;
}
function addEnvironment(r, scene, intensity = .55) {
  const pm = new THREE.PMREMGenerator(r);
  scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = intensity;
  pm.dispose();
}
const MAT = {
  white: () => new THREE.MeshStandardMaterial({ color: 0xf1f0ec, roughness: .36 }),
  black: () => new THREE.MeshStandardMaterial({ color: 0x151515, roughness: .4, metalness: .1 }),
  grey: () => new THREE.MeshStandardMaterial({ color: 0x80807e, roughness: .48, metalness: .15 }),
  chrome: () => new THREE.MeshStandardMaterial({ color: 0xdadada, roughness: .2, metalness: .95 }),
  bezel: () => new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: .55 }),
  clay: () => new THREE.MeshStandardMaterial({ color: 0xe9e6e0, roughness: .82 }),
};
function shadowCatcher(w, h, opacity) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.ShadowMaterial({ opacity }));
  m.receiveShadow = true;
  return m;
}
/* fit any object into a box of the given size, sitting on y = 0 */
function fitInto(obj, w, h, d) {
  const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3());
  const s = Math.min(w / size.x, h / size.y, d / size.z);
  obj.scale.multiplyScalar(s);
  const b2 = new THREE.Box3().setFromObject(obj), c = b2.getCenter(new THREE.Vector3());
  obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= b2.min.y;
}
function shadowsOn(obj) { obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); }

/* ------------------------------------------------------------------ CRT screen shader */
const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const FRAG = `
uniform sampler2D uMap; uniform float uHasMap, uTime, uOn, uHover, uImgAspect, uScrAspect, uSeed;
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float rbox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
void main(){
  vec2 c = vUv - .5;
  vec2 ar = vec2(uScrAspect, 1.);
  vec3 col = vec3(.02);
  if (rbox(c * ar, ar * .5 - .012, .08) <= 0.) {
  vec2 uv = .5 + c * (1. + .09 * dot(c, c));
  vec2 st = uv;
  float k = uScrAspect / uImgAspect;
  if (k < 1.) st.x = (st.x - .5) * k + .5; else st.y = (st.y - .5) / k + .5;
  vec3 pic = uHasMap > .5 ? texture2D(uMap, clamp(st, 0., 1.)).rgb : vec3(.08);
  vec2 g = floor(uv * vec2(230., 172.));
  float n = h(g + floor(uTime * 28.) * 17.3 + uSeed);
  vec3 stat = vec3(n * .62 + .1 + .05 * sin(uv.y * 8. + uTime * 5.));
  stat *= .82 + .22 * step(.5, fract(uv.x * 3.5 + .25));
  float open = smoothstep(0., 1., uOn), on = step(.001, uOn);
  float band = 1. - smoothstep(open * .56 - .012, open * .56 + .012, abs(uv.y - .5));
  col = mix(stat, pic, band * on);
  col += (1. - smoothstep(0., .018, abs(abs(uv.y - .5) - open * .56))) * (1. - open) * on * 1.6;
  col *= .93 + .07 * sin(uv.y * 820.);
  col *= mix(1., smoothstep(.95, .2, length(c * vec2(1., 1.1))), .55);
  col *= 1. + uHover * .2;
  }
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}`;
function screenMaterial(scrAspect, seed) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, toneMapped: false,
    uniforms: {
      uMap: { value: null }, uHasMap: { value: 0 }, uTime: { value: 0 }, uOn: { value: 0 }, uHover: { value: 0 },
      uImgAspect: { value: 1.6 }, uScrAspect: { value: scrAspect }, uSeed: { value: seed },
    },
  });
}
const texCache = new Map();
function loadTex(url) {
  if (!texCache.has(url)) texCache.set(url, new Promise(res => texLoader.load(url, t => {
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; res(t);
  }, undefined, () => res(null))));
  return texCache.get(url);
}

/* ================================================================== the wall */
const UNITS = [
  { key: 'trapani', x: -1.67, y: 0, w: 1.5, h: 1.0, d: 1.0, body: 'black', panel: true },
  { key: 'moonshot', x: -.13, y: 0, w: 1.5, h: 1.0, d: .95, body: 'grey', panel: true },
  { key: 'casa', x: 1.46, y: 0, w: 1.6, h: 1.0, d: 1.0, body: 'white', panel: true },
  { key: 'os', x: -1.15, y: 1.0, w: 2.1, h: 1.44, d: 1.1, body: 'white', panel: true },
  { key: 'mideast', x: .65, y: 1.0, w: 1.3, h: .72, d: .85, body: 'grey', panel: true },
  { key: 'props', x: 1.85, y: 1.0, w: .82, h: .62, d: .7, body: 'chrome', panel: false },
];

function buildUnit(u, n) {
  const g = new THREE.Group();
  const placeholder = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(u.w, u.h, u.d, 4, Math.min(.07, u.h * .09)), MAT[u.body]());
  body.position.y = u.h / 2;
  placeholder.add(body);
  const panelW = u.panel ? Math.min(u.w * .25, .44) : 0;
  const sw = (u.w - panelW) * .84, sh = u.h * .74;
  const sx = -u.w / 2 + (u.w - panelW) / 2 + (u.panel ? .02 : 0);
  const bez = new THREE.Mesh(new RoundedBoxGeometry(sw + .08, sh + .08, .04, 2, .018), MAT.bezel());
  bez.position.set(sx, u.h / 2, u.d / 2 - .004);
  placeholder.add(bez);
  if (u.panel) {
    const px = u.w / 2 - panelW / 2 - .02, knobMat = u.body === 'black' ? MAT.chrome() : MAT.black();
    [.72, .48].forEach(f => {
      const k = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(.065, panelW * .22), Math.min(.065, panelW * .22), .07, 28), knobMat);
      k.rotation.x = Math.PI / 2; k.position.set(px, u.h * f, u.d / 2 + .03);
      placeholder.add(k);
    });
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(panelW * .6, .012, .01), MAT.bezel());
      s.position.set(px, u.h * (.3 - i * .045), u.d / 2 + .002);
      placeholder.add(s);
    }
  }
  if (u.antenna) {
    [-.42, .42].forEach(a => {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(.007, .007, .62, 8), MAT.chrome());
      rod.geometry.translate(0, .31, 0);
      rod.position.set(0, u.h, -.05); rod.rotation.z = a;
      const tip = new THREE.Mesh(new THREE.SphereGeometry(.018, 12, 8), MAT.chrome());
      tip.position.set(0, .62, 0); rod.add(tip);
      placeholder.add(rod);
    });
  }
  shadowsOn(placeholder);
  g.add(placeholder);
  const mat = screenMaterial(sw / sh, n * 7.31);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), mat);
  scr.position.set(sx, u.h / 2, u.d / 2 + .018);
  g.add(scr);
  g.position.set(u.x, u.y, 0);
  return { ...u, g, placeholder, scr, mat, sw, sh, z: 0, hz: 0 };
}

function buildPhone() {
  const g = new THREE.Group(), black = MAT.black(), white = MAT.white();
  const base = new THREE.Mesh(new RoundedBoxGeometry(.46, .86, .14, 3, .05), black);
  g.add(base);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
    const k = new THREE.Mesh(new RoundedBoxGeometry(.075, .058, .03, 2, .012), white);
    k.position.set(.02 + c * .095 - .08, .16 - r * .085, .08);
    g.add(k);
  }
  const handset = new THREE.Group();
  const bar = new THREE.Mesh(new RoundedBoxGeometry(.085, .58, .085, 2, .03), black);
  const ear = new THREE.Mesh(new RoundedBoxGeometry(.15, .17, .13, 3, .05), black);
  const mouth = ear.clone();
  ear.position.y = .29; mouth.position.y = -.29;
  handset.add(bar, ear, mouth);
  handset.position.set(-.19, .02, .16);
  g.add(handset);
  const pts = [];
  for (let i = 0; i <= 160; i++) {
    const t = i / 160, a = t * Math.PI * 2 * 11;
    const cx = lerp(-.19, -.02, t), cy = -.38 - Math.sin(t * Math.PI) * .28, cz = .12 - t * .06;
    pts.push(new THREE.Vector3(cx + Math.cos(a) * .028, cy, cz + Math.sin(a) * .028));
  }
  const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 480, .007, 6), black);
  g.add(cord);
  shadowsOn(g);
  return { g, handset };
}

function initWall(root) {
  const canvas = root.querySelector('canvas');
  let renderer;
  try { renderer = makeRenderer(canvas); } catch (e) { return; }
  root.classList.add('is-3d');
  const scene = new THREE.Scene();
  addEnvironment(renderer, scene, .5);
  const camera = new THREE.PerspectiveCamera(28, 1, .1, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d6d0, .9));
  const key = new THREE.DirectionalLight(0xffffff, 2.3);
  key.position.set(-4, 7, 6); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -3, near: 1, far: 25 });
  key.shadow.bias = -.0004; key.shadow.normalBias = .02; key.shadow.radius = 5;
  scene.add(key);
  const floor = shadowCatcher(30, 30, .16); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const wall = shadowCatcher(30, 20, .08); wall.position.z = -.62; scene.add(wall);

  /* Rohit's signature sits on a flat layer behind the canvas: framed to the set on every resize,
     but it never moves with the mouse */
  const sigEl = root.querySelector('.wall-sig');
  const SIG_RECT = { x0: -3.9, x1: 3.7, y0: -.53, y1: 4.09, z: -.6 };
  const units = UNITS.map((u, n) => buildUnit(u, n));
  units.forEach(u => scene.add(u.g));
  const phone = buildPhone(); phone.g.position.set(1.9, 2.36, -.55); scene.add(phone.g);

  /* what each screen shows */
  const pick = [];
  units.forEach(u => {
    const p = proj(u.key);
    if (p) {
      u.href = p.file; u.label = `${String(D.projects.indexOf(p) + 1).padStart(2, '0')} · ${p.name}`;
      u.album = p.album_i; u.idx = 0; u.hero = IMG(p.album_i[0]);
      setPicture(u, p.album_i[0]);
    } else if (u.key === 'os') {
      u.href = 'os.html'; u.label = 'RohitOS: click to enter'; u.boot = true; osScreen(u);
    }
    u.g.traverse(o => { if (o.isMesh) { o.userData.unit = u; pick.push(o); } });
  });
  phone.g.traverse(o => { if (o.isMesh) { o.userData.phone = true; pick.push(o); } });

  function setPicture(u, i) {
    return loadTex(IMG(i)).then(t => {
      if (!t) return;
      u.mat.uniforms.uMap.value = t; u.mat.uniforms.uHasMap.value = 1;
      u.mat.uniforms.uImgAspect.value = D.images[i].w / D.images[i].h;
    });
  }
  function osScreen(u) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 / (u.sw / u.sh));
    const draw = () => {
      const x = c.getContext('2d'), W = c.width, H = c.height;
      x.fillStyle = '#efefec'; x.fillRect(0, 0, W, H);
      for (let y = 0; y < H; y += 4) { x.fillStyle = 'rgba(0,0,0,.035)'; x.fillRect(0, y, W, 1); }
      x.fillStyle = '#0a0a0a'; x.textAlign = 'center';
      x.font = `${Math.round(H * .17)}px Marcellus, Georgia, serif`;
      x.fillText('WELCOME', W / 2, H * .42);
      x.font = `${Math.round(H * .055)}px "PT Serif", Georgia, serif`;
      x.fillText('T O   R O H I T O S', W / 2, H * .55);
      const bw = W * .36, bh = H * .13, bx = (W - bw) / 2, by = H * .64;
      x.fillRect(bx, by, bw, bh);
      x.fillStyle = '#efefec'; x.font = `${Math.round(H * .05)}px "PT Serif", Georgia, serif`;
      x.fillText('▸  CLICK TO ENTER', W / 2, by + bh * .64);
      t.needsUpdate = true;
    };
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    draw(); document.fonts && document.fonts.ready.then(draw);
    u.mat.uniforms.uMap.value = t; u.mat.uniforms.uHasMap.value = 1; u.mat.uniforms.uImgAspect.value = c.width / c.height;
  }

  /* swap in real models when they are named in MODELS */
  const M = (D.models && D.models.wall) || {};
  units.forEach(u => {
    if (!M[u.key]) return;
    loader.load(M[u.key], gltf => {
      const m = gltf.scene; fitInto(m, u.w, u.h, u.d); m.position.z += 0; shadowsOn(m);
      let screenMesh = null;
      m.traverse(o => { if (o.isMesh && /screen/i.test(o.name)) screenMesh = o; });
      if (screenMesh) { screenMesh.material = u.mat; u.scr.visible = false; }
      u.placeholder.visible = false; u.g.add(m);
      m.traverse(o => { if (o.isMesh) { o.userData.unit = u; pick.push(o); } });
    }, undefined, () => {});
  });
  if (M.phone) loader.load(M.phone, gltf => {
    const m = gltf.scene; fitInto(m, .5, .9, .2); shadowsOn(m);
    phone.g.children.forEach(c => { c.visible = false; }); phone.g.add(m);
    m.traverse(o => { if (o.isMesh) { o.userData.phone = true; pick.push(o); } });
  }, undefined, () => {});

  /* the sticker that rides on the phone */
  const stickers = [...root.querySelectorAll('[data-anchor]')];
  const anchors = { phone: new THREE.Vector3(.2, .5, .1) };
  const anchorObj = { phone: phone.g };

  /* camera: frame the whole set, lean toward the pointer */
  const look = new THREE.Vector3(-.1, 1.7, 0), base = new THREE.Vector3(), cam = new THREE.Vector3();
  let fitDist = 9;
  function fit() {
    const w = root.clientWidth, h = root.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const halfH = 2.62, halfW = 3.95;
    fitDist = Math.max(halfH / t, halfW / (t * camera.aspect)) * 1.04;
    base.set(-.1, 1.95, fitDist);
    if (!opening) cam.copy(base);
    if (sigEl) {
      camera.position.copy(base); camera.lookAt(look); camera.updateMatrixWorld();
      const a = new THREE.Vector3(SIG_RECT.x0, SIG_RECT.y1, SIG_RECT.z).project(camera);
      const b = new THREE.Vector3(SIG_RECT.x1, SIG_RECT.y0, SIG_RECT.z).project(camera);
      const L = (a.x + 1) / 2 * w, T = (1 - a.y) / 2 * h, R = (b.x + 1) / 2 * w, Bm = (1 - b.y) / 2 * h;
      Object.assign(sigEl.style, { left: L + 'px', top: T + 'px', width: (R - L) + 'px', height: (Bm - T) + 'px' });
    }
    camera.position.copy(cam); camera.lookAt(look); renderer.render(scene, camera);   /* a resize clears the canvas */
  }
  new ResizeObserver(fit).observe(root);

  /* power, channels, hover, open */
  let power = false, opening = false, hovered = null, chBusy = false;
  const ptr = new THREE.Vector2(-9, -9), ndc = new THREE.Vector2(0, 0), ray = new THREE.Raycaster();
  function setPower(on) {
    power = on;
    root.classList.toggle('is-on', on);
    units.forEach((u, i) => {
      const delay = on ? .1 + Math.random() * .7 : Math.random() * .3;
      if (G) G.to(u.mat.uniforms.uOn, { value: on ? 1 : 0, duration: on ? .7 : .35, delay, ease: on ? 'power2.out' : 'power2.in' });
      else u.mat.uniforms.uOn.value = on ? 1 : 0;
      if (u.video) on ? u.video.play().catch(() => {}) : u.video.pause();
    });
    S.onPower && S.onPower(on);
  }
  function channel() {
    if (!power) return setPower(true);
    if (chBusy) return; chBusy = true;
    units.forEach((u, i) => {
      if (!u.album || u.album.length < 2) return;
      u.idx = (u.idx + 1) % u.album.length;
      const next = u.album[u.idx];
      const done = setPicture.bind(null, u, next);
      if (G) G.timeline({ delay: i * .04 })
        .to(u.mat.uniforms.uOn, { value: .08, duration: .16, ease: 'power2.in', onComplete: done })
        .to(u.mat.uniforms.uOn, { value: 1, duration: .45, ease: 'power2.out', delay: .12 });
      else done();
    });
    setTimeout(() => { chBusy = false; }, 900);
  }
  function openUnit(u) {
    if (opening) return;
    opening = true;
    const target = new THREE.Vector3(); u.scr.getWorldPosition(target);
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max((u.sh / 2) / t, (u.sw / 2) / (t * camera.aspect)) * .92;
    const go = () => S.go ? S.go(u.href, u.hero ? { img: u.hero, pos: '50% 50%' } : u.boot ? { color: '#0a0a0a' } : {}) : (location.href = u.href);
    if (!G || RM) return go();
    G.to(cam, { x: target.x, y: target.y, z: target.z + dist, duration: 1.15, ease: 'expo.inOut' });
    G.to(look, { x: target.x, y: target.y, z: target.z, duration: 1.15, ease: 'expo.inOut', onComplete: go });
  }
  S.wall = { setPower, channel, isOn: () => power };

  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  });
  let lastTip = null;
  canvas.addEventListener('pointerleave', () => { ptr.set(-9, -9); lastTip = null; S.tip && S.tip(null); });
  let down = null;
  canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObjects(pick, false)[0];
    S.remoteClick && S.remoteClick();
    if (!hit) return power ? channel() : setPower(true);
    const o = hit.object;
    if (o.userData.phone) {
      if (G) G.timeline().to(phone.handset.position, { y: .2, z: .32, duration: .35, ease: 'power3.out' })
        .to(phone.handset.rotation, { z: -.35, duration: .35, ease: 'power3.out' }, 0)
        .to(phone.handset.position, { y: .02, z: .16, duration: .6, ease: 'power3.inOut', delay: 1.4 })
        .to(phone.handset.rotation, { z: 0, duration: .6, ease: 'power3.inOut' }, '<');
      return S.openBoard && S.openBoard();
    }
    const u = o.userData.unit;
    if (u) power ? openUnit(u) : setPower(true);
  });

  /* render only while the wall is on screen */
  let visible = true;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0 }).observe(root);
  const lean = { x: 0, y: 0 };
  const clock = new THREE.Clock();
  const v3 = new THREE.Vector3();
  function frame() {
    requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    const time = clock.getElapsedTime();
    /* hover */
    let hit = null;
    if (!opening && ptr.x > -2) { ray.setFromCamera(ptr, camera); hit = ray.intersectObjects(pick, false)[0] || null; }
    const o = hit && hit.object, hu = o && o.userData.unit;
    if (hu !== hovered) hovered = hu;
    if (ptr.x > -2) {
      const tip = hu ? (power ? hu.label : 'Click to switch the screens on') : o && o.userData.phone ? 'Studio line'
        : power ? 'Click: next channel' : 'Click: power on';
      if (tip !== lastTip) { lastTip = tip; S.tip && S.tip(tip); }
    }
    units.forEach(u => {
      u.hz = lerp(u.hz, u === hovered && !opening ? .12 : 0, .12);
      u.g.position.z = u.hz;
      u.mat.uniforms.uHover.value = lerp(u.mat.uniforms.uHover.value, u === hovered ? 1 : 0, .15);
      u.mat.uniforms.uTime.value = time;
    });
    /* camera lean */
    if (!opening) {
      const tx = FINE && ptr.x > -2 ? ptr.x : 0, ty = FINE && ptr.y > -2 ? ptr.y : 0;
      lean.x = lerp(lean.x, RM ? 0 : tx, .04); lean.y = lerp(lean.y, RM ? 0 : ty, .04);
      cam.set(base.x + lean.x * .9, base.y + lean.y * .45, base.z);
    }
    camera.position.copy(cam); camera.lookAt(look);
    renderer.render(scene, camera);
    /* stickers */
    stickers.forEach(s => {
      const a = s.dataset.anchor;
      v3.copy(anchors[a]); anchorObj[a].localToWorld(v3); v3.project(camera);
      s.style.left = ((v3.x + 1) / 2 * root.clientWidth).toFixed(1) + 'px';   /* left/top, so the sticker's tilt stays local */
      s.style.top = ((1 - v3.y) / 2 * root.clientHeight).toFixed(1) + 'px';
      s.style.opacity = opening ? 0 : '';
    });
  }
  fit();
  requestAnimationFrame(frame);
  addEventListener('pageshow', e => { if (e.persisted) { opening = false; look.set(-.1, 1.7, 0); cam.copy(base); } });
  root.querySelectorAll('[data-wall]').forEach(b => b.addEventListener('click', () => {
    const a = b.dataset.wall; a === 'power' ? setPower(!power) : a === 'ch' ? channel() : S.openBoard && S.openBoard();
  }));
}

/* ================================================================== turntable */
function box(w, h, d, x, y, z, m, r = .03) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2)), m);
  mesh.position.set(x, y, z); return mesh;
}
function cyl(rt, rb, h, x, y, z, m, seg = 24) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  mesh.position.set(x, y, z); return mesh;
}
const PLACEHOLDERS = {
  lounge(m) {
    const g = new THREE.Group();
    g.add(box(1.0, .3, .95, 0, .2, 0, m), box(.86, .18, .84, 0, .44, .02, m, .07));
    const back = box(.9, .9, .16, 0, .86, -.4, m, .06); back.rotation.x = -.2; g.add(back);
    const cush = box(.78, .7, .16, 0, .86, -.28, m, .07); cush.rotation.x = -.2; g.add(cush);
    g.add(box(.15, .42, .9, -.55, .55, 0, m), box(.15, .42, .9, .55, .55, 0, m));
    g.add(box(.72, .34, .58, 0, .17, .98, m, .06));
    return g;
  },
  gamer(m) {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const leg = box(.5, .05, .08, 0, .12, 0, m, .02), a = i / 5 * Math.PI * 2;
      leg.geometry.translate(.25, 0, 0); leg.rotation.y = a; g.add(leg);
      const w = new THREE.Mesh(new THREE.SphereGeometry(.05, 16, 12), m);
      w.position.set(Math.cos(a) * .5, .05, -Math.sin(a) * .5); g.add(w);
    }
    g.add(cyl(.04, .04, .38, 0, .34, 0, m), box(.62, .14, .6, 0, .58, 0, m, .06));
    const back = box(.6, 1.0, .14, 0, 1.15, -.28, m, .07); back.rotation.x = -.08; g.add(back);
    g.add(box(.32, .16, .12, 0, 1.64, -.32, m, .05));
    [-.36, .36].forEach(x => g.add(box(.05, .26, .05, x, .74, 0, m, .02), box(.09, .04, .34, x, .88, 0, m, .02)));
    return g;
  },
  dining(m) {
    const g = new THREE.Group();
    g.add(box(1.5, .06, .84, 0, .74, 0, m, .02));
    [[-.68, -.36], [.68, -.36], [-.68, .36], [.68, .36]].forEach(([x, z]) => g.add(cyl(.028, .022, .72, x, .36, z, m, 12)));
    [-.66, .66].forEach(z => {
      const s = Math.sign(z);
      g.add(box(.44, .05, .44, 0, .46, z, m, .02), box(.44, .44, .04, 0, .7, z + s * .2, m, .02));
      [[-.19, -.19], [.19, -.19], [-.19, .19], [.19, .19]].forEach(([x, dz]) => g.add(cyl(.018, .016, .44, x, .22, z + dz, m, 8)));
    });
    return g;
  },
  booth(m) {
    const g = new THREE.Group();
    g.add(box(2.2, .05, 1.6, 0, .025, 0, m, .01), box(2.2, 1.3, .06, 0, .7, -.77, m, .01), box(.06, 1.3, 1.6, -1.07, .7, 0, m, .01));
    const arch = new THREE.Mesh(new THREE.TorusGeometry(.5, .035, 12, 48, Math.PI), m);
    arch.position.set(.4, .9, -.35); g.add(arch);
    g.add(cyl(.035, .035, .9, -.1, .45, -.35, m, 10), cyl(.035, .035, .9, .9, .45, -.35, m, 10));
    g.add(box(.7, .5, .34, -.55, .3, .35, m, .02));
    for (let i = 0; i < 9; i++) g.add(box(.08, .08, .08, -.4 + (i % 3) * .2, 1.25 + Math.floor(i / 3) * .12, -.2 + (i % 2) * .1, m, .01));
    return g;
  },
  room(m) {
    const g = new THREE.Group();
    g.add(box(2.2, .05, 1.5, 0, .025, 0, m, .01));
    const s = new THREE.Shape(); s.moveTo(-1.1, 0); s.lineTo(1.1, 0); s.lineTo(1.1, 1.5); s.lineTo(-1.1, 1.5); s.lineTo(-1.1, 0);
    const hole = new THREE.Path(); hole.moveTo(-.32, .05); hole.lineTo(.32, .05); hole.lineTo(.32, .78); hole.absarc(0, .78, .32, 0, Math.PI, false); hole.lineTo(-.32, .05);
    s.holes.push(hole);
    const wall = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: .1, bevelEnabled: false }), m);
    wall.position.set(0, 0, -.75); g.add(wall);
    g.add(box(1.0, .24, .42, -.2, .17, -.2, m, .06), box(1.0, .3, .12, -.2, .38, -.38, m, .05));
    g.add(box(.14, .3, .42, -.75, .2, -.2, m, .04), box(.14, .3, .42, .35, .2, -.2, m, .04));
    g.add(cyl(.12, .09, .26, .78, .13, .2, m), new THREE.Mesh(new THREE.IcosahedronGeometry(.2, 1), m));
    g.children[g.children.length - 1].position.set(.78, .42, .2);
    return g;
  },
  lighthouse(m) {
    const g = new THREE.Group();
    g.add(cyl(.95, 1.05, .12, 0, .06, 0, m, 48));
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(.6, 1), m);
    rock.scale.set(1.2, .55, 1.0); rock.position.y = .3; g.add(rock);
    g.add(cyl(.13, .2, .9, .05, .95, 0, m), cyl(.2, .2, .04, .05, 1.42, 0, m), cyl(.12, .12, .17, .05, 1.52, 0, m));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(.16, .18, 24), m); roof.position.set(.05, 1.69, 0); g.add(roof);
    return g;
  },
  bottle(m) {
    const g = new THREE.Group();
    const prof = [[0, 0], [.27, 0], [.3, .04], [.3, .6], [.27, .7], [.13, .84], [.1, .96], [.1, 1.06]].map(([x, y]) => new THREE.Vector2(x, y));
    g.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 48), m));
    g.add(cyl(.085, .08, .14, 0, 1.12, 0, m));
    const caseBody = cyl(.34, .34, 1.0, .85, .5, -.1, m, 40); g.add(caseBody, cyl(.36, .36, .16, .85, 1.08, -.1, m, 40));
    return g;
  },
};
const KIND = { trapani: 'lounge', casa: 'gamer', skeidar: 'dining', events: 'booth', mideast: 'room', props: 'lighthouse', moonshot: 'bottle' };

function initTurntable(root) {
  const id = root.dataset.turntable, canvas = root.querySelector('canvas');
  let renderer;
  try { renderer = makeRenderer(canvas); } catch (e) { return; }
  root.classList.add('is-3d');
  const scene = new THREE.Scene();
  addEnvironment(renderer, scene, .35);
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 50);
  camera.position.set(2.6, 1.8, 4.4);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, .6));
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(-3, 5, 4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3 });
  key.shadow.normalBias = .02; key.shadow.radius = 4;
  const rim = new THREE.DirectionalLight(0xffffff, 1.6); rim.position.set(3, 3, -4);
  scene.add(key, rim);
  const plinth = cyl(1.6, 1.6, .08, 0, -.04, 0, new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: .6 }), 72);
  plinth.receiveShadow = true; scene.add(plinth);
  const clay = MAT.clay();
  let model = PLACEHOLDERS[KIND[id] || 'lounge'](clay);
  fitInto(model, 2.4, 1.7, 2.4); shadowsOn(model); scene.add(model);
  const glb = D.models && D.models.turntable && D.models.turntable[id];
  if (glb) loader.load(glb, gltf => {
    scene.remove(model); model = gltf.scene; fitInto(model, 2.4, 1.7, 2.4); shadowsOn(model); scene.add(model);
    root.classList.add('has-model'); applyMode();
  }, undefined, () => {});
  const controls = new OrbitControls(camera, canvas);
  Object.assign(controls, { enableDamping: true, dampingFactor: .08, enableZoom: false, enablePan: false, autoRotate: !RM, autoRotateSpeed: 1.6,
    minPolarAngle: .7, maxPolarAngle: 1.48 });
  controls.target.set(0, .75, 0);
  let mode = 'clay';
  function applyMode() {
    model.traverse(o => { if (o.isMesh) [].concat(o.material).forEach(mm => { mm.wireframe = mode === 'wire'; }); });
  }
  root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
    mode = b.dataset.mode; root.querySelectorAll('[data-mode]').forEach(x => x.setAttribute('aria-pressed', x === b)); applyMode();
  }));
  canvas.addEventListener('pointerenter', () => S.cursor && S.cursor('Drag'));
  canvas.addEventListener('pointerleave', () => S.cursor && S.cursor(null));
  function fit() {
    const w = root.clientWidth, h = root.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.position.setLength(camera.aspect < .9 ? 7.6 : 6.0);
    camera.updateProjectionMatrix();
    controls.update(); renderer.render(scene, camera);
  }
  new ResizeObserver(fit).observe(root);
  let visible = false;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(root);
  (function frame() {
    requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    controls.update(); renderer.render(scene, camera);
  })();
  fit();
}

const wallEl = document.getElementById('wall');
if (wallEl) initWall(wallEl);
document.querySelectorAll('[data-turntable]').forEach(initTurntable);
